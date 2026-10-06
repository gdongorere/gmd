// src/lib/fly/earth/orbit.ts
// The osculating orbit of the ship around the Earth (two-body, point mass), from its ECEF state. The ECEF velocity is relative to the rotating
// Earth, so the inertial velocity adds Ω×r. Used for the HUD's apoapsis / periapsis / orbital speed so the pilot can see when a burn has
// put the ship into orbit.

import { EARTH, type Vec3 } from './geo';

export interface OrbitInfo {
	/** Speed in the inertial frame (m/s) and the circular-orbit speed at this radius. */
	inertialSpeed: number;
	circularSpeed: number;
	/** Altitudes above the mean radius (m). Apoapsis is null on an escape trajectory. */
	apoapsis: number | null;
	periapsis: number;
	eccentricity: number;
	/** Periapsis clear of the atmosphere (above 100 km): the ship will not come back down by itself. */
	inOrbit: boolean;
}

const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function orbitOf(pos: Vec3, velRotating: Vec3): OrbitInfo {
	const r = pos;
	const v: Vec3 = [velRotating[0] - EARTH.omega * pos[1], velRotating[1] + EARTH.omega * pos[0], velRotating[2]]; // + Ω × r
	const rm = Math.hypot(...r), vm = Math.hypot(...v), mu = EARTH.mu;
	const energy = (vm * vm) / 2 - mu / rm;
	const h = cross(r, v);
	const eVec = cross(v, h).map((c, i) => c / mu - r[i] / rm);
	const e = Math.hypot(eVec[0], eVec[1], eVec[2]);
	void dot;
	const a = energy < 0 ? -mu / (2 * energy) : Infinity;
	const rp = energy < 0 ? a * (1 - e) : (Math.hypot(...h) ** 2 / mu) / (1 + e);
	const ra = energy < 0 ? a * (1 + e) : null;
	return {
		inertialSpeed: vm, circularSpeed: Math.sqrt(mu / rm),
		apoapsis: ra === null ? null : ra - EARTH.R, periapsis: rp - EARTH.R, eccentricity: e,
		inOrbit: rp - EARTH.R > EARTH.karman,
	};
}
