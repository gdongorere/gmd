// src/lib/astro/planets.ts
// Planet and Moon positions from astronomy-engine (VSOP87 / Meeus-derived, MIT). Lazily imported by
// the solar view so the galaxy page does not pay for it.

import * as Astronomy from 'astronomy-engine';
import { decimalYearFromJd } from './julian';
import { unixMsOrNaN } from './clock';

export const PLANETS = [
	{ id: 'Mercury', body: Astronomy.Body.Mercury, color: '#b8a99a', a: 0.387, radiusKm: 2439.7 },
	{ id: 'Venus', body: Astronomy.Body.Venus, color: '#e8cda0', a: 0.723, radiusKm: 6051.8 },
	{ id: 'Earth', body: Astronomy.Body.Earth, color: '#5ab0ff', a: 1.0, radiusKm: 6371 },
	{ id: 'Mars', body: Astronomy.Body.Mars, color: '#e2724a', a: 1.524, radiusKm: 3389.5 },
	{ id: 'Jupiter', body: Astronomy.Body.Jupiter, color: '#d9b38c', a: 5.203, radiusKm: 69911 },
	{ id: 'Saturn', body: Astronomy.Body.Saturn, color: '#e8d8a0', a: 9.537, radiusKm: 58232 },
	{ id: 'Uranus', body: Astronomy.Body.Uranus, color: '#9fe3e8', a: 19.19, radiusKm: 25362 },
	{ id: 'Neptune', body: Astronomy.Body.Neptune, color: '#6a8cff', a: 30.07, radiusKm: 24622 },
] as const;

export type PlanetId = (typeof PLANETS)[number]['id'];

export interface PlanetState {
	id: PlanetId;
	/** Heliocentric ecliptic coordinates (J2000), AU. */
	x: number;
	y: number;
	z: number;
	r: number;
}

let eclRotation: Astronomy.RotationMatrix | null = null;

function toEcliptic(v: Astronomy.Vector) {
	eclRotation ??= Astronomy.Rotation_EQJ_ECL();
	const e = Astronomy.RotateVector(eclRotation, v);
	return { x: e.x, y: e.y, z: e.z };
}

/** Heliocentric positions of all eight planets, or null when the date is outside JS Date's range. */
export function planetStates(jd: number): PlanetState[] | null {
	const ms = unixMsOrNaN(jd);
	if (Number.isNaN(ms)) return null;
	const date = new Date(ms);
	return PLANETS.map((p) => {
		const e = toEcliptic(Astronomy.HelioVector(p.body, date));
		return { id: p.id, ...e, r: Math.hypot(e.x, e.y, e.z) };
	});
}

export interface MoonState {
	/** 0 new … 0.5 full … 1 new (fraction of the synodic cycle, by ecliptic elongation). */
	cycle: number;
	illumination: number;
	phaseName: string;
	/** Geocentric distance, km. */
	distanceKm: number;
}

const PHASE_NAMES = ['New Moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full Moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];

export function moonState(jd: number): MoonState | null {
	const ms = unixMsOrNaN(jd);
	if (Number.isNaN(ms)) return null;
	const date = new Date(ms);
	const angle = Astronomy.MoonPhase(date);
	const cycle = angle / 360;
	const illum = Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction;
	const geo = Astronomy.GeoMoon(date);
	return { cycle, illumination: illum, phaseName: PHASE_NAMES[Math.floor(((angle + 22.5) % 360) / 45)], distanceKm: Math.hypot(geo.x, geo.y, geo.z) * Astronomy.KM_PER_AU };
}

export type PlanetConfidence = 'precise' | 'good' | 'illustrative';

/** How far to trust planet positions at this epoch. */
export function planetConfidence(jd: number): { level: PlanetConfidence; note: string } {
	const y = decimalYearFromJd(jd);
	if (y >= 1800 && y <= 2200) return { level: 'precise', note: 'Planet positions good to about an arcminute (VSOP87-class model).' };
	if (y >= -3000 && y <= 6000) return { level: 'good', note: 'Positions good to a fraction of a degree, degrading with distance from today.' };
	return { level: 'illustrative', note: 'Orbit shapes are right but planet positions this far from today are illustrative, not predictions.' };
}
