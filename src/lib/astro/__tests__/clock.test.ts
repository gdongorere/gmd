import { describe, expect, it } from 'vitest';
import { SimClock, describeEpoch, parseTimeParam, MAX_ABS_YEARS, RATE_PRESETS } from '../clock';
import { J2000, DAYS_PER_YEAR } from '../julian';
import { jdFromCalendar, jdFromUnixMs } from '../julian';

const make = () => {
	let wall = Date.UTC(2026, 9, 5, 12, 0, 0);
	let perf = 1000;
	const clock = new SimClock(() => wall, () => perf);
	return { clock, tick: (ms: number) => { wall += ms; perf += ms; } };
};

describe('SimClock', () => {
	it('boots at the real current time', () => {
		const { clock } = make();
		expect(clock.jd()).toBeCloseTo(jdFromUnixMs(Date.UTC(2026, 9, 5, 12)), 8);
		expect(clock.snapshot().live).toBe(true);
	});
	it('runs forward and backward at any rate', () => {
		const { clock, tick } = make();
		const start = clock.jd();
		clock.setRate(86400); // 1 day per second
		tick(2000);
		expect(clock.jd() - start).toBeCloseTo(2, 6);
		clock.setRate(-86400);
		tick(3000);
		expect(clock.jd() - start).toBeCloseTo(-1, 6);
	});
	it('pause freezes, now() snaps back', () => {
		const { clock, tick } = make();
		clock.setJd(jdFromCalendar(-19000, 1, 1));
		clock.setPlaying(false);
		const frozen = clock.jd();
		tick(5000);
		expect(clock.jd()).toBe(frozen);
		clock.now();
		expect(clock.snapshot().live).toBe(true);
	});
	it('presets are ordered and positive', () => {
		for (let i = 1; i < RATE_PRESETS.length; i++) expect(RATE_PRESETS[i].secondsPerSecond).toBeGreaterThan(RATE_PRESETS[i - 1].secondsPerSecond);
	});
});

describe('describeEpoch', () => {
	const now = jdFromCalendar(2026, 10, 5, 12);
	it('present', () => expect(describeEpoch(now, now).relative).toBe('now'));
	it('ice age', () => {
		const l = describeEpoch(jdFromCalendar(-19000, 6, 1), now);
		expect(l.date).toContain('BCE');
		expect(l.time).toBe('');
		expect(l.relative).toContain('years ago');
	});
	it('galactic', () => {
		const l = describeEpoch(now - 203e6 * 365.25, now);
		expect(l.coarse).toBe(true);
		expect(l.date).toContain('Myr');
	});
});

describe('SimClock robustness', () => {
	it('ignores NaN and infinite jumps and rates', () => {
		const { clock } = make();
		const before = clock.jd();
		clock.setJd(NaN);
		clock.setJd(Infinity);
		clock.setRate(NaN);
		expect(clock.jd()).toBeCloseTo(before, 8);
		expect(clock.rate).toBe(1);
	});
	it('clamps to ±2 billion years', () => {
		const { clock } = make();
		clock.setJd(1e30);
		expect(clock.jd()).toBeCloseTo(J2000 + MAX_ABS_YEARS * DAYS_PER_YEAR, 0);
		clock.setJd(-1e30);
		expect(clock.jd()).toBeCloseTo(J2000 - MAX_ABS_YEARS * DAYS_PER_YEAR, 0);
	});
});

describe('parseTimeParam', () => {
	it('rejects missing and garbage input', () => {
		for (const bad of [null, undefined, '', '  ', 'abc', 'NaN', 'Infinity', '-Infinity']) expect(parseTimeParam(bad)).toBeNull();
	});
	it('accepts ordinary and negative (deep past) Julian Dates', () => {
		expect(parseTimeParam('2461318.5')).toBeCloseTo(2461318.5, 6);
		const mya66 = J2000 - 66e6 * DAYS_PER_YEAR;
		expect(parseTimeParam(String(mya66))).toBeCloseTo(mya66, 0);
	});
	it('clamps absurd values instead of rejecting them', () => {
		expect(parseTimeParam('1e300')).toBeCloseTo(J2000 + MAX_ABS_YEARS * DAYS_PER_YEAR, 0);
	});
});

describe('describeEpoch boundaries', () => {
	const now = jdFromCalendar(2026, 10, 5, 12);
	it('shows time of day within the last ~2,500 years but not before', () => {
		expect(describeEpoch(jdFromCalendar(1500, 1, 1, 12), now).time).not.toBe('');
		expect(describeEpoch(jdFromCalendar(-1000, 1, 1, 12), now).time).toBe('');
	});
	it('switches to coarse Myr labels beyond one million years', () => {
		expect(describeEpoch(now - 0.9e6 * DAYS_PER_YEAR, now).coarse).toBe(false);
		expect(describeEpoch(now - 1.1e6 * DAYS_PER_YEAR, now).coarse).toBe(true);
	});
	it('uses days for sub-year offsets and future labels', () => {
		expect(describeEpoch(now - 10, now).relative).toBe('10 days ago');
		expect(describeEpoch(now + 10, now).relative).toBe('in 10 days');
		expect(describeEpoch(now + 5 * DAYS_PER_YEAR, now).relative).toBe('in 5 years');
	});
});
