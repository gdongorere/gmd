import { describe, expect, it } from 'vitest';
import { SimClock, describeEpoch, RATE_PRESETS } from '../clock';
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
