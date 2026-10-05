// src/lib/astro/mars.ts
// Mars seasons (areocentric solar longitude Ls) after Allison & McEwen (2000, Planet. Space Sci. 48, 215),
// plus the dust-storm record. Ls is accurate to ~0.1° over 1874–2100 and drifts beyond that
// (orbit fixed at J2000 mean elements), so we mark outside-range results as extrapolated.
//
// Constants were entered from memory of the paper and are checked in tests against well-documented
// mission events (Viking 1, Phoenix, Curiosity, Perseverance landings).

import { J2000, MS_PER_DAY, jdFromCalendar } from './julian';
import { jdTtFromUt } from './time';

const D2R = Math.PI / 180;
const norm360 = (x: number) => ((x % 360) + 360) % 360;

const PBS = [
	[0.0071, 2.2353, 49.409], [0.0057, 2.7543, 168.173], [0.0039, 1.1177, 191.837],
	[0.0037, 15.7866, 21.736], [0.0021, 2.1354, 15.704], [0.0020, 2.4694, 95.528], [0.0018, 32.8493, 49.095],
] as const;

/** Areocentric solar longitude Ls (degrees, 0–360) for a UT Julian Date. */
export function marsLs(jdUt: number): number {
	const d = jdTtFromUt(jdUt) - J2000;
	const m = norm360(19.3871 + 0.52402073 * d);
	const alphaFms = 270.3863 + 0.52403840 * d;
	const mr = m * D2R;
	const eoc = (10.691 + 3.0e-7 * d) * Math.sin(mr) + 0.623 * Math.sin(2 * mr) + 0.050 * Math.sin(3 * mr)
		+ 0.005 * Math.sin(4 * mr) + 0.0005 * Math.sin(5 * mr);
	let pbs = 0;
	for (const [a, tau, phi] of PBS) pbs += a * Math.cos(((0.985626 * d) / tau + phi) * D2R);
	return norm360(alphaFms + eoc + pbs);
}

export type MarsSeason = 'Northern spring' | 'Northern summer' | 'Northern autumn' | 'Northern winter';
export function marsSeason(ls: number): MarsSeason {
	if (ls < 90) return 'Northern spring';
	if (ls < 180) return 'Northern summer';
	if (ls < 270) return 'Northern autumn';
	return 'Northern winter';
}

/** Dust-storm season: perihelion (Ls≈251°) → southern summer, Ls 180–360. */
export const isDustSeason = (ls: number) => ls >= 180;

export const MARS_YEAR_DAYS = 686.9726; // Earth days
/** Clancy et al. (2000) convention: Mars Year 1 begins at Ls 0 on 1955 April 11. */
const MY1_START_JD = jdFromCalendar(1955, 4, 11);

/** Julian Date at which Mars Year `my` reaches solar longitude `ls`. */
export function jdOfMarsYearLs(my: number, ls: number): number {
	let jd = MY1_START_JD + (my - 1) * MARS_YEAR_DAYS + (ls / 360) * MARS_YEAR_DAYS;
	for (let i = 0; i < 20; i++) {
		let diff = ls - marsLs(jd);
		if (diff > 180) diff -= 360;
		if (diff < -180) diff += 360;
		if (Math.abs(diff) < 1e-4) break;
		jd += diff * (MARS_YEAR_DAYS / 360);
	}
	return jd;
}

/** Mars Year number (1955 → MY1). Fractional part is not returned; use marsLs for season. */
export function marsYearAt(jdUt: number): number {
	// Account for Ls so the year rolls over at Ls 0, not mid-orbit.
	const ls = marsLs(jdUt);
	const approx = (jdUt - MY1_START_JD) / MARS_YEAR_DAYS;
	let my = Math.floor(approx) + 1;
	const frac = approx - Math.floor(approx);
	if (frac > 0.9 && ls < 30) my += 1;
	if (frac < 0.1 && ls > 330) my -= 1;
	return my;
}

