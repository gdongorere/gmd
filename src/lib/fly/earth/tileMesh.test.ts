import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { GRID } from './quadtree';
import { decodeTerrarium } from './terrarium';
import { buildTileGeometry, surfaceColor } from './tileMesh';
import { geodeticToEcef, rad } from './geo';

const load = (name: string, id: { z: number; x: number; y: number }) => { const p = PNG.sync.read(readFileSync(join(__dirname, '__fixtures__', `${name}.png`))); return decodeTerrarium(p.data, p.width, p.height, id); };

describe('tile geometry from real elevation', () => {
	const g = buildTileGeometry(load('matterhorn-10-533-364', { z: 10, x: 533, y: 364 }));
	const W = GRID + 1;

	it('has the expected vertex/triangle counts (grid + skirts)', () => {
		expect(g.positions.length / 3).toBe(W * W + 4 * W);
		expect(g.indices.length / 3).toBe(2 * (GRID * GRID + 8 * GRID));
	});
	it('vertices lie on the real surface: radius matches ellipsoid + height', () => {
		const k = Math.floor(W / 2) * W + Math.floor(W / 2);
		const abs = [g.positions[k * 3] + g.center[0], g.positions[k * 3 + 1] + g.center[1], g.positions[k * 3 + 2] + g.center[2]];
		const r = Math.hypot(...abs);
		expect(r).toBeGreaterThan(6356752); expect(r).toBeLessThan(6378137 + 5000);
	});
	it('relief is real (> 2 km range in the Alps) and every normal is unit length and points outward', () => {
		expect(g.maxHeight - g.minHeight).toBeGreaterThan(2000);
		for (let k = 0; k < W * W; k += 7) {
			const nx = g.normals[k * 3], ny = g.normals[k * 3 + 1], nz = g.normals[k * 3 + 2];
			expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 4);
			const ax = g.positions[k * 3] + g.center[0], ay = g.positions[k * 3 + 1] + g.center[1], az = g.positions[k * 3 + 2] + g.center[2];
			expect(nx * ax + ny * ay + nz * az).toBeGreaterThan(0);
		}
	});
	it('triangles face outward (counter-clockwise seen from above)', () => {
		let bad = 0, total = 0;
		for (let t = 0; t < GRID * GRID * 2; t++) {
			const [a, b, c] = [g.indices[t * 3], g.indices[t * 3 + 1], g.indices[t * 3 + 2]];
			const P = (i: number) => [g.positions[i * 3], g.positions[i * 3 + 1], g.positions[i * 3 + 2]];
			const A = P(a), B = P(b), C = P(c);
			const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
			const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
			const out = [A[0] + g.center[0], A[1] + g.center[1], A[2] + g.center[2]];
			total++; if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] <= 0) bad++;
		}
		expect(bad).toBe(0); expect(total).toBeGreaterThan(0);
	});
	it('skirts hang below their edge', () => {
		const edgeVertex = 5, skirt = W * W + 5;
		const r = (i: number) => Math.hypot(g.positions[i * 3] + g.center[0], g.positions[i * 3 + 1] + g.center[1], g.positions[i * 3 + 2] + g.center[2]);
		expect(r(edgeVertex) - r(skirt)).toBeGreaterThan(20);
	});
	it('alpine peaks are snow-white, valley floors green, steep faces grey', () => {
		const brightness = (c: number[]) => c[0] + c[1] + c[2];
		const snowy = surfaceColor(4400, 0.95, rad(46)), grass = surfaceColor(600, 0.99, rad(46)), cliff = surfaceColor(2000, 0.5, rad(46));
		expect(brightness(snowy)).toBeGreaterThan(brightness(grass) * 2);
		expect(grass[1]).toBeGreaterThan(grass[0]); expect(Math.abs(cliff[0] - cliff[2])).toBeLessThan(0.05);
	});
	it('sea level: ocean is blue and the Dead Sea tile has water', () => {
		const sea = surfaceColor(-100, 1, 0);
		expect(sea[2]).toBeGreaterThan(sea[0] * 3);
		const ds = buildTileGeometry(load('deadsea-10-612-417', { z: 10, x: 612, y: 417 }));
		expect(ds.water).toBeGreaterThan(0.01); expect(ds.minHeight).toBeLessThan(-400);
		void geodeticToEcef;
	});
});
