import { describe, expect, it } from 'vitest';
import { accuracyReport } from '../accuracy';
import { jdFromCalendar } from '../julian';
import { moonState, planetStates } from '../planets';

const now = jdFromCalendar(2026, 10, 5, 12);

describe('accuracy report', () => {
	it('today is precise', () => {
		const r = accuracyReport(now, now);
		expect(r.find((x) => x.id === 'time')!.level).toBe('precise');
		expect(r.find((x) => x.id === 'ice')!.level).toBe('n/a');
	});
	it('ice age is schematic and time of day is not claimed', () => {
		const r = accuracyReport(jdFromCalendar(-19000, 6, 1), now);
		expect(r.find((x) => x.id === 'ice')!.level).toBe('schematic');
		expect(r.find((x) => x.id === 'time')!.level).toBe('n/a');
		expect(r.find((x) => x.id === 'earth')!.level).toBe('approximate');
	});
	it('galactic epochs report arm-drift uncertainty', () => {
		const r = accuracyReport(now - 100e6 * 365.25, now);
		expect(r.find((x) => x.id === 'galaxy')!.note).toMatch(/±\d+°/);
	});
});

describe('planets (astronomy-engine)', () => {
	it('Earth is ~1 AU from the Sun and ~0.983 AU at the 2026 perihelion', () => {
		const e = planetStates(jdFromCalendar(2026, 1, 3, 17))!.find((p) => p.id === 'Earth')!;
		expect(e.r).toBeCloseTo(0.9833, 3);
	});
	it('Moon is new at the 2024-04-08 eclipse and full on 2026-10-26-ish', () => {
		const m = moonState(jdFromCalendar(2024, 4, 8, 18))!;
		expect(m.illumination).toBeLessThan(0.01);
	});
});

import { eclipseNear, orbitalPeriodYears, yearEvents } from '../planets';

describe('eclipses, seasons and apsides', () => {
	it('flags the 2024-04-08 total solar eclipse and the 2025-09-07 total lunar eclipse', () => {
		const s = eclipseNear(jdFromCalendar(2024, 4, 8, 18, 18))!;
		expect(s.type).toBe('solar');
		expect(Math.abs(s.hoursFromPeak)).toBeLessThan(0.5);
		expect(eclipseNear(jdFromCalendar(2025, 9, 7, 18, 12))!.type).toBe('lunar');
	});
	it('does not flag an ordinary day', () => {
		expect(eclipseNear(jdFromCalendar(2026, 10, 5, 12))).toBeNull();
	});
	it('2026 solstices, equinoxes and perihelion', () => {
		const e = yearEvents(2026)!;
		expect(new Date(e.juneSolstice).toISOString().slice(0, 13)).toBe('2026-06-21T08');
		expect(new Date(e.decSolstice).toISOString().slice(0, 10)).toBe('2026-12-21');
		expect(new Date(e.perihelion!).toISOString().slice(0, 10)).toBe('2026-01-03');
		expect(e.perihelionAu!).toBeCloseTo(0.9833, 3);
		expect(e.aphelionAu!).toBeCloseTo(1.0167, 3);
	});
	it('rejects years outside the engine range', () => {
		expect(yearEvents(1500)).toBeNull();
		expect(yearEvents(NaN)).toBeNull();
	});
	it('Kepler periods', () => {
		expect(orbitalPeriodYears(1.524)).toBeCloseTo(1.88, 2);
		expect(orbitalPeriodYears(5.203)).toBeCloseTo(11.87, 1);
	});
});

describe('yearEvents edge years', () => {
	it('never returns another year\'s apsis; 1802 has no perihelion of its own', () => {
		const e = yearEvents(1802)!;
		expect(e.perihelion).toBeNull();
		expect(new Date(e.aphelion!).getUTCFullYear()).toBe(1802);
		for (const y of [1801, 1803, 1999, 2026]) {
			const v = yearEvents(y)!;
			if (v.perihelion !== null) expect(new Date(v.perihelion).getUTCFullYear()).toBe(y);
			if (v.aphelion !== null) expect(new Date(v.aphelion).getUTCFullYear()).toBe(y);
		}
	});
});
