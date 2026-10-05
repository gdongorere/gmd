// src/lib/astro/globe.ts
// Pure geometry for the Earth and Mars globes: where the Sun is overhead, how a camera sees a
// body-fixed latitude/longitude, and the inverse (pixel → lat/lon) used by the shader-less canvas.

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export type Vec3 = [number, number, number];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export const latLonToVec = (latDeg: number, lonDeg: number): Vec3 => {
	const la = latDeg * D2R, lo = lonDeg * D2R;
	return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
};

export interface SubSolar { lat: number; lon: number }

/** Rotate a body-fixed vector into the "Sun frame" where the Sun is along +X and +Z is the plane normal. */
export function bodyToSunFrame(v: Vec3, s: SubSolar): Vec3 {
	const lam = s.lon * D2R, del = s.lat * D2R;
	// Rz(−λ)
	const x1 = v[0] * Math.cos(lam) + v[1] * Math.sin(lam);
	const y1 = -v[0] * Math.sin(lam) + v[1] * Math.cos(lam);
	const z1 = v[2];
	// Ry(δ)
	return [x1 * Math.cos(del) + z1 * Math.sin(del), y1, -x1 * Math.sin(del) + z1 * Math.cos(del)];
}

export function sunFrameToBody(v: Vec3, s: SubSolar): Vec3 {
	const lam = s.lon * D2R, del = s.lat * D2R;
	// inverse of Ry(δ)
	const x1 = v[0] * Math.cos(del) - v[2] * Math.sin(del);
	const z1 = v[0] * Math.sin(del) + v[2] * Math.cos(del);
	// inverse of Rz(−λ)
	return [x1 * Math.cos(lam) - v[1] * Math.sin(lam), x1 * Math.sin(lam) + v[1] * Math.cos(lam), z1];
}

export interface GlobeProjector {
	/** Sun direction in camera coordinates (x toward viewer, y right, z up). */
	sun: Vec3;
	toScreen(latDeg: number, lonDeg: number): { u: number; v: number; depth: number };
	/** Inverse for a point on the visible disk (u right, v up, |(u,v)| ≤ 1). */
	fromScreen(u: number, v: number): { lat: number; lon: number; normal: Vec3 } | null;
}

/** Camera looking at the body from azimuth/elevation (degrees) measured in the Sun frame. */
export function makeProjector(s: SubSolar, azDeg: number, elDeg: number): GlobeProjector {
	const az = azDeg * D2R, el = elDeg * D2R;
	const d: Vec3 = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
	const right = norm(cross([0, 0, 1], d));
	const up = cross(d, right);
	const sun: Vec3 = [d[0], right[0], up[0]];
	return {
		sun,
		toScreen(lat, lon) {
			const sf = bodyToSunFrame(latLonToVec(lat, lon), s);
			return { u: dot(sf, right), v: dot(sf, up), depth: dot(sf, d) };
		},
		fromScreen(u, v) {
			const r2 = u * u + v * v;
			if (r2 > 1) return null;
			const w = Math.sqrt(1 - r2);
			const sf: Vec3 = [d[0] * w + right[0] * u + up[0] * v, d[1] * w + right[1] * u + up[1] * v, d[2] * w + right[2] * u + up[2] * v];
			const b = sunFrameToBody(sf, s);
			return { lat: Math.asin(Math.max(-1, Math.min(1, b[2]))) * R2D, lon: Math.atan2(b[1], b[0]) * R2D, normal: [w, u, v] };
		},
	};
}

/** Cosine of the Sun's zenith angle at a surface normal in camera coordinates. */
export const sunLight = (normal: Vec3, sun: Vec3) => dot(normal, sun);

// --- Mars orientation -------------------------------------------------------------------------

import { J2000 } from './julian';
import { jdTtFromUt } from './time';
import { marsLs } from './mars';

const norm360 = (x: number) => ((x % 360) + 360) % 360;
export const MARS_OBLIQUITY = 25.19;
export const MARS_SOL_DAYS = 1.0274912517;

export interface MarsClock {
	ls: number;
	/** Mars Solar Date: sols since the Mars epoch of Allison & McEwen. */
	msd: number;
	/** Coordinated Mars Time at the prime meridian, hours (local mean solar time at 0°). */
	mtc: number;
	subsolar: SubSolar;
}

export function marsOrientation(jdUt: number): MarsClock {
	const ls = marsLs(jdUt);
	const jdTt = jdTtFromUt(jdUt);
	const msd = (jdTt - 2405522.0028779) / MARS_SOL_DAYS;
	const mtc = (((msd % 1) + 1) % 1) * 24;
	// Equation of time (degrees), Allison & McEwen 2000 eq. 20: uses the equation-of-centre part of Ls.
	const d = jdTt - J2000;
	const m = norm360(19.3871 + 0.52402073 * d);
	const alphaFms = 270.3863 + 0.52403840 * d;
	const lsMinusMean = norm360(ls - alphaFms + 180) - 180; // ν − M + PBS
	void m;
	const eotDeg = 2.861 * Math.sin(2 * ls * D2R) - 0.071 * Math.sin(4 * ls * D2R) + 0.002 * Math.sin(6 * ls * D2R) - lsMinusMean;
	const lon = ((-(15 * (mtc - 12) + eotDeg) + 540) % 360 + 360) % 360 - 180;
	const lat = Math.asin(Math.sin(MARS_OBLIQUITY * D2R) * Math.sin(ls * D2R)) * R2D;
	return { ls, msd, mtc, subsolar: { lat, lon } };
}

/** Local true solar time at an east longitude, hours (0–24). */
export function localSolarTime(lonDeg: number, subsolarLon: number): number {
	return (((12 + (lonDeg - subsolarLon) / 15) % 24) + 24) % 24;
}
