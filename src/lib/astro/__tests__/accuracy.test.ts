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
