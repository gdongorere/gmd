// src/lib/astro/time.ts
// Time scales: ΔT (TT − UT), sidereal time, and local-time helpers.
// ΔT uses the Espenak & Meeus (2006) polynomials used by NASA's eclipse catalogues.
// Before −500 and after 2150 it is a parabola: an extrapolation, not a measurement.

import { DAYS_PER_YEAR, J2000, decimalYearFromJd } from './julian';

/** ΔT = TT − UT in seconds for a decimal year. */
export function deltaTSeconds(y: number): number {
	const p = (c: number[], t: number) => c.reduceRight((acc, k) => acc * t + k, 0);
	if (y < -500) {
		const u = (y - 1820) / 100;
		return -20 + 32 * u * u;
	}
	if (y < 500) return p([10583.6, -1014.41, 33.78311, -5.952053, -0.1798452, 0.022174192, 0.0090316521], y / 100);
	if (y < 1600) return p([1574.2, -556.01, 71.23472, 0.319781, -0.8503463, -0.005050998, 0.0083572073], (y - 1000) / 100);
	if (y < 1700) {
		const t = y - 1600;
		return 120 - 0.9808 * t - 0.01532 * t * t + (t * t * t) / 7129;
	}
	if (y < 1800) return p([8.83, 0.1603, -0.0059285, 0.00013336, -1 / 1174000], y - 1700);
	if (y < 1860) return p([13.72, -0.332447, 0.0068612, 0.0041116, -0.00037436, 0.0000121272, -0.0000001699, 0.000000000875], y - 1800);
	if (y < 1900) return p([7.62, 0.5737, -0.251754, 0.01680668, -0.0004473624, 1 / 233174], y - 1860);
	if (y < 1920) return p([-2.79, 1.494119, -0.0598939, 0.0061966, -0.000197], y - 1900);
	if (y < 1941) return p([21.2, 0.84493, -0.0761, 0.0020936], y - 1920);
	if (y < 1961) return p([29.07, 0.407, -1 / 233, 1 / 2547], y - 1950);
	if (y < 1986) return p([45.45, 1.067, -1 / 260, -1 / 718], y - 1975);
	if (y < 2005) return p([63.86, 0.3345, -0.060374, 0.0017275, 0.000651814, 0.00002373599], y - 2000);
	if (y < 2050) return p([62.92, 0.32217, 0.005589], y - 2000);
	if (y < 2150) {
		const u = (y - 1820) / 100;
		return -20 + 32 * u * u - 0.5628 * (2150 - y);
	}
	const u = (y - 1820) / 100;
	return -20 + 32 * u * u;
}

/** ΔT for a Julian Date (UT). */
export const deltaTForJd = (jdUt: number) => deltaTSeconds(decimalYearFromJd(jdUt));

/** Terrestrial Time JD from UT JD. */
export const jdTtFromUt = (jdUt: number) => jdUt + deltaTForJd(jdUt) / 86400;

const norm360 = (x: number) => ((x % 360) + 360) % 360;

/** Greenwich mean sidereal time in degrees [0,360) for a UT Julian Date (Meeus 12.4). */
export function gmstDegrees(jdUt: number): number {
	const d = jdUt - J2000;
	const t = d / 36525;
	return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * t * t - (t * t * t) / 38710000);
}

/** How reliable the time scale is at a given instant. */
export type TimeConfidence = 'measured' | 'modelled' | 'extrapolated';

export function timeConfidence(y: number): TimeConfidence {
	if (y >= 1955 && y <= 2026) return 'measured';
	if (y >= -500 && y <= 2150) return 'modelled';
	return 'extrapolated';
}

/** Uncertainty in ΔT (s), after Morrison & Stephenson (2004) / Espenak: grows ~quadratically. */
export function deltaTUncertaintySeconds(y: number): number {
	if (y >= 1955 && y <= 2026) return 0.1;
	if (y >= 1800 && y < 1955) return 2;
	if (y >= 1600 && y < 1800) return 10;
	if (y >= 0 && y < 1600) return 120;
	if (y >= -500 && y < 0) return 420;
	if (y > 2026 && y <= 2150) return 5 + (y - 2026) * 0.4;
	return Math.abs(y - 1820) ** 2 * 0.01 + 600;
}

export interface LocalClock {
	zone: string;
	text: string;
	offsetMinutes: number;
	kind: 'civil' | 'mean-solar';
}

/**
 * Local time for the viewer's IANA zone. Civil zones only mean something where the tz database
 * has data (practically ≥1883) and the date is in the Date range, so earlier we show *local mean
 * solar time* from the viewer's longitude instead: UT + longitude/15 h. Honest, never anachronistic.
 */
export function localClock(jdUt: number, zone: string, longitudeDeg: number, unixMs: number): LocalClock {
	const y = decimalYearFromJd(jdUt);
	const withinDate = Number.isFinite(unixMs) && Math.abs(unixMs) < 8.64e15;
	if (withinDate && y >= 1884) {
		try {
			const dtf = new Intl.DateTimeFormat('en-GB', {
				timeZone: zone, hourCycle: 'h23', year: 'numeric', month: 'short', day: '2-digit',
				hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
			});
			const parts = dtf.formatToParts(new Date(unixMs));
			const get = (t: string) => parts.find((x) => x.type === t)?.value ?? '';
			const asUtc = Date.UTC(+get('year'), ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(get('month')),
				+get('day'), +get('hour'), +get('minute'), +get('second'));
			const offsetMinutes = Math.round((asUtc - Math.floor(unixMs / 1000) * 1000) / 60000);
			return {
				zone, kind: 'civil', offsetMinutes,
				text: `${get('hour')}:${get('minute')}:${get('second')} ${get('timeZoneName')}`,
			};
		} catch {
			/* fall through to mean solar time */
		}
	}
	const offsetMinutes = Math.round((longitudeDeg / 15) * 60);
	const secs = (((jdUt + 0.5) % 1) + 1) % 1 * 86400 + offsetMinutes * 60;
	const s = ((secs % 86400) + 86400) % 86400;
	const hh = String(Math.floor(s / 3600)).padStart(2, '0');
	const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
	const ss = String(Math.floor(s % 60)).padStart(2, '0');
	return { zone, kind: 'mean-solar', offsetMinutes, text: `${hh}:${mm}:${ss} LMT` };
}

export { DAYS_PER_YEAR };
