import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BuildingsLayer } from './buildingsLayer';
import { LocalFrame } from './frame';
import { cellOf } from './buildings';
import { geodeticToEcef, rad } from './geo';
import { ResourceTracker } from '../stream';

const lat = 47.3779, lon = 8.5403;
const json = { elements: [{ type: 'way', id: 1, tags: { building: 'office', height: '40' }, geometry: [[0, 0], [30, 0], [30, 20], [0, 20], [0, 0]].map(([x, y]) => ({ lat: lat + y / 110574, lon: lon + x / (111320 * Math.cos(rad(lat))) })) }] };
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('BuildingsLayer', () => {
	const frame = new LocalFrame(geodeticToEcef(rad(lat), rad(lon), 500));
	it('wants a 3×3 block when low, one cell when higher, none above 3 km', () => {
		const L = new BuildingsLayer({ fetchJson: async () => json }, new ResourceTracker(), () => 400);
		expect(L.cellsFor(lat, lon, 100)).toHaveLength(9); expect(L.cellsFor(lat, lon, 2000)).toHaveLength(1); expect(L.cellsFor(lat, lon, 5000)).toHaveLength(0);
		L.dispose();
	});
	it('fetches one cell at a time, builds a mesh, and shows it', async () => {
		let calls = 0, live = 0, peak = 0;
		const tr = new ResourceTracker();
		const L = new BuildingsLayer({ fetchJson: async () => { calls++; live++; peak = Math.max(peak, live); await tick(); live--; return json; } }, tr, () => 400);
		for (let i = 0; i < 30; i++) { L.update(frame, lat, lon, 100, 1000 + i * 100, true); await tick(); }
		expect(peak).toBe(1); expect(calls).toBeGreaterThanOrEqual(9);
		expect(L.stats.buildings).toBeGreaterThan(0);
		expect(L.root.children.some((m) => (m as THREE.Mesh).visible)).toBe(true);
		L.dispose(); expect(tr.total('buildings')).toBe(0);
	});
	it('waits for the ground to be known and never fetches while high', async () => {
		let calls = 0;
		const L = new BuildingsLayer({ fetchJson: async () => { calls++; return json; } }, new ResourceTracker(), () => 0);
		L.update(frame, lat, lon, 100, 1000, false); L.update(frame, lat, lon, 8000, 1100, true); await tick();
		expect(calls).toBe(0); L.dispose();
	});
	it('a failing service is retried later, not hammered, and leaves the world without buildings', async () => {
		let calls = 0;
		const L = new BuildingsLayer({ fetchJson: async () => { calls++; throw new Error('503'); } }, new ResourceTracker(), () => 0);
		const c = cellOf(lat, lon); void c;
		for (let i = 0; i < 20; i++) { L.update(frame, lat, lon, 1800, 1000 + i * 100, true); await tick(); }
		expect(calls).toBe(1); expect(L.stats.failed).toBe(1); expect(L.stats.buildings).toBe(0);
		L.update(frame, lat, lon, 1800, 40000, true); await tick();
		expect(calls).toBe(2); L.dispose();
	});
});
