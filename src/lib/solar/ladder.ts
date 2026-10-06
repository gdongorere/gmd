// src/lib/solar/ladder.ts
// Scale-ladder maths for the 3D solar system: stops from the whole system down to Earth's sky,
// human-readable distances and light-time, and the easing used by the descent. Pure, so it is unit-tested.

export const KM_PER_AU = 149_597_870.7;
export const LIGHT_SECONDS_PER_AU = 499.004784;
export const EARTH_RADIUS_AU = 6371 / KM_PER_AU;

export interface LadderStop {
	id: 'system' | 'inner' | 'earth-moon' | 'earth';
	label: string;
	/** Compact label for narrow screens. */
	short: string;
	/** Body the camera looks at. */
	focus: 'Sun' | 'Earth';
	/** Camera distance from the focus, AU. */
	distanceAu: number;
	/** One-line caption shown during the descent, with a real number. */
	caption: (jd: number) => string;
	hint: string;
}

export const LADDER: LadderStop[] = [
	{ id: 'system', label: 'Solar System', short: 'System', focus: 'Sun', distanceAu: 45, hint: 'All eight planets, out to Neptune at 30 AU',
		caption: () => 'The Solar System: eight planets, and light takes over four hours to reach Neptune.' },
	{ id: 'inner', label: 'Inner planets', short: 'Inner', focus: 'Sun', distanceAu: 3.6, hint: 'Mercury to Mars, where the rocky worlds live',
		caption: () => 'The inner planets. Earth is 1 AU from the Sun: light covers it in 8 minutes 20 seconds.' },
	{ id: 'earth-moon', label: 'Earth–Moon', short: 'Moon', focus: 'Earth', distanceAu: 0.0046, hint: 'The Moon, 384,400 km away on average',
		caption: () => 'Earth and the Moon, about 384,400 km apart: light takes 1.3 seconds to cross.' },
	{ id: 'earth', label: 'Earth', short: 'Earth', focus: 'Earth', distanceAu: (6371 + 1400) / KM_PER_AU, hint: 'Down to a low orbit above the day–night line',
		caption: () => 'Earth, from about 1,400 km up. The day–night line is where it is right now.' },
];

export const minStopDistanceAu = LADDER[LADDER.length - 1].distanceAu;
export const MIN_DISTANCE_AU = EARTH_RADIUS_AU * 1.05;
export const MAX_DISTANCE_AU = 120;

export const smootherstep = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * x * (x * (x * 6 - 15) + 10); };

/** Which ladder stop a camera `distanceAu` from `focus` is closest to, on a log scale. */
export function nearestStop(focus: string, distanceAu: number): LadderStop {
	let best = LADDER[0], bd = Infinity;
	for (const s of LADDER) {
		const sameFocus = s.focus === focus ? 0 : 1.5; // a focus change counts as ~4.5× in distance
		const d = Math.abs(Math.log(distanceAu / s.distanceAu)) + sameFocus;
		if (d < bd) { bd = d; best = s; }
	}
	return best;
}

/** "1.3 AU", "384,400 km", "408 km up" style distance. `altitudeOfEarth` subtracts Earth's radius. */
export function describeDistance(au: number, altitudeOfEarth = false): string {
	if (!Number.isFinite(au) || au < 0) return '—';
	if (altitudeOfEarth) {
		const km = au * KM_PER_AU - 6371;
		if (km < 100_000) return `${Math.max(0, Math.round(km)).toLocaleString('en-US')} km up`;
	}
	if (au >= 0.05) return `${au >= 10 ? au.toFixed(1) : au.toFixed(2)} AU`;
	return `${Math.round(au * KM_PER_AU).toLocaleString('en-US')} km`;
}

/** Light-travel time over `au`, e.g. "8 min 20 s", "1.3 s", "4 h 10 min". */
export function describeLightTime(au: number): string {
	if (!Number.isFinite(au) || au < 0) return '—';
	const s = au * LIGHT_SECONDS_PER_AU;
	if (s < 0.1) return `${Math.max(1, Math.round(s * 1000))} ms`;
	if (s < 10) return `${s.toFixed(s < 1 ? 2 : 1)} s`;
	if (s < 60) return `${Math.round(s)} s`;
	if (s < 3600) { const m = Math.floor(s / 60); return `${m} min ${String(Math.round(s - m * 60)).padStart(2, '0')} s`; }
	const h = Math.floor(s / 3600);
	return `${h} h ${Math.round((s - h * 3600) / 60)} min`;
}

export interface FlightPlan {
	/** Seconds, scaled by how far the camera travels (log distance), bounded 2–8 s as the design asks. */
	duration: number;
	/** Extra log-distance the camera rises mid-flight so a long hop swings out and back in instead of cutting through bodies. */
	arc: number;
}

export function planFlight(fromAu: number, toAu: number, travelAu: number): FlightPlan {
	const logTravel = Math.abs(Math.log(Math.max(1e-9, toAu / fromAu)));
	const hop = Math.log(Math.max(1, travelAu / Math.max(1e-9, Math.min(fromAu, toAu))));
	return { duration: Math.min(8, Math.max(2, 1.2 + logTravel * 0.8)), arc: Math.min(2.5, hop * 0.35) };
}

/** Camera distance at flight progress s ∈ [0,1], log-interpolated with a mid-flight arc. */
export function flightDistance(fromAu: number, toAu: number, s: number, arc: number): number {
	const e = smootherstep(s);
	return Math.exp(Math.log(fromAu) + (Math.log(toAu) - Math.log(fromAu)) * e + arc * Math.sin(Math.PI * e));
}
