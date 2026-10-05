// src/lib/astro/render.ts
// Per-pixel globe renderer shared by Earth and Mars. Allocation-free inner loop.

import type { GlobeProjector } from './globe';

export type Sampler = (lat: number, lon: number, light: number, out: Float64Array) => void;

/**
 * Fill `img` (n×n) with a lit sphere. `sampler` writes an RGB triple (0–255) into out[0..2] given the
 * latitude/longitude and the Lambert term `light` = cos(sun zenith) (negative on the night side).
 */
export function renderGlobe(img: ImageData, proj: GlobeProjector, sampler: Sampler) {
	const n = img.width;
	const data = img.data;
	const tmp = new Float64Array(5);
	const rgb = new Float64Array(3);
	const [sx, sy, sz] = proj.sun;
	for (let j = 0; j < n; j++) {
		const v = 1 - (2 * (j + 0.5)) / n;
		for (let i = 0; i < n; i++) {
			const u = (2 * (i + 0.5)) / n - 1;
			const o = (j * n + i) * 4;
			if (!proj.inverse(u, v, tmp)) { data[o + 3] = 0; continue; }
			const light = tmp[2] * sx + tmp[3] * sy + tmp[4] * sz;
			sampler(tmp[0], tmp[1], light, rgb);
			const r = Math.sqrt(u * u + v * v);
			data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2];
			data[o + 3] = Math.min(255, (1 - r) * n * 0.5 * 255);
		}
	}
}

export const smoothstep = (a: number, b: number, x: number) => {
	const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
	return t * t * (3 - 2 * t);
};
