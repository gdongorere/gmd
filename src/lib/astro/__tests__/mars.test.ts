import { describe, expect, it } from 'vitest';
import { jdFromCalendar } from '../julian';
import { DATED_STORMS, dustLevel, marsLs, marsSeason } from '../mars';
import { climateAt, iceFraction, seaLevelMetres } from '../climate';

const near = (a: number, b: number, tol: number) => {
	let d = Math.abs(a - b);
	if (d > 180) d = 360 - d;
	expect(d).toBeLessThan(tol);
};

describe('Mars Ls', () => {
	it('matches mission landing dates', () => {
		near(marsLs(jdFromCalendar(1976, 7, 20, 11, 53)), 96, 2); // Viking 1
		near(marsLs(jdFromCalendar(2008, 5, 25, 23, 38)), 76.5, 1.5); // Phoenix
		near(marsLs(jdFromCalendar(2012, 8, 6, 5, 17)), 151, 1.5); // Curiosity
		near(marsLs(jdFromCalendar(2021, 2, 18, 20, 55)), 5.2, 1.5); // Perseverance
	});
	it('labels seasons', () => expect(marsSeason(10)).toBe('Northern spring'));
});

describe('storm catalogue', () => {
	it('dates fall where documented', () => {
		const byId = Object.fromEntries(DATED_STORMS.map((s) => [s.id, s]));
		const y = (jd: number) => 2000 + (jd - 2451545) / 365.25;
		expect(y(byId['1971'].startJd)).toBeGreaterThan(1971.5);
		expect(y(byId['1971'].startJd)).toBeLessThan(1971.85);
		expect(y(byId['2001'].startJd)).toBeGreaterThan(2001.4);
		expect(y(byId['2001'].startJd)).toBeLessThan(2001.7);
		expect(y(byId['2018'].startJd)).toBeGreaterThan(2018.3);
		expect(y(byId['2018'].startJd)).toBeLessThan(2018.6); // ~30 May 2018
	});
	it('dust is high inside a storm, low outside', () => {
		const s = DATED_STORMS.find((x) => x.id === '2018')!;
		expect(dustLevel(s.startJd + 50)).toBeGreaterThan(0.8);
		expect(dustLevel(jdFromCalendar(2019, 6, 1))).toBeLessThan(0.3);
	});
});

describe('ice ages', () => {
	it('LGM ≈ −125…−130 m, today 0, Eemian above today', () => {
		expect(seaLevelMetres(21)).toBe(-130);
		expect(seaLevelMetres(0)).toBe(0);
		expect(seaLevelMetres(125)).toBeGreaterThan(0);
		expect(iceFraction(21)).toBe(1);
	});
	it('applicable window only', () => {
		expect(climateAt(jdFromCalendar(-18000, 1, 1)).iceFraction).toBeGreaterThan(0.9);
		expect(climateAt(jdFromCalendar(2026, 10, 5)).iceFraction).toBeLessThan(0.01);
		expect(climateAt(jdFromCalendar(-5_000_000, 1, 1)).applicable).toBe(false);
	});
});
