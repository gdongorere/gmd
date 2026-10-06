// src/lib/fly/earth/sun.ts
// The real Sun and Moon direction in ECEF for any instant (astronomy-engine, the same engine as the rest of the site):
// J2000 equatorial → equator-of-date (precession) → Earth-fixed by Greenwich apparent sidereal time.

import * as Astronomy from 'astronomy-engine';
import { type Vec3, deg } from './geo';

function bodyEcef(body: Astronomy.Body, date: Date): Vec3 {
	const t = Astronomy.MakeTime(date);
	const v = Astronomy.GeoVector(body, t, true);
	const rot = Astronomy.Rotation_EQJ_EQD(t);
	const eqd = Astronomy.RotateVector(rot, v);
	const gast = (Astronomy.SiderealTime(t) * 15 * Math.PI) / 180; // hours → radians
	const c = Math.cos(gast), s = Math.sin(gast);
	// ECEF = Rz(−θ) · equatorial-of-date
	const x = c * eqd.x + s * eqd.y, y = -s * eqd.x + c * eqd.y, z = eqd.z;
	const l = Math.hypot(x, y, z);
	return [x / l, y / l, z / l];
}

/** Unit vector from the Earth's centre toward the Sun, ECEF. */
export const sunEcef = (date: Date): Vec3 => bodyEcef(Astronomy.Body.Sun, date);
export const moonEcef = (date: Date): Vec3 => bodyEcef(Astronomy.Body.Moon, date);

/** Sub-solar point (where the Sun is overhead), degrees. */
export function subsolarPoint(date: Date): { lat: number; lon: number } {
	const [x, y, z] = sunEcef(date);
	return { lat: deg(Math.asin(z)), lon: deg(Math.atan2(y, x)) };
}

/** Sun elevation above the local horizon (deg) at lat/lon degrees. */
export function sunElevation(date: Date, latDeg: number, lonDeg: number): number {
	const [x, y, z] = sunEcef(date);
	const la = (latDeg * Math.PI) / 180, lo = (lonDeg * Math.PI) / 180;
	const up: Vec3 = [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
	return deg(Math.asin(x * up[0] + y * up[1] + z * up[2]));
}
