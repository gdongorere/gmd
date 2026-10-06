import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { type TileId } from './geo';
import { TerrainField, decodeTerrarium, heightAt, sampleTile } from './terrarium';

function load(name: string, id: TileId) {
	const p = PNG.sync.read(readFileSync(join(__dirname, '__fixtures__', `${name}.png`)));
	return decodeTerrarium(p.data, p.width, p.height, id);
}
const matterhorn = () => load('matterhorn-10-533-364', { z: 10, x: 533, y: 364 });
const deadsea = () => load('deadsea-10-612-417', { z: 10, x: 612, y: 417 });
const everest = () => load('everest-10-759-429', { z: 10, x: 759, y: 429 });

describe('Terrarium decoding against real data (fixtures fetched from the public tiles)', () => {
	it('encoding formula', () => {
		const t = decodeTerrarium(new Uint8Array([128, 0, 0, 255, 127, 255, 128, 255]), 2, 1, { z: 0, x: 0, y: 0 });
		expect(t.heights[0]).toBe(0); // 128·256 − 32768
		expect(t.heights[1]).toBeCloseTo(-0.5, 5);
	});
	it('Matterhorn tile: high Alps (peak 4478 m, 150 m pixels smooth it to ≳ 4300 m)', () => {
		const h = matterhorn().heights; expect(Math.max(...h)).toBeGreaterThan(4200); expect(Math.max(...h)).toBeLessThan(4600);
		expect(heightAt(matterhorn(), 7.6586, 45.9763)).toBeGreaterThan(3900);
	});
	it('Dead Sea tile includes the lake below sea level (surface ≈ −430 m)', () => {
		const t = deadsea();
		expect(Math.min(...t.heights)).toBeLessThan(-400);
		expect(heightAt(t, 35.45, 31.5)).toBeLessThan(-300);
	});
	it('Everest tile reaches ≳ 8600 m and the Khumbu valley is far lower', () => {
		const t = everest(); expect(Math.max(...t.heights)).toBeGreaterThan(8600); expect(Math.max(...t.heights)).toBeLessThan(8900);
		expect(Math.min(...t.heights)).toBeLessThan(5000);
	});
	it('bilinear sampling interpolates and clamps', () => {
		const t = decodeTerrarium(new Uint8Array([128, 0, 0, 255, 128, 10, 0, 255, 128, 20, 0, 255, 128, 30, 0, 255]), 2, 2, { z: 1, x: 0, y: 0 });
		expect(sampleTile(t, 1, 1)).toBeCloseTo(15, 5); // centre of the 2×2 grid
		expect(sampleTile(t, -50, -50)).toBe(0);
		expect(sampleTile(t, 99, 99)).toBe(30);
	});
});

describe('TerrainField', () => {
	it('uses the finest resident tile and returns null where nothing is loaded', () => {
		const f = new TerrainField();
		expect(f.height(7.6586, 45.9763)).toBeNull();
		const m = matterhorn(); f.set(m);
		expect(f.height(7.6586, 45.9763)).toBeCloseTo(heightAt(m, 7.6586, 45.9763), 6);
		expect(f.height(-100, 0)).toBeNull();
	});
	it('prefers a finer tile over a coarser one', () => {
		const f = new TerrainField();
		const coarse = decodeTerrarium(new Uint8Array(256 * 256 * 4).fill(0).map((_, i) => (i % 4 === 0 ? 128 : i % 4 === 3 ? 255 : 0)), 256, 256, { z: 9, x: 266, y: 182 });
		f.set(coarse); expect(f.height(7.6586, 45.9763)).toBe(0);
		f.set(matterhorn()); expect(f.height(7.6586, 45.9763)).toBeGreaterThan(3900);
		expect(f.size).toBe(2);
	});
});
