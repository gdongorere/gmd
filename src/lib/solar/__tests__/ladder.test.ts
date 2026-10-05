import { describe, expect, it } from 'vitest';
import { LADDER, describeDistance, describeLightTime, flightDistance, nearestStop, planFlight, smootherstep } from '../ladder';
import { earthOrientation, surfacePointFacing, surfacePointFromSceneChain } from '../earthFrame';
import { planetStates } from '../../astro/planets';
import { subsolarPoint } from '../../astro/earth';
import { jdFromCalendar } from '../../astro/julian';

describe('distances', () => {
	it('formats AU, km and altitude', () => {
		expect(describeDistance(1)).toBe('1.00 AU');
		expect(describeDistance(30.07)).toBe('30.1 AU');
		expect(describeDistance(384400 / 149597870.7)).toBe('384,400 km');
		expect(describeDistance((6371 + 408) / 149597870.7, true)).toBe('408 km up');
		expect(describeDistance(NaN)).toBe('—');
	});
	it('light time: 1 AU ≈ 8 min 19 s, Moon ≈ 1.28 s, Neptune > 4 h', () => {
		expect(describeLightTime(1)).toBe('8 min 19 s');
		expect(describeLightTime(384400 / 149597870.7)).toBe('1.3 s');
		expect(describeLightTime(30.07)).toMatch(/^4 h/);
		expect(describeLightTime(1400 / 149597870.7)).toBe('5 ms');
	});
});

describe('ladder and flights', () => {
	it('stops descend monotonically in distance', () => {
		for (let i = 1; i < LADDER.length; i++) expect(LADDER[i].distanceAu).toBeLessThan(LADDER[i - 1].distanceAu);
	});
	it('nearestStop respects the focus body', () => {
		expect(nearestStop('Sun', 40).id).toBe('system');
		expect(nearestStop('Earth', 0.004).id).toBe('earth-moon');
		expect(nearestStop('Earth', 0.00009).id).toBe('earth');
	});
	it('smootherstep is clamped with zero slope at the ends', () => {
		expect(smootherstep(-1)).toBe(0); expect(smootherstep(2)).toBe(1); expect(smootherstep(0.5)).toBeCloseTo(0.5, 9);
	});
	it('flight durations stay within 2–8 s and endpoints are exact', () => {
		const p = planFlight(45, 0.00005, 1);
		expect(p.duration).toBeGreaterThanOrEqual(2); expect(p.duration).toBeLessThanOrEqual(8);
		expect(planFlight(1, 1.01, 0).duration).toBe(2);
		expect(flightDistance(45, 0.00005, 0, p.arc)).toBeCloseTo(45, 6);
		expect(flightDistance(45, 0.00005, 1, p.arc)).toBeCloseTo(0.00005, 12);
	});
	it('a long flight arcs outwards mid-way, never inside the straight log-line', () => {
		const p = planFlight(3.6, 0.0046, 1);
		const straight = Math.exp((Math.log(3.6) + Math.log(0.0046)) / 2);
		expect(flightDistance(3.6, 0.0046, 0.5, p.arc)).toBeGreaterThan(straight);
	});
});

describe('Earth orientation in the 3D scene', () => {
	it('the scene rotation chain puts the Sun over the same place as subsolarPoint()', () => {
		for (const [y, m, d, h] of [[2026, 10, 5, 12], [2026, 3, 20, 3], [2024, 12, 21, 18], [2000, 6, 1, 0]] as const) {
			const jd = jdFromCalendar(y, m, d, h);
			const earth = planetStates(jd)!.find((p) => p.id === 'Earth')!;
			const sun: [number, number, number] = [-earth.x, -earth.y, -earth.z]; // from Earth to the Sun
			const sp = subsolarPoint(jd);
			const a = surfacePointFacing(sun, jd), b = surfacePointFromSceneChain(sun, jd);
			expect(a.lat).toBeCloseTo(sp.latitude, 0);
			expect(Math.abs(((a.lon - sp.longitude + 540) % 360) - 180)).toBeLessThan(0.5);
			expect(b.lat).toBeCloseTo(a.lat, 6);
			expect(Math.abs(((b.lon - a.lon + 540) % 360) - 180)).toBeLessThan(1e-6);
		}
	});
	it('tilt is ≈ −23.4° about x', () => {
		expect(earthOrientation(jdFromCalendar(2026, 1, 1)).tiltRad * 180 / Math.PI).toBeCloseTo(-23.44, 1);
	});
});
