import { describe, expect, it } from 'vitest';
import { climateAt, kaBpFromJd } from '../climate';
import { jdFromCalendar } from '../julian';

describe('climate time base', () => {
	it('BP is counted from 1950 CE', () => {
		expect(kaBpFromJd(jdFromCalendar(1950, 1, 1))).toBeCloseTo(0, 2);
		expect(kaBpFromJd(jdFromCalendar(-19050, 7, 1))).toBeCloseTo(21, 1);
		expect(kaBpFromJd(jdFromCalendar(1000, 1, 1))).toBeCloseTo(0.95, 2);
	});
	it('Last Glacial Maximum (≈ 21 ka BP) is near full ice and deep sea level', () => {
		const c = climateAt(jdFromCalendar(-19050, 7, 1));
		expect(c.kaBp).toBeCloseTo(21, 1);
		expect(c.iceFraction).toBeGreaterThan(0.95);
		expect(c.applicable).toBe(true);
	});
});
