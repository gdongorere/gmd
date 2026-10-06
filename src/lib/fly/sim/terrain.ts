// src/lib/fly/sim/terrain.ts
// The test arena's ground: a flat circular pad at the origin that blends into rolling hills. Pure and deterministic (no randomness),
// so the same (x, z) always has the same height: the renderer and the physics sample the same function.

export const PAD_RADIUS = 24;
export const ARENA_HALF_SIZE = 600;

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Ground height in metres at world position (x, z). */
export function groundHeight(x: number, z: number): number {
	const r = Math.hypot(x, z);
	const hills =
		9 * Math.sin(x * 0.011 + 0.7) * Math.cos(z * 0.013 - 0.3) +
		4.5 * Math.sin(x * 0.027 - z * 0.021 + 1.3) +
		2 * Math.sin(x * 0.061 + z * 0.057) +
		0.7 * Math.sin(x * 0.19) * Math.cos(z * 0.17);
	const ridge = 14 * smooth(180, 520, r) * (0.5 + 0.5 * Math.sin(Math.atan2(z, x) * 5 + r * 0.01)); // a ring of higher ground far out
	return smooth(PAD_RADIUS, PAD_RADIUS * 3.2, r) * (hills + ridge);
}
