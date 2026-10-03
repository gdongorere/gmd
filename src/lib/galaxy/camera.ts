// src/lib/galaxy/camera.ts
// Scroll-driven camera flight. The camera orbits a target with spherical
// parameters, so every keyframe blends along smooth arcs instead of straight
// cuts, and the roll is layered on top.

import { CAMERA_REFERENCE_DISTANCE, GALAXY } from './constants';

export interface CameraPose {
	/** Log of the orbit distance (interpolating in log space gives an even dolly). */
	logDistance: number;
	/** Angle from the north galactic pole (0 = face-on, π/2 = edge-on). */
	polar: number;
	/** Orbit azimuth around +Y; 0 puts the Sun at the bottom of the face-on view. */
	azimuth: number;
	targetX: number;
	targetY: number;
	targetZ: number;
}

const DEG = Math.PI / 180;
const pose = (distance: number, polarDeg: number, azimuthDeg: number, target: [number, number, number] = [0, 0, 0]): CameraPose => ({
	logDistance: Math.log(distance),
	polar: polarDeg * DEG,
	azimuth: azimuthDeg * DEG,
	targetX: target[0],
	targetY: target[1],
	targetZ: target[2],
});

const D0 = CAMERA_REFERENCE_DISTANCE;

/** Keyframes at scroll progress 0, ⅓, ⅔, 1. */
export const KEYFRAMES: CameraPose[] = [
	// Face-on from above the north galactic pole: the full spiral.
	pose(D0, 4, 0),
	// Tilted 60° and dollying in.
	pose(D0 * 0.72, 60, 24),
	// Nearly edge-on: the dust lane slices through the bulge.
	pose(D0 * 0.6, 86, -28),
	// From the Sun's neighbourhood, looking towards Sgr A* — the Milky Way as we see it.
	pose(GALAXY.sunRadius + 4, 89.4, 0),
];

const KEYS: (keyof CameraPose)[] = ['logDistance', 'polar', 'azimuth', 'targetX', 'targetY', 'targetZ'];

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
	const t2 = t * t;
	const t3 = t2 * t;
	return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Smooth pose along the keyframe spline for progress p ∈ [0, 1]. */
export function poseAt(progress: number, out: CameraPose): CameraPose {
	const segments = KEYFRAMES.length - 1;
	const scaled = Math.min(Math.max(progress, 0), 1) * segments;
	const i = Math.min(Math.floor(scaled), segments - 1);
	const t = scaled - i;
	const k0 = KEYFRAMES[Math.max(i - 1, 0)];
	const k1 = KEYFRAMES[i];
	const k2 = KEYFRAMES[i + 1];
	const k3 = KEYFRAMES[Math.min(i + 2, segments)];
	for (const key of KEYS) out[key] = catmullRom(k0[key], k1[key], k2[key], k3[key], t);
	return out;
}

/** Ease for the roll so it starts and lands gently. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Critically damped approach toward a target; frame-rate independent. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
	current + (target - current) * (1 - Math.exp(-lambda * dt));
