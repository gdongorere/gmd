// src/lib/astro/climate.ts
// A schematic of Earth's ice ages for the time machine's deep-past view.
//
// The sea-level curve below is a coarse piecewise-linear reconstruction through well-known
// landmarks (Spratt & Lisiecki 2016; Lambeck et al. 2014; Clark et al. 2009), entered from memory
// and rounded. It is a SCHEMATIC with uncertainties of tens of metres and thousands of years in the
// older part — NOT a data product. The UI says so wherever it is used.

import { decimalYearFromJd } from './julian';

/** [thousand years before present, global sea level relative to today in metres]. */
const SEA_LEVEL: [number, number][] = [
	[0, 0], [2, -1], [6, -2], [8, -15], [10, -40], [12, -70], [14, -90], [16, -115], [19, -125], [21, -130],
	[24, -122], [29, -80], [35, -75], [45, -75], [55, -70], [65, -75], [72, -85], [80, -45], [90, -30],
	[100, -50], [110, -50], [118, -10], [123, 4], [128, 7], [133, -15], [138, -60], [150, -100], [160, -110],
	[172, -70], [185, -100], [195, -70], [205, -35], [215, -80], [225, -100], [240, -10], [245, -70], [260, -90],
	[285, -100], [300, -80], [320, -40], [330, -5], [340, -50], [360, -90], [380, -70], [400, -20], [410, 5],
	[420, 0], [430, -30], [450, -110], [470, -60], [490, -80], [510, -20], [520, 0], [545, -90], [580, -100],
	[620, -80], [640, -10], [650, -90], [700, -100], [750, -90], [800, -110],
];

export const ICE_AGE_RANGE_KA = 800;

/** Global mean sea level relative to the present (m) at `kaBp` thousand years before present. */
export function seaLevelMetres(kaBp: number): number {
	if (kaBp <= 0) return 0;
	if (kaBp >= SEA_LEVEL[SEA_LEVEL.length - 1][0]) return SEA_LEVEL[SEA_LEVEL.length - 1][1];
	let i = 1;
	while (SEA_LEVEL[i][0] < kaBp) i++;
	const [a0, v0] = SEA_LEVEL[i - 1];
	const [a1, v1] = SEA_LEVEL[i];
	return v0 + ((v1 - v0) * (kaBp - a0)) / (a1 - a0);
}

/** 0 = today's (interglacial) ice, 1 = full Last Glacial Maximum ice (≈ −130 m). */
export const iceFraction = (kaBp: number) => Math.min(1, Math.max(0, -seaLevelMetres(kaBp) / 130));

/** Southern edge of the northern ice sheets (degrees N): Laurentide reaches ~38°, Fennoscandian ~52°. */
export function iceEdgeLatitudes(kaBp: number): { northAmerica: number; eurasia: number } {
	const f = iceFraction(kaBp);
	// Even today Greenland sits at ~60–83°N, so the edge never goes below ~68° for the sketch.
	return { northAmerica: 70 - f * 32, eurasia: 70 - f * 18 };
}

export interface ClimateState {
	kaBp: number;
	seaLevel: number;
	iceFraction: number;
	label: string;
	applicable: boolean;
}

/** Thousand years before present, where "present" is 1950 CE by convention. */
export const kaBpFromJd = (jd: number) => (1950 - decimalYearFromJd(jd)) / 1000;

/** The state to show at a Julian Date; `applicable` is false when the view is out of the schematic's range. */
export function climateAt(jd: number): ClimateState {
	const kaBp = kaBpFromJd(jd);
	const f = iceFraction(kaBp);
	const sea = seaLevelMetres(kaBp);
	let label = 'Interglacial — ice like today';
	if (f > 0.85) label = 'Glacial maximum — ice sheets to ~40°N';
	else if (f > 0.5) label = 'Ice age — sea level 60–110 m lower';
	else if (f > 0.15) label = 'Deglaciation / transition';
	if (kaBp > 118 && kaBp < 130) label = 'Eemian interglacial — warmer and higher seas than today';
	return { kaBp, seaLevel: sea, iceFraction: f, label, applicable: kaBp > 0.5 && kaBp <= ICE_AGE_RANGE_KA };
}

const smooth = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};

/**
 * Ice cover (0–1) of a LAND point at a latitude/longitude, for the schematic globe: permanent
 * Antarctic and Greenland ice plus the ice-age sheets (Laurentide, Fennoscandian, Siberian fringe,
 * Patagonian). `f` is `iceFraction`, `edge` is `iceEdgeLatitudes`.
 */
export function iceCover(lat: number, lon: number, f: number, edge: { northAmerica: number; eurasia: number }): number {
	if (lat < -62) return 1;
	if (lat > 59 && lat < 84 && lon > -74 && lon < -11) return 1;
	if (f <= 0.02) return 0;
	if (lon > -168 && lon < -52) return smooth(edge.northAmerica - 1.5, edge.northAmerica + 1.5, lat);
	if (lon > -12 && lon < 60) return smooth(edge.eurasia - 1.5, edge.eurasia + 1.5, lat);
	if (lat > 0) return smooth(72 - f * 4 - 1.5, 72 - f * 4 + 1.5, lat);
	if (f > 0.25 && lat < -44 && lon > -78 && lon < -62) return f;
	return 0;
}
