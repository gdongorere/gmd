import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { LocalFrame } from './frame';
import { geodeticToEcef, rad, type TileId } from './geo';
import { EarthManager, type ManagerDeps } from './manager';
import { decodeTerrarium, type HeightTile } from './terrarium';

const png = PNG.sync.read(readFileSync(join(__dirname, '__fixtures__', 'matterhorn-10-533-364.png')));
const fixture = (id: TileId): HeightTile => decodeTerrarium(png.data, png.width, png.height, id);
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function rig(lat: number, lon: number, alt: number) {
	const cam = geodeticToEcef(rad(lat), rad(lon), alt);
	const frame = new LocalFrame(cam);
	const camera = new THREE.PerspectiveCamera(60, 1.5, 0.5, 5e7);
	camera.position.set(0, 0, 0); camera.lookAt(0, -0.3, -1); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
	return { cam, frame, camera };
}

async function settle(m: EarthManager, r: ReturnType<typeof rig>, lat: number, lon: number, alt: number, ms = 8000) {
	let now = 0;
	for (let i = 0; i < 400; i++) {
		now += ms / 400 * 10;
		m.pinUnderfoot(lat, lon, alt);
		m.update(r.frame, r.camera, r.cam, 800, now);
		await tick();
		if (m.stats.underfootReady && m.stats.ready > 0.99 && m.stats.loading === 0) break;
	}
}

describe('EarthManager streaming', () => {
	it('loads, shows and pins ground: terrain becomes ready and heights are real', async () => {
		const lat = 46, lon = 7.7, alt = 3000, r = rig(lat, lon, alt);
		let peak = 0, live = 0;
		const deps: ManagerDeps = { loadHeights: async (id) => { live++; peak = Math.max(peak, live); await tick(); live--; return fixture(id); } };
		const m = new EarthManager(deps);
		await settle(m, r, lat, lon, alt);
		expect(m.stats.underfootReady).toBe(true);
		expect(m.stats.displayed).toBeGreaterThan(0);
		expect(peak).toBeLessThanOrEqual(6);
		const h = m.terrain.height(rad(lat), rad(lon));
		expect(h).not.toBeNull(); expect(h!).toBeGreaterThan(1000);
		expect(m.tracker.total()).toBeGreaterThan(m.stats.resident); // every mesh geometry is tracked (plus materials)
		m.dispose();
	});

	it('never returns a made-up ground height near the ground before the tiles under the ship exist', () => {
		const r = rig(46, 7.7, 20); void r;
		const m = new EarthManager({ loadHeights: () => new Promise(() => {}) });
		m.pinUnderfoot(46, 7.7, 20);
		expect(m.terrain.height(rad(46), rad(7.7))).toBeNull();
		m.dispose();
	});

	it('shows a coarser ancestor while finer tiles are slow (no holes) and the fine tile replaces it when it arrives', async () => {
		const lat = 46, lon = 7.7, alt = 1500, r = rig(lat, lon, alt);
		let release: (() => void) | null = null; const gate = new Promise<void>((res) => (release = res));
		const deps: ManagerDeps = { loadHeights: async (id) => { if (id.z > 8) await gate; return fixture(id); } };
		const m = new EarthManager(deps);
		let now = 0;
		for (let i = 0; i < 60; i++) { now += 150; m.pinUnderfoot(lat, lon, alt); m.update(r.frame, r.camera, r.cam, 800, now); await tick(); }
		expect(m.stats.displayed).toBeGreaterThan(0); // coarse ancestors cover the view
		expect(m.stats.ready).toBeLessThan(1);
		release!();
		for (let i = 0; i < 200; i++) { now += 150; m.pinUnderfoot(lat, lon, alt); m.update(r.frame, r.camera, r.cam, 800, now); await tick(); if (m.stats.ready > 0.99 && m.stats.loading === 0) break; }
		expect(m.stats.ready).toBeGreaterThan(0.99);
		m.dispose();
	});

	it('survives a dead network: flat flagged tiles, sea level ground, and the ship is not stuck forever', async () => {
		const lat = 10, lon = 10, alt = 500, r = rig(lat, lon, alt);
		const m = new EarthManager({ loadHeights: async () => { throw new Error('offline'); } });
		await settle(m, r, lat, lon, alt, 20000);
		expect(m.stats.offline).toBe(true);
		expect(m.terrain.height(rad(lat), rad(lon))).toBe(0);
		m.dispose();
	});

	it('aborts loads that nobody wants any more after the ship flies away', async () => {
		const aborted: string[] = [];
		const deps: ManagerDeps = { loadHeights: (id, signal) => new Promise((_res, rej) => { signal.addEventListener('abort', () => { aborted.push(`${id.z}/${id.x}/${id.y}`); rej(new Error('abort')); }); }) };
		const m = new EarthManager(deps);
		let r = rig(46, 7.7, 2000), now = 0;
		for (let i = 0; i < 5; i++) { now += 150; m.pinUnderfoot(46, 7.7, 2000); m.update(r.frame, r.camera, r.cam, 800, now); await tick(); }
		r = rig(-33, 151, 2000);
		for (let i = 0; i < 40; i++) { now += 150; m.pinUnderfoot(-33, 151, 2000); m.update(r.frame, r.camera, r.cam, 800, now); await tick(); }
		expect(aborted.length).toBeGreaterThan(0);
		m.dispose();
	});

	it('dispose releases every tracked GPU object and removes the meshes', async () => {
		const lat = 46, lon = 7.7, alt = 3000, r = rig(lat, lon, alt);
		const m = new EarthManager({ loadHeights: async (id) => fixture(id) });
		await settle(m, r, lat, lon, alt);
		expect(m.tracker.total()).toBeGreaterThan(0);
		m.dispose(); m.dispose();
		expect(m.tracker.total()).toBe(0); expect(m.root.children.length).toBe(0); expect(m.budget.bytes('tiles')).toBe(0);
	});

	it('imagery: a tile gets a texture and a window onto its source tile; a failing provider leaves the tint', async () => {
		const lat = 46, lon = 7.7, alt = 3000, r = rig(lat, lon, alt);
		const okImg = { width: 4, height: 4, close() {} } as unknown as ImageBitmap;
		const asked: TileId[] = [];
		const m = new EarthManager({ loadHeights: async (id) => fixture(id), loadImage: async (id) => { asked.push(id); return { image: okImg, tile: { z: Math.min(id.z, 8), x: id.x >> Math.max(0, id.z - 8), y: id.y >> Math.max(0, id.z - 8) } }; } });
		await settle(m, r, lat, lon, alt);
		for (let i = 0; i < 20; i++) { m.update(r.frame, r.camera, r.cam, 800, 9000 + i * 150); await tick(); }
		expect(asked.length).toBeGreaterThan(0); expect(m.stats.imagery).toBeGreaterThan(0);
		m.dispose();
		const m2 = new EarthManager({ loadHeights: async (id) => fixture(id), loadImage: async () => null });
		await settle(m2, r, lat, lon, alt);
		for (let i = 0; i < 20; i++) { m2.update(r.frame, r.camera, r.cam, 800, 9000 + i * 150); await tick(); }
		expect(m2.stats.imagery).toBe(0); expect(m2.stats.displayed).toBeGreaterThan(0);
		m2.dispose();
	});
});
