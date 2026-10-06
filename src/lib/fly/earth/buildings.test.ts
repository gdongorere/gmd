import { describe, expect, it } from 'vitest';
import { CELL_DEG, buildingHeight, cellBounds, cellOf, extrudeBuildings, overpassQuery, parseHeight, parseOverpass, ringAreaM2 } from './buildings';

// A tiny hand-made Overpass response near Zürich HB (not real OSM data): a 30 m tower block, a 5-level block, an untagged house, an L-shape, plus junk.
const lat = 47.3779, lon = 8.5403;
const box = (id: number, tags: Record<string, string>, w: number, h: number, dx = 0, dy = 0) => {
	const x = lon + dx / (111320 * Math.cos((lat * Math.PI) / 180)), y = lat + dy / 110574;
	const dX = w / (111320 * Math.cos((lat * Math.PI) / 180)), dY = h / 110574;
	const g = [[x, y], [x + dX, y], [x + dX, y + dY], [x, y + dY], [x, y]].map(([lo, la]) => ({ lat: la, lon: lo }));
	return { type: 'way', id, tags, geometry: g };
};
const fixture = {
	elements: [
		box(1, { building: 'office', height: '30' }, 20, 10, 0, 0),
		box(2, { building: 'apartments', 'building:levels': '5' }, 25, 12, 40, 0),
		box(3, { building: 'house' }, 10, 8, 80, 0),
		{ type: 'way', id: 4, tags: { building: 'yes', height: '12 m' }, geometry: [[0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20], [0, 0]].map(([x, y]) => ({ lat: lat + y / 110574 + 0.001, lon: lon + x / (111320 * Math.cos((lat * Math.PI) / 180)) + 0.001 })) },
		box(5, { building: 'shed' }, 1, 1, 0, 40), // too small
		{ type: 'way', id: 6, tags: { building: 'yes' }, geometry: [{ lat, lon }, { lat: lat + 0.001, lon }] }, // not a ring
		{ type: 'node', id: 7 },
	],
};

describe('heights', () => {
	it('parses OSM height values', () => {
		expect(parseHeight('12')).toBe(12); expect(parseHeight('12.5 m')).toBe(12.5); expect(parseHeight('40 ft')).toBeCloseTo(12.19, 2);
		expect(parseHeight('tall')).toBeNull(); expect(parseHeight('-3')).toBeNull(); expect(parseHeight(undefined)).toBeNull();
	});
	it('mapped height wins; levels × 3.2 m next; type default (marked as an estimate) last', () => {
		expect(buildingHeight({ building: 'office', height: '30' }, 1)).toEqual({ height: 30, estimated: false });
		expect(buildingHeight({ building: 'apartments', 'building:levels': '5' }, 2).height).toBeCloseTo(16.8, 5);
		const h = buildingHeight({ building: 'house' }, 3); expect(h.estimated).toBe(true); expect(h.height).toBeGreaterThan(5.5); expect(h.height).toBeLessThan(8.5);
	});
	it('estimates are deterministic per id', () => expect(buildingHeight({ building: 'yes' }, 99)).toEqual(buildingHeight({ building: 'yes' }, 99)));
});

describe('Overpass parsing', () => {
	const fps = parseOverpass(fixture);
	it('keeps real rings, drops tiny, open and non-way elements', () => expect(fps.map((f) => f.id)).toEqual([1, 2, 3, 4]));
	it('areas are right (20 × 10 m = 200 m²)', () => expect(ringAreaM2(fps[0].ring)).toBeGreaterThan(195));
	it('the query covers exactly one cell', () => {
		const c = cellOf(lat, lon), b = cellBounds(c);
		expect(overpassQuery(c)).toContain(`${b.south},${b.west},${b.north},${b.east}`);
		expect(b.north - b.south).toBeCloseTo(CELL_DEG, 9);
		expect(lat).toBeGreaterThanOrEqual(b.south); expect(lat).toBeLessThan(b.north);
	});
});

describe('extrusion', () => {
	const fps = parseOverpass(fixture);
	const cell = cellOf(lat, lon);
	const slope = (la: number, lo: number) => 400 + (lo - lon) * 20000; // a gentle slope rising east
	const g = extrudeBuildings(fps, cell, slope);

	it('makes boxes: a 4-sided prism has 8 wall + 2 roof triangles; the L-shape 12 + 4', () => {
		const one = extrudeBuildings([fps[0]], cell, () => 400);
		expect(one.triangles).toBe(10);
		const l = extrudeBuildings([fps[3]], cell, () => 400);
		expect(l.triangles).toBe(16);
		expect(g.buildings).toBe(4);
	});
	it('roofs sit exactly `height` above the lowest ground under the outline', () => {
		const g1 = extrudeBuildings([fps[0]], cell, () => 400);
		const radii = [] as number[];
		for (let i = 0; i < g1.positions.length / 3; i++) radii.push(Math.hypot(g1.positions[i * 3] + g1.center[0], g1.positions[i * 3 + 1] + g1.center[1], g1.positions[i * 3 + 2] + g1.center[2]));
		expect(Math.max(...radii) - Math.min(...radii)).toBeGreaterThan(30 + 2 - 0.5); expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(30 + 2 + 0.5);
		expect(g1.tallest).toBe(30);
	});
	it('wall normals point away from the building and roofs point up', () => {
		const g1 = extrudeBuildings([fps[0]], cell, () => 400);
		const cx = [0, 0, 0]; const n = g1.positions.length / 3;
		for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) cx[k] += g1.positions[i * 3 + k] / n;
		let wallOk = 0, wall = 0, roofUp = 0, roof = 0;
		for (let i = 0; i < n; i++) {
			const p = [g1.positions[i * 3] - cx[0], g1.positions[i * 3 + 1] - cx[1], g1.positions[i * 3 + 2] - cx[2]];
			const nn = [g1.normals[i * 3], g1.normals[i * 3 + 1], g1.normals[i * 3 + 2]];
			const abs = [p[0] + cx[0] + g1.center[0], p[1] + cx[1] + g1.center[1], p[2] + cx[2] + g1.center[2]];
			const upDot = (nn[0] * abs[0] + nn[1] * abs[1] + nn[2] * abs[2]) / Math.hypot(...abs);
			if (i < 16) { wall++; if (upDot < 0.01 && nn[0] * p[0] + nn[1] * p[1] + nn[2] * p[2] > 0) wallOk++; } else { roof++; if (upDot > 0.99) roofUp++; }
		}
		expect(wallOk).toBe(wall); expect(roofUp).toBe(roof);
	});
	it('every index is valid and no NaN is produced', () => {
		const nv = g.positions.length / 3;
		expect(Math.max(...g.indices)).toBeLessThan(nv);
		expect(g.positions.every(Number.isFinite)).toBe(true);
	});
	it('empty input gives an empty mesh', () => { const e = extrudeBuildings([], cell, () => 0); expect(e.triangles).toBe(0); });
});