export interface MarsStorm {
	id: string;
	label: string;
	marsYear: number;
	onsetLs: number;
	/** Approximate duration in Earth days until the storm peaked/decayed. */
	durationDays: number;
	kind: 'global' | 'regional';
	summary: string;
	observer: string;
}

export const MARS_STORMS: MarsStorm[] = [
	{ id: '1971', label: 'Great Dust Storm of 1971', marsYear: 9, onsetLs: 260, durationDays: 120, kind: 'global',
		summary: 'Mariner 9 arrived to find the whole planet veiled in dust; only the summits of the great volcanoes showed.', observer: 'Mariner 9' },
	{ id: '1977a', label: 'Viking storm 1977a', marsYear: 12, onsetLs: 204, durationDays: 60, kind: 'global',
		summary: 'The first of two global storms recorded by the Viking landers and orbiters; opacity at the landing sites rose above 3.', observer: 'Viking 1 & 2' },
	{ id: '1977b', label: 'Viking storm 1977b', marsYear: 12, onsetLs: 268, durationDays: 80, kind: 'global',
		summary: 'A second global storm in the same Mars year, the most intense recorded by Viking.', observer: 'Viking 1 & 2' },
	{ id: '2001', label: 'Global dust storm of 2001', marsYear: 25, onsetLs: 184, durationDays: 90, kind: 'global',
		summary: 'Began in Hellas Basin and spread around the planet within weeks, observed by Mars Global Surveyor and Hubble.', observer: 'Mars Global Surveyor, Hubble' },
	{ id: '2007', label: 'Global dust storm of 2007', marsYear: 28, onsetLs: 262, durationDays: 70, kind: 'global',
		summary: 'Cut the solar power of both Mars Exploration Rovers to a small fraction of normal.', observer: 'MER Spirit & Opportunity, MRO' },
	{ id: '2018', label: 'Global dust storm of 2018', marsYear: 34, onsetLs: 185, durationDays: 130, kind: 'global',
		summary: 'Started near Acidalia Planitia in late May 2018, grew into a planet-encircling storm and silenced Opportunity for good.', observer: 'MRO, Curiosity, Opportunity' },
];

export interface DatedStorm extends MarsStorm {
	startJd: number;
	endJd: number;
}

export const DATED_STORMS: DatedStorm[] = MARS_STORMS.map((s) => {
	const startJd = jdOfMarsYearLs(s.marsYear, s.onsetLs);
	return { ...s, startJd, endJd: startJd + s.durationDays };
});

export function stormAt(jd: number): DatedStorm | undefined {
	return DATED_STORMS.find((s) => jd >= s.startJd && jd <= s.endJd);
}

/** Visible dust opacity 0–1 for the globe: catalogued storms ramp up/hold/decay; background by season. */
export function dustLevel(jd: number): number {
	const base = isDustSeason(marsLs(jd)) ? 0.12 : 0.04;
	const s = stormAt(jd);
	if (!s) return base;
	const t = (jd - s.startJd) / (s.endJd - s.startJd);
	const envelope = t < 0.25 ? t / 0.25 : t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45;
	return Math.min(1, base + 0.85 * Math.max(0, envelope));
}

export type MarsConfidence = 'documented' | 'seasonal-model' | 'extrapolated';
export function marsConfidence(jd: number): MarsConfidence {
	const ms = (jd - 2440587.5) * MS_PER_DAY;
	if (ms >= Date.UTC(1971, 0, 1) && ms <= Date.now()) return 'documented';
	if (ms >= Date.UTC(1874, 0, 1) && ms <= Date.UTC(2100, 0, 1)) return 'seasonal-model';
	return 'extrapolated';
}

/** Next/previous catalogued storm relative to jd, for the "jump to storm" controls. */
export function nearestStorm(jd: number, direction: 1 | -1): DatedStorm | undefined {
	const list = [...DATED_STORMS].sort((a, b) => a.startJd - b.startJd);
	return direction > 0 ? list.find((s) => s.startJd > jd + 1) : [...list].reverse().find((s) => s.startJd < jd - 1);
}
