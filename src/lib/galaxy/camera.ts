// src/lib/galaxy/camera.ts
// Camera poses and flight. The camera orbits a target using spherical parameters, so
// every blend between two views travels along a smooth arc rather than a straight cut.

import { CAMERA_REFERENCE_DISTANCE, GALAXY, fromSun } from './constants';

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
	/** Roll around the view axis, radians. Scaled by the visitor's roll setting. */
	roll: number;
}

export type GalaxyViewName = 'face-on' | 'tilted' | 'edge-on' | 'arm-flyby' | 'core' | 'home' | 'lmc' | 'halo';

const DEG = Math.PI / 180;
const D0 = CAMERA_REFERENCE_DISTANCE;

const pose = (
	distance: number, polarDeg: number, azimuthDeg: number,
	target: [number, number, number] = [0, 0, 0], rollDeg = 0,
): CameraPose => ({
	logDistance: Math.log(distance),
	polar: polarDeg * DEG,
	azimuth: azimuthDeg * DEG,
	targetX: target[0],
	targetY: target[1],
	targetZ: target[2],
	roll: rollDeg * DEG,
});

const lmc = fromSun(GALAXY.lmc.distance, GALAXY.lmc.l, GALAXY.lmc.b);

/** Perseus crosses the Sun–centre line at ~9.8 kpc (≈ 318 units): a good arm to skim along. */
const PERSEUS_AT_SUN_LINE: [number, number, number] = [318, 0, 0];

export const VIEWS: Record<GalaxyViewName, CameraPose> = {
	/** The full spiral from above the north galactic pole. */
	'face-on': pose(D0, 4, 0),
	/** Tilted 60° and a little closer. */
	tilted: pose(D0 * 0.72, 60, 24),
	/** Nearly edge-on: the dust lane slices through the bulge. */
	'edge-on': pose(D0 * 0.6, 86, -28),
	/** Low pass along the Perseus arm, through the star-forming knots. */
	'arm-flyby': pose(170, 74, 35, PERSEUS_AT_SUN_LINE),
	/** Close to Sgr A*. */
	core: pose(140, 62, 10, [0, 0, 0], 15),
	/** From the Sun's neighbourhood looking towards the centre: the Milky Way as we see it. The roll
	 *  of a full turn lands upright, so travelling here from `edge-on` spins the galaxy once. */
	home: pose(GALAXY.sunRadius + 4, 89.4, 0, [0, 0, 0], 360),
	/** Out to the Large Magellanic Cloud with the Milky Way beyond. */
	lmc: pose(900, 90, 0, [lmc.x, lmc.y, lmc.z]),
	/** A wide view that includes the halo and its globular clusters. */
	halo: pose(D0 * 2.6, 32, -20),
};

export const VIEW_LABELS: Record<GalaxyViewName, string> = {
	'face-on': 'Face-on',
	tilted: 'Tilted',
	'edge-on': 'Edge-on',
	'arm-flyby': 'Perseus Arm',
	core: 'Galactic Core',
	home: 'Home — the Sun',
	lmc: 'Large Magellanic Cloud',
	halo: 'Halo',
};

/** The journey used when no section on the page declares a waypoint. */
export const DEFAULT_PATH: GalaxyViewName[] = ['face-on', 'tilted', 'edge-on', 'home'];

const KEYS: (keyof CameraPose)[] = ['logDistance', 'polar', 'azimuth', 'targetX', 'targetY', 'targetZ', 'roll'];

export const clonePose = (p: CameraPose): CameraPose => ({ ...p });

export const newPose = (): CameraPose => clonePose(VIEWS['face-on']);

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
	const t2 = t * t;
	const t3 = t2 * t;
	return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

/** Smooth pose between poses[i] and poses[i+1] (t ∈ [0,1]); neighbours shape the curve. */
export function poseBetween(poses: CameraPose[], i: number, t: number, out: CameraPose): CameraPose {
	const last = poses.length - 1;
	const k0 = poses[Math.max(i - 1, 0)];
	const k1 = poses[Math.min(i, last)];
	const k2 = poses[Math.min(i + 1, last)];
	const k3 = poses[Math.min(i + 2, last)];
	for (const key of KEYS) out[key] = catmullRom(k0[key], k1[key], k2[key], k3[key], t);
	return out;
}

/** Position along an evenly spaced path for scroll progress p ∈ [0, 1]. */
export function poseAlong(poses: CameraPose[], progress: number, out: CameraPose): CameraPose {
	const segments = poses.length - 1;
	if (segments <= 0) return Object.assign(out, poses[0]);
	const scaled = Math.min(Math.max(progress, 0), 1) * segments;
	const i = Math.min(Math.floor(scaled), segments - 1);
	return poseBetween(poses, i, scaled - i, out);
}

export const smootherstep = (t: number) => {
	const x = Math.min(1, Math.max(0, t));
	return x * x * x * (x * (x * 6 - 15) + 10);
};

/** Critically damped approach toward a target; frame-rate independent. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
	current + (target - current) * (1 - Math.exp(-lambda * dt));

export function dampPose(current: CameraPose, target: CameraPose, lambda: number, dt: number) {
	for (const key of KEYS) current[key] = damp(current[key], target[key], lambda, dt);
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
