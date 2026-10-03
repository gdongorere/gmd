// src/lib/galaxy/explore.ts
// Camera maths for Explore mode: orbit, zoom, pan, and shareable view links.

import { CAMERA_FOV } from './constants';
import type { CameraPose } from './camera';

const MIN_LOG = Math.log(30);
const MAX_LOG = Math.log(4500);
const EPS = 0.03;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function orbit(pose: CameraPose, dAzimuth: number, dPolar: number) {
	pose.azimuth += dAzimuth;
	pose.polar = clamp(pose.polar + dPolar, EPS, Math.PI - EPS);
}

export function zoom(pose: CameraPose, factor: number) {
	pose.logDistance = clamp(pose.logDistance + Math.log(factor), MIN_LOG, MAX_LOG);
}

/** Camera basis vectors for a pose (scene space). */
export function basis(pose: CameraPose) {
	const sp = Math.sin(pose.polar), cp = Math.cos(pose.polar);
	const sa = Math.sin(pose.azimuth), ca = Math.cos(pose.azimuth);
	const offset: [number, number, number] = [sp * ca, cp, -sp * sa];
	const forward: [number, number, number] = [-offset[0], -offset[1], -offset[2]];
	const up: [number, number, number] = [-cp * ca, sp, cp * sa];
	const right: [number, number, number] = [
		forward[1] * up[2] - forward[2] * up[1],
		forward[2] * up[0] - forward[0] * up[2],
		forward[0] * up[1] - forward[1] * up[0],
	];
	const len = Math.hypot(...right) || 1;
	return { offset, forward, up, right: right.map((v) => v / len) as [number, number, number] };
}

/** Drag the scene with the pointer: the target moves opposite to the drag in the view plane. */
export function pan(pose: CameraPose, dxPx: number, dyPx: number, viewportHeightPx: number) {
	const { up, right } = basis(pose);
	const perPx = (2 * Math.exp(pose.logDistance) * Math.tan((CAMERA_FOV * Math.PI) / 360)) / Math.max(1, viewportHeightPx);
	pose.targetX += (-dxPx * right[0] + dyPx * up[0]) * perPx;
	pose.targetY += (-dxPx * right[1] + dyPx * up[1]) * perPx;
	pose.targetZ += (-dxPx * right[2] + dyPx * up[2]) * perPx;
}

/** Camera position in scene space. */
export function cameraPosition(pose: CameraPose): [number, number, number] {
	const { offset } = basis(pose);
	const d = Math.exp(pose.logDistance);
	return [pose.targetX + offset[0] * d, pose.targetY + offset[1] * d, pose.targetZ + offset[2] * d];
}

// --- Shareable links --------------------------------------------------------

const DEG = 180 / Math.PI;
const round = (v: number, p = 2) => Number(v.toFixed(p));

/** "polar,azimuth,distance,tx,ty,tz" — degrees and scene units, rounded for short URLs. */
export function encodeView(pose: CameraPose): string {
	return [pose.polar * DEG, pose.azimuth * DEG, Math.exp(pose.logDistance), pose.targetX, pose.targetY, pose.targetZ]
		.map((v, i) => round(v, i < 2 ? 1 : 0))
		.join(',');
}

export function decodeView(value: string | null): CameraPose | null {
	if (!value) return null;
	const parts = value.split(',').map(Number);
	if (parts.length !== 6 || parts.some((n) => !Number.isFinite(n))) return null;
	const [polar, azimuth, distance, tx, ty, tz] = parts;
	if (distance <= 0) return null;
	return {
		polar: clamp(polar / DEG, EPS, Math.PI - EPS),
		azimuth: azimuth / DEG,
		logDistance: clamp(Math.log(distance), MIN_LOG, MAX_LOG),
		targetX: clamp(tx, -4000, 4000),
		targetY: clamp(ty, -4000, 4000),
		targetZ: clamp(tz, -4000, 4000),
		roll: 0,
	};
}

/** A tidy length for the scale bar: the biggest "nice" distance that fits in maxPx. */
export function niceScale(pxPerLy: number, maxPx: number): { ly: number; px: number } {
	const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];
	let best = steps[0];
	for (const s of steps) if (s * pxPerLy <= maxPx) best = s;
	return { ly: best, px: best * pxPerLy };
}
