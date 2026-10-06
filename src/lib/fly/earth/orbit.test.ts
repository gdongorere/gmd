import { describe, expect, it } from 'vitest';
import { EARTH, WGS84, circularSpeed } from './geo';
import { orbitOf } from './orbit';

describe('osculating orbit', () => {
	const r = EARTH.R + 400_000;
	it('a circular 400 km orbit: apoapsis = periapsis = 400 km, in orbit', () => {
		const vc = circularSpeed(r);
		// rotating-frame velocity of a prograde equatorial circular orbit
		const o = orbitOf([r, 0, 0], [0, vc - EARTH.omega * r, 0]);
		expect(o.apoapsis!).toBeCloseTo(400_000, -2); expect(o.periapsis).toBeCloseTo(400_000, -2); expect(o.eccentricity).toBeLessThan(1e-4); expect(o.inOrbit).toBe(true);
		expect(o.inertialSpeed).toBeCloseTo(vc, 1);
	});
	it('a suborbital hop: apoapsis high, periapsis below the ground, not in orbit', () => {
		const o = orbitOf([WGS84.a + 80_000, 0, 0], [0, 3000 - EARTH.omega * (WGS84.a + 80_000), 2000]);
		expect(o.apoapsis!).toBeGreaterThan(80_000); expect(o.periapsis).toBeLessThan(0); expect(o.inOrbit).toBe(false);
	});
	it('a body at rest on the ground co-rotates: inertial speed 465 m/s at the equator, periapsis far below the surface', () => {
		const o = orbitOf([WGS84.a, 0, 0], [0, 0, 0]);
		expect(o.inertialSpeed).toBeCloseTo(465.1, 0); expect(o.periapsis).toBeLessThan(-5_000_000); expect(o.inOrbit).toBe(false);
	});
	it('faster than escape speed has no apoapsis', () => {
		const o = orbitOf([r, 0, 0], [0, 12_000, 0]);
		expect(o.apoapsis).toBeNull(); expect(o.inOrbit).toBe(true);
	});
	it('an eccentric orbit between 200 and 2000 km reports both ends', () => {
		const rp = EARTH.R + 200_000, ra = EARTH.R + 2_000_000, a = (rp + ra) / 2;
		const vp = Math.sqrt(EARTH.mu * (2 / rp - 1 / a));
		const o = orbitOf([rp, 0, 0], [0, vp - EARTH.omega * rp, 0]);
		expect(o.periapsis).toBeCloseTo(200_000, -2); expect(o.apoapsis!).toBeCloseTo(2_000_000, -2);
	});
});
