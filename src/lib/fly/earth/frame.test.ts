import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { LocalFrame, REBASE_DISTANCE } from './frame';
import { enuBasis, geodeticToEcef, rad } from './geo';
import { moonEcef, subsolarPoint, sunElevation } from './sun';
import { PLACES } from './places';

describe('local render frame', () => {
	const lat = rad(47), lon = rad(8);
	const anchor = geodeticToEcef(lat, lon, 400);
	const f = new LocalFrame(anchor);
	it('the anchor is the origin and the local up axis is +Y', () => {
		expect(f.toLocal(anchor).length()).toBeLessThan(1e-6);
		const up = enuBasis(lat, lon).up;
		const l = f.dirToLocal(up); expect(l.y).toBeCloseTo(1, 12); expect(Math.abs(l.x) + Math.abs(l.z)).toBeLessThan(1e-12);
	});
	it('1 km east is +X; 1 km north is −Z (south is +Z); 1 km up is +Y', () => {
		const b = enuBasis(lat, lon);
		const at = (v: number[], d: number) => new THREE.Vector3(anchor[0] + v[0] * d, anchor[1] + v[1] * d, anchor[2] + v[2] * d);
		const e = f.toLocal(at(b.east, 1000)), n = f.toLocal(at(b.north, 1000)), u = f.toLocal(at(b.up, 1000));
		expect(e.x).toBeCloseTo(1000, 6); expect(n.z).toBeCloseTo(-1000, 6); expect(u.y).toBeCloseTo(1000, 6);
	});
	it('round-trips local ↔ ECEF to a micrometre', () => {
		const p = new THREE.Vector3(1234.5, -87.25, 4321.125);
		const back = f.toLocal(f.toEcef(p));
		expect(back.distanceTo(p)).toBeLessThan(1e-6);
	});
	it('the ground curves away: a point 4 km east sits ≈ 1.25 m below the local plane', () => {
		const b = enuBasis(lat, lon);
		const g = geodeticToEcef(lat + 0, lon + 4000 / (6371000 * Math.cos(lat)), 400);
		const l = f.toLocal(g);
		expect(l.y).toBeLessThan(-0.5); expect(l.y).toBeGreaterThan(-3);
		void b;
	});
	it('orientation: a body aligned with the local frame has identity local orientation', () => {
		const qE = f.qBasis.clone();
		const q = f.quatToLocal(qE);
		expect(Math.abs(q.w)).toBeCloseTo(1, 10);
	});
	it('re-bases beyond the threshold', () => {
		expect(f.needsRebase(new THREE.Vector3(...anchor))).toBe(false);
		expect(f.needsRebase(new THREE.Vector3(anchor[0] + REBASE_DISTANCE * 1.1, anchor[1], anchor[2]))).toBe(true);
	});
});

describe('Sun position (astronomy-engine → ECEF)', () => {
	it('June solstice 2024: sub-solar latitude ≈ 23.4°N', () => {
		const s = subsolarPoint(new Date('2024-06-20T20:51:00Z'));
		expect(s.lat).toBeGreaterThan(23.3); expect(s.lat).toBeLessThan(23.5);
	});
	it('March equinox 2024 near noon UTC: sub-solar point near the equator and prime meridian region', () => {
		const s = subsolarPoint(new Date('2024-03-20T12:00:00Z'));
		expect(Math.abs(s.lat)).toBeLessThan(1); expect(Math.abs(s.lon)).toBeLessThan(3.5);
	});
	it('Zürich is in daylight at noon UTC on the June solstice (≈ 66°) and in the dark at midnight', () => {
		expect(sunElevation(new Date('2024-06-21T11:00:00Z'), 47.37, 8.54)).toBeGreaterThan(60);
		expect(sunElevation(new Date('2024-06-21T23:30:00Z'), 47.37, 8.54)).toBeLessThan(-5);
	});
	it('polar day at 78° N in June, polar night in December', () => {
		expect(sunElevation(new Date('2024-06-21T00:00:00Z'), 78.2, 15.6)).toBeGreaterThan(0);
		expect(sunElevation(new Date('2024-12-21T12:00:00Z'), 78.2, 15.6)).toBeLessThan(-8);
	});
	it('the Moon vector is a unit vector', () => { const m = moonEcef(new Date('2024-01-01T00:00:00Z')); expect(Math.hypot(...m)).toBeCloseTo(1, 9); });
});

describe('places', () => {
	it('ids are unique and coordinates valid', () => {
		expect(new Set(PLACES.map((p) => p.id)).size).toBe(PLACES.length);
		for (const p of PLACES) { expect(Math.abs(p.lat)).toBeLessThanOrEqual(90); expect(Math.abs(p.lon)).toBeLessThanOrEqual(180); }
	});
});
