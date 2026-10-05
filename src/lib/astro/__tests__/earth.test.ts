import { describe, expect, it } from 'vitest';
import * as Astronomy from 'astronomy-engine';
import { calendarFromJd, jdFromCalendar, jdFromUnixMs, J2000 } from '../julian';
import { deltaTSeconds, gmstDegrees } from '../time';
import { obliquityDegrees, sunPosition, subsolarPoint } from '../earth';

describe('julian', () => {
	it('matches known epochs', () => {
		expect(jdFromCalendar(2000, 1, 1, 12)).toBeCloseTo(J2000, 9);
		expect(jdFromCalendar(1957, 10, 4, 19, 26, 24)).toBeCloseTo(2436116.31, 2);
	});
	it('round-trips deep past dates', () => {
		for (const y of [-20000, -10000, -1, 0, 1, 1582, 2026, 12000]) {
			const c = calendarFromJd(jdFromCalendar(y, 6, 15, 13, 30, 15));
			expect([c.year, c.month, c.day, c.hour, c.minute]).toEqual([y, 6, 15, 13, 30]);
		}
	});
	it('agrees with Date for unix ms', () => {
		expect(jdFromUnixMs(Date.UTC(2026, 9, 5))).toBeCloseTo(jdFromCalendar(2026, 10, 5), 6);
	});
});

describe('time scales', () => {
	it('ΔT matches published values', () => {
		expect(deltaTSeconds(2000)).toBeCloseTo(63.86, 1);
		expect(deltaTSeconds(1900)).toBeCloseTo(-2.79, 1);
		expect(deltaTSeconds(2020)).toBeCloseTo(71.6, 0);
	});
	it('GMST at J2000 is 280.46°', () => {
		expect(gmstDegrees(J2000)).toBeCloseTo(280.46, 1);
	});
});

describe('Earth orientation vs astronomy-engine', () => {
	it('obliquity today and at ±10 kyr is sane', () => {
		expect(obliquityDegrees(J2000)).toBeCloseTo(23.4393, 3);
		const ice = obliquityDegrees(jdFromCalendar(-10000, 1, 1));
		expect(ice).toBeGreaterThan(23.8);
		expect(ice).toBeLessThan(24.4);
	});
	it('Sun RA/Dec within 0.02° across 1900–2100', () => {
		for (let y = 1900; y <= 2100; y += 20) {
			const jd = jdFromCalendar(y, 3, 17, 6);
			const date = new Date(Date.UTC(y, 2, 17, 6));
			const eq = Astronomy.Equator(Astronomy.Body.Sun, date, new Astronomy.Observer(0, 0, 0), true, true);
			const mine = sunPosition(jd);
			expect(Math.abs(mine.dec - eq.dec)).toBeLessThan(0.02);
			let dra = Math.abs(mine.ra - eq.ra * 15);
			if (dra > 180) dra = 360 - dra;
			expect(dra).toBeLessThan(0.02);
		}
	});
	it('subsolar longitude is plausible at a known moment (equinox 2026-03-20 ~14:46 UTC → lat≈0)', () => {
		const sp = subsolarPoint(jdFromCalendar(2026, 3, 20, 14, 46));
		expect(Math.abs(sp.latitude)).toBeLessThan(0.1);
		// Noon UTC ⇒ subsolar lon ≈ −equation-of-time; 14:46 UTC ⇒ ≈ −41°
		expect(sp.longitude).toBeGreaterThan(-45);
		expect(sp.longitude).toBeLessThan(-37);
	});
});

describe('sunPosition far from today', () => {
	it('keeps the Earth–Sun distance physical (0.94–1.06 AU) at ±100,000 years', () => {
		for (const sign of [-1, 1]) {
			const d = sunPosition(2451545 + sign * 1e5 * 365.25).distanceAu;
			expect(d).toBeGreaterThan(0.94);
			expect(d).toBeLessThan(1.06);
		}
	});
});
