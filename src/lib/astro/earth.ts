// src/lib/astro/earth.ts
// Earth's orientation: obliquity, the Sun's apparent position and the sub-solar point.
// Sun: astronomy-engine (VSOP87, apparent, with nutation) for 1800–2200; Meeus ch. 25 (≈0.01° within a few
// centuries of J2000, degrading over millennia) everywhere else.
// Obliquity: Laskar (1986) polynomial, valid ±10,000 years; clamped beyond that.

import * as Astronomy from 'astronomy-engine';
import { J2000, decimalYearFromJd } from './julian';
import { unixMsOrNaN } from './clock';
import { gmstDegrees } from './time';

const D2R = Math.PI / 180;
const norm360 = (x: number) => ((x % 360) + 360) % 360;

/** Mean obliquity of the ecliptic in degrees (Laskar 1986). */
export function obliquityDegrees(jd: number): number {
	const u = Math.max(-1, Math.min(1, (jd - J2000) / 3652500));
	const c = [23 + 26 / 60 + 21.448 / 3600, -4680.93 / 3600, -1.55 / 3600, 1999.25 / 3600, -51.38 / 3600,
		-249.67 / 3600, -39.05 / 3600, 7.12 / 3600, 27.87 / 3600, 5.79 / 3600, 2.45 / 3600];
	return c.reduceRight((acc, k) => acc * u + k, 0);
}

export interface SunEquatorial {
	/** Apparent ecliptic longitude of date, degrees. */
	lambda: number;
	ra: number; // degrees
	dec: number; // degrees
	distanceAu: number;
	obliquity: number;
}

export const ENGINE_SUN_RANGE: [number, number] = [1800, 2200];

/** Apparent Sun of date from astronomy-engine, or null outside its trusted years / JS Date range. */
function engineSun(jd: number): SunEquatorial | null {
	const y = decimalYearFromJd(jd);
	if (y < ENGINE_SUN_RANGE[0] || y > ENGINE_SUN_RANGE[1]) return null;
	const ms = unixMsOrNaN(jd);
	if (Number.isNaN(ms)) return null;
	const time = Astronomy.MakeTime(new Date(ms));
	const eqd = Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(time), Astronomy.GeoVector(Astronomy.Body.Sun, time, true));
	const eq = Astronomy.EquatorFromVector(eqd);
	const ecl = Astronomy.SunPosition(time);
	return { lambda: ecl.elon, ra: eq.ra * 15, dec: eq.dec, distanceAu: eq.dist, obliquity: Astronomy.e_tilt(time).tobl };
}

/**
 * Sun's apparent geocentric position. astronomy-engine within 1800–2200, otherwise the low-precision Meeus 25
 * series (`jd` is TT≈UT there: ΔT ≤ 70 s is below that model's error).
 */
export function sunPosition(jd: number): SunEquatorial {
	return engineSun(jd) ?? meeusSun(jd);
}

/** Which model {@link sunPosition} used at this instant. */
export const sunModel = (jd: number): 'engine' | 'meeus' => (engineSun(jd) ? 'engine' : 'meeus');

/** Nutation in longitude and obliquity, degrees (Meeus 22, four largest terms, ≈0.5″). */
export function nutation(jd: number): { dPsi: number; dEps: number } {
	const t = (jd - J2000) / 36525;
	const om = norm360(125.04452 - 1934.136261 * t) * D2R;
	const l = norm360(280.4665 + 36000.7698 * t) * 2 * D2R;
	const lm = norm360(218.3165 + 481267.8813 * t) * 2 * D2R;
	return {
		dPsi: (-17.2 * Math.sin(om) - 1.32 * Math.sin(l) - 0.23 * Math.sin(lm) + 0.21 * Math.sin(2 * om)) / 3600,
		dEps: (9.2 * Math.cos(om) + 0.57 * Math.cos(l) + 0.1 * Math.cos(lm) - 0.09 * Math.cos(2 * om)) / 3600,
	};
}

/**
 * Equation of time in minutes (apparent minus mean solar time; positive = sundial ahead of the clock):
 * 4 min per degree of (mean longitude − 0.0057183° − right ascension + Δψ cos ε), Meeus 28.
 */
export function equationOfTimeMinutes(jd: number): number {
	const t = (jd - J2000) / 36525;
	const l0 = norm360(280.4664567 + 36000.76982779 * t + 0.03032028 * t * t);
	const { dPsi } = nutation(jd);
	const s = sunPosition(jd);
	let e = l0 - 0.0057183 - s.ra + dPsi * Math.cos(s.obliquity * D2R);
	e = ((e + 180) % 360 + 360) % 360 - 180;
	return 4 * e;
}

function meeusSun(jd: number): SunEquatorial {
	const t = (jd - J2000) / 36525;
	const l0 = norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
	const m = norm360(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
	// The linear polynomial is only valid for a few millennia; Earth's eccentricity stays within ≈ 0.0034–0.058.
	const e = Math.min(0.058, Math.max(0.0034, 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t));
	const mr = m * D2R;
	const c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * Math.sin(mr)
		+ (0.019993 - 0.000101 * t) * Math.sin(2 * mr) + 0.000289 * Math.sin(3 * mr);
	const trueLon = l0 + c;
	const nu = (m + c) * D2R;
	const distanceAu = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(nu));
	const omega = 125.04 - 1934.136 * t;
	const lambda = trueLon - 0.00569 - 0.00478 * Math.sin(omega * D2R);
	const eps = obliquityDegrees(jd) + 0.00256 * Math.cos(omega * D2R);
	const lr = lambda * D2R;
	const er = eps * D2R;
	const ra = norm360(Math.atan2(Math.cos(er) * Math.sin(lr), Math.cos(lr)) / D2R);
	const dec = Math.asin(Math.sin(er) * Math.sin(lr)) / D2R;
	return { lambda: norm360(lambda), ra, dec, distanceAu, obliquity: eps };
}

export interface SubsolarPoint {
	latitude: number; // = solar declination
	longitude: number; // −180…180, east positive
}

/** Where the Sun is directly overhead. Longitude = RA − GMST. */
export function subsolarPoint(jdUt: number): SubsolarPoint {
	const s = sunPosition(jdUt);
	let lon = s.ra - gmstDegrees(jdUt);
	lon = ((lon + 540) % 360) - 180;
	return { latitude: s.dec, longitude: lon };
}

/** Solar elevation (degrees, no refraction) at a place. */
export function solarElevation(jdUt: number, latDeg: number, lonDeg: number): number {
	const sp = subsolarPoint(jdUt);
	const la = latDeg * D2R, sl = sp.latitude * D2R, dl = (lonDeg - sp.longitude) * D2R;
	return Math.asin(Math.sin(la) * Math.sin(sl) + Math.cos(la) * Math.cos(sl) * Math.cos(dl)) / D2R;
}
