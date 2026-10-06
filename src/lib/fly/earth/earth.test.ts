import { describe, expect, it } from 'vitest';
import { EARTH, WGS84, bearing, circularSpeed, ecefToGeodetic, effectiveGravity, geodeticToEcef, gravityEcef, greatCircle, lonLatToTile, rad, tileBounds, tileLat, upAt, enuBasis, childrenOf, parentOf, tileSpanEquator } from './geo';
import { airAt, mach } from './atmosphere';

describe('WGS84 geodesy', () => {
	it('known points: equator/prime meridian, pole', () => {
		const [x, y, z] = geodeticToEcef(0, 0, 0);
		expect(x).toBeCloseTo(6378137, 3); expect(y).toBeCloseTo(0, 3); expect(z).toBeCloseTo(0, 3);
		expect(geodeticToEcef(Math.PI / 2, 0, 0)[2]).toBeCloseTo(6356752.314, 2);
	});
	it('round trip below 1 mm for random surface and flight points (property test)', () => {
		let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
		for (let i = 0; i < 4000; i++) {
			const lat = (rnd() - 0.5) * Math.PI, lon = (rnd() - 0.5) * 2 * Math.PI, h = -11000 + rnd() * 400000;
			const p = geodeticToEcef(lat, lon, h);
			const g = ecefToGeodetic(...p);
			const q = geodeticToEcef(g.lat, g.lon, g.h);
			expect(Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2])).toBeLessThan(1e-3);
		}
	});
	it('handles the polar axis', () => {
		const g = ecefToGeodetic(0, 0, 6356752.314 + 1000);
		expect(g.lat).toBeCloseTo(Math.PI / 2, 9); expect(g.h).toBeCloseTo(1000, 1);
	});
	it('east, north, up are orthonormal and up matches the surface normal', () => {
		const { east, north, up } = enuBasis(rad(47), rad(8));
		const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
		expect(dot(east, north)).toBeCloseTo(0, 12); expect(dot(east, up)).toBeCloseTo(0, 12); expect(dot(north, up)).toBeCloseTo(0, 12);
		expect(up).toEqual(upAt(rad(47), rad(8)));
	});
	it('great circle: London → New York ≈ 5570 km; bearing ≈ 288°', () => {
		const d = greatCircle(rad(51.5074), rad(-0.1278), rad(40.7128), rad(-74.006));
		expect(d / 1000).toBeGreaterThan(5540); expect(d / 1000).toBeLessThan(5600);
		expect(bearing(rad(51.5074), rad(-0.1278), rad(40.7128), rad(-74.006)) * (180 / Math.PI)).toBeGreaterThan(285);
	});
});

describe('Earth gravity (measured values)', () => {
	it('effective surface gravity: 9.780 m/s² at the equator, 9.832 at the pole, 9.806 at 45°', () => {
		expect(effectiveGravity(0)).toBeCloseTo(9.7803, 2);
		expect(effectiveGravity(Math.PI / 2)).toBeCloseTo(9.8322, 2);
		expect(effectiveGravity(rad(45))).toBeCloseTo(9.8062, 2);
	});
	it('falls with altitude: ~9.50 m/s² at 100 km', () => expect(effectiveGravity(0, 100000)).toBeCloseTo(9.5, 1));
	it('circular orbit at 400 km altitude is 7.67 km/s with a 92.4-minute period', () => {
		const r = WGS84.a + 400000;
		expect(circularSpeed(r) / 1000).toBeCloseTo(7.67, 2);
		expect(((2 * Math.PI * r) / circularSpeed(r)) / 60).toBeCloseTo(92.4, 0);
	});
	it('gravity points toward the centre', () => {
		const p = geodeticToEcef(rad(30), rad(20), 1000);
		const g = gravityEcef(...p);
		const cos = -(g[0] * p[0] + g[1] * p[1] + g[2] * p[2]) / (Math.hypot(...g) * Math.hypot(...p));
		expect(cos).toBeGreaterThan(0.999);
		expect(EARTH.omega * 86164.1).toBeCloseTo(2 * Math.PI, 3);
	});
});

describe('Web-Mercator tiles', () => {
	it('Zurich at z10 is tile 536/358', () => expect(lonLatToTile(10, 8.5417, 47.3769)).toEqual({ z: 10, x: 536, y: 358 }));
	it('bounds contain the point and children tile the parent exactly', () => {
		const t = lonLatToTile(8, 8.5417, 47.3769), b = tileBounds(t);
		expect(8.5417).toBeGreaterThanOrEqual(b.west); expect(8.5417).toBeLessThanOrEqual(b.east);
		expect(47.3769).toBeGreaterThanOrEqual(b.south); expect(47.3769).toBeLessThanOrEqual(b.north);
		const kids = childrenOf(t).map(tileBounds);
		expect(Math.min(...kids.map((k) => k.west))).toBeCloseTo(b.west, 9);
		expect(Math.max(...kids.map((k) => k.east))).toBeCloseTo(b.east, 9);
		expect(Math.max(...kids.map((k) => k.north))).toBeCloseTo(b.north, 9);
		expect(Math.min(...kids.map((k) => k.south))).toBeCloseTo(b.south, 9);
		kids.forEach((_, i) => expect(parentOf(childrenOf(t)[i])).toEqual(t));
	});
	it('the world tile spans ±85.05°', () => { expect(tileLat(0, 0)).toBeCloseTo(85.0511, 3); expect(tileSpanEquator(0)).toBeCloseTo(40075016.7, 0); });
});

describe('Standard atmosphere 1976 (published table values)', () => {
	const near = (a: number, b: number, tol: number) => expect(Math.abs(a - b) / b).toBeLessThan(tol);
	it('sea level', () => { const a = airAt(0); near(a.temperature, 288.15, 1e-6); near(a.pressure, 101325, 1e-6); near(a.density, 1.225, 1e-3); near(a.speedOfSound, 340.29, 1e-3); });
	it('11 km (tropopause): 216.65 K, 22 632 Pa, 0.3639 kg/m³', () => { const a = airAt(11019.1); near(a.temperature, 216.65, 1e-3); near(a.pressure, 22632, 2e-3); near(a.density, 0.3639, 3e-3); });
	it('20 km: 54 749 Pa, 0.0880 kg/m³ (geometric ≈ 20 063 m)', () => { const a = airAt(20063); near(a.pressure, 5474.9, 4e-3); near(a.density, 0.08803, 4e-3); });
	it('Everest (8849 m) pressure ≈ 31.4 kPa', () => near(airAt(8849).pressure, 31400, 0.02));
	it('density falls monotonically to near-vacuum and stays finite', () => {
		let prev = Infinity;
		for (let z = 0; z <= 150000; z += 500) { const d = airAt(z).density; expect(d).toBeLessThanOrEqual(prev); expect(Number.isFinite(d)).toBe(true); prev = d; }
		expect(airAt(100000).density).toBeLessThan(1e-6);
	});
	it('Mach 1 at sea level is 340 m/s', () => expect(mach(0, 340.29)).toBeCloseTo(1, 3));
	it('below sea level is denser (Dead Sea, −430 m)', () => expect(airAt(-430).pressure).toBeGreaterThan(101325));
});
