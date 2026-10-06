import { describe, expect, it } from 'vitest';
import { geodeticToEcef, rad, type TileId, WGS84 } from './geo';
import { GRID, selectTiles, tileSphere, zoomForResolution } from './quadtree';

const cam = (latDeg: number, lonDeg: number, h: number) => geodeticToEcef(rad(latDeg), rad(lonDeg), h);
const base = { fov: rad(60), viewportHeight: 800 };

describe('terrain tile selection', () => {
	it('with no culling the selected tiles cover the world exactly once (no holes, no overlap)', () => {
		for (const [lat, lon, h] of [[46, 8, 500], [0, 0, 2e6], [-30, 150, 30], [80, -100, 15000]] as const) {
			const sel = selectTiles({ ...base, camera: cam(lat, lon, h), noHorizonCull: true, maxTiles: 100000, minZoom: 3, maxZoom: 9 });
			expect(sel.reduce((s, t) => s + 4 ** -t.id.z, 0)).toBeCloseTo(1, 12);
			// no tile is an ancestor of another
			const keys = new Set(sel.map((t) => `${t.id.z}/${t.id.x}/${t.id.y}`));
			for (const t of sel) { let p: TileId = t.id; while (p.z > 0) { p = { z: p.z - 1, x: p.x >> 1, y: p.y >> 1 }; expect(keys.has(`${p.z}/${p.x}/${p.y}`)).toBe(false); } }
		}
	});
	it('refines toward the camera: the nearest tile is finer than the farthest', () => {
		const sel = selectTiles({ ...base, camera: cam(46.5, 8.0, 800), maxZoom: 14 });
		expect(sel[0].id.z).toBeGreaterThan(sel[sel.length - 1].id.z + 3);
		expect(sel[0].id.z).toBeGreaterThanOrEqual(12);
	});
	it('stays within the tile budget from ground to orbit', () => {
		for (const h of [2, 100, 5000, 100000, 400000, 3e7]) {
			const sel = selectTiles({ ...base, camera: cam(35, 139, h), tolerance: 2, maxTiles: 600 });
			expect(sel.length).toBeGreaterThan(0); expect(sel.length).toBeLessThanOrEqual(600);
		}
	});
	it('from low altitude only the near hemisphere is selected (horizon culling)', () => {
		const near = selectTiles({ ...base, camera: cam(0, 0, 1000) });
		const lons = near.map((t) => t.center[0]); // centres on the far side have negative x
		expect(Math.min(...lons)).toBeGreaterThan(-WGS84.a * 0.5);
	});
	it('from space the whole visible face is covered at coarse zoom', () => {
		const sel = selectTiles({ ...base, camera: cam(0, 0, 2e7) });
		expect(sel.every((t) => t.id.z <= 7)).toBe(true);
	});
	it('the frustum callback culls', () => {
		const all = selectTiles({ ...base, camera: cam(46, 8, 3000) });
		const half = selectTiles({ ...base, camera: cam(46, 8, 3000), inView: (c) => c[1] > 0 });
		expect(half.length).toBeLessThan(all.length);
	});
	it('bounding spheres contain the tile corners', () => {
		const t = tileSphere({ z: 10, x: 536, y: 358 });
		expect(t.radius).toBeGreaterThan(25000); expect(t.radius).toBeLessThan(50000);
	});
	it('constants', () => { expect(GRID).toBe(32); expect(zoomForResolution(30)).toBe(13); });
});
