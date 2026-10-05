import { describe, expect, it } from 'vitest';
import { equationOfTimeMinutes, nutation, obliquityDegrees, sunModel, sunPosition, subsolarPoint } from '../earth';
import { jdFromCalendar } from '../julian';

describe('Sun position', () => {
	it('uses the engine in 1800–2200 and Meeus outside', () => {
		expect(sunModel(jdFromCalendar(2026, 10, 5))).toBe('engine');
		expect(sunModel(jdFromCalendar(1500, 1, 1))).toBe('meeus');
		expect(sunModel(jdFromCalendar(-5000, 1, 1))).toBe('meeus');
	});
	it('June solstice 2026: declination ≈ +23.43°, longitude of date ≈ 90°', () => {
		const s = sunPosition(jdFromCalendar(2026, 6, 21, 8, 24));
		expect(s.dec).toBeCloseTo(23.43, 1);
		expect(s.lambda).toBeCloseTo(90, 1);
	});
	it('March equinox 2025 (09:01 UTC): declination ≈ 0, RA ≈ 0', () => {
		const s = sunPosition(jdFromCalendar(2025, 3, 20, 9, 1));
		expect(Math.abs(s.dec)).toBeLessThan(0.05);
	});
	it('engine and Meeus agree to a few arcminutes at the boundary', () => {
		const a = sunPosition(jdFromCalendar(2100, 3, 1)), b = sunPosition(jdFromCalendar(2201, 3, 1));
		expect(a.dec).toBeGreaterThan(-8); expect(a.dec).toBeLessThan(-6);
		expect(b.dec).toBeGreaterThan(-8); expect(b.dec).toBeLessThan(-6);
	});
	it('obliquity matches e_tilt (true obliquity ≈ 23.436° in 2026)', () => {
		expect(sunPosition(jdFromCalendar(2026, 1, 1)).obliquity).toBeCloseTo(23.436, 2);
		expect(obliquityDegrees(jdFromCalendar(2026, 1, 1))).toBeCloseTo(23.436, 2);
	});
	it('sub-solar latitude equals declination', () => {
		const jd = jdFromCalendar(2026, 10, 5, 12);
		expect(subsolarPoint(jd).latitude).toBeCloseTo(sunPosition(jd).dec, 9);
	});
});

describe('nutation', () => {
	it('matches Meeus example (1987-04-10): Δψ ≈ −3.788″, Δε ≈ +9.443″', () => {
		const n = nutation(jdFromCalendar(1987, 4, 10));
		expect(n.dPsi * 3600).toBeCloseTo(-3.788, 0);
		expect(n.dEps * 3600).toBeCloseTo(9.443, 0);
	});
});

describe('equation of time', () => {
	it('Meeus example 1992-10-13 ≈ +13m42s', () => {
		expect(equationOfTimeMinutes(jdFromCalendar(1992, 10, 13))).toBeCloseTo(13.71, 0);
	});
	it('early-November maximum ≈ +16.4 min and mid-February minimum ≈ −14.2 min', () => {
		expect(equationOfTimeMinutes(jdFromCalendar(2026, 11, 3, 12))).toBeGreaterThan(16);
		expect(equationOfTimeMinutes(jdFromCalendar(2026, 2, 11, 12))).toBeLessThan(-13.8);
	});
	it('is near zero around 16 April and 25 December', () => {
		expect(Math.abs(equationOfTimeMinutes(jdFromCalendar(2026, 4, 15, 12)))).toBeLessThan(1);
		expect(Math.abs(equationOfTimeMinutes(jdFromCalendar(2026, 12, 25, 12)))).toBeLessThan(1);
	});
});

import { jdFromDecimalYear } from '../julian';
describe('obliquity swing', () => {
	it('was near its ~24.2° maximum in the early Holocene and falls toward ~22.6° by 12000 CE', () => {
		const e = (y: number) => obliquityDegrees(jdFromDecimalYear(y));
		let lo = 99, hi = 0;
		for (let y = -8000; y <= 12000; y += 100) { lo = Math.min(lo, e(y)); hi = Math.max(hi, e(y)); }
		expect(hi).toBeGreaterThan(24.0); expect(hi).toBeLessThan(24.6);
		expect(lo).toBeGreaterThan(22.5); expect(lo).toBeLessThan(22.7);
		expect(e(2000)).toBeCloseTo(23.439, 2);
	});
});

describe('deep-time Sun uses TT (ΔT is hours at the ice-age presets)', () => {
	it('Meeus fallback at the LGM differs from a UT-as-TT evaluation by more than a minute of Sun motion', () => {
		const jd = jdFromCalendar(-19050, 1, 15, 12);
		const a = sunPosition(jd), b = sunPosition(jd + 1 / 24);
		expect(Math.abs(b.lambda - a.lambda)).toBeGreaterThan(0.01); // sanity: the Sun moves ~0.04°/h
		expect(sunModel(jd)).toBe('meeus');
	});
});
