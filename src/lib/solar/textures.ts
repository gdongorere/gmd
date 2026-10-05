// src/lib/solar/textures.ts
// Procedural equirectangular textures for the 3D scene (browser only): Earth from the Natural Earth land rings, Mars from the schematic albedo map.

import { marsDarkness } from '../astro/marsMap';

const W = 1024, H = 512;

/** Latitude palette for land (schematic, matches the 2D Earth view). */
function landRgb(absLat: number): [number, number, number] {
	const stops: [number, number, number, number][] = [[0, 46, 104, 56], [10, 62, 114, 60], [20, 148, 136, 92], [30, 164, 142, 94], [42, 100, 126, 72], [55, 70, 112, 64], [65, 128, 140, 118], [78, 172, 176, 170]];
	for (let i = 1; i < stops.length; i++) {
		if (absLat <= stops[i][0]) {
			const a = stops[i - 1], b = stops[i], t = (absLat - a[0]) / (b[0] - a[0]);
			return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t];
		}
	}
	return [172, 176, 170];
}

/** Earth texture from land rings ([lon, lat] arrays, antimeridian-unwrapped). Returns a canvas, or null without a 2D context. */
export function earthTexture(rings: [number, number][][]): HTMLCanvasElement | null {
	const mask = document.createElement('canvas');
	mask.width = W; mask.height = H;
	const g = mask.getContext('2d');
	if (!g) return null;
	g.fillStyle = '#fff';
	for (const ring of rings) for (const shift of [-360, 0, 360]) {
		g.beginPath();
		ring.forEach(([lon, lat], i) => { const x = (lon + shift + 180) * (W / 360), y = (90 - lat) * (H / 180); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
		g.closePath(); g.fill();
	}
	const m = g.getImageData(0, 0, W, H).data;
	const out = document.createElement('canvas');
	out.width = W; out.height = H;
	const o = out.getContext('2d')!;
	const img = o.createImageData(W, H);
	for (let y = 0; y < H; y++) {
		const lat = 90 - (y + 0.5) * (180 / H);
		const [lr, lg, lb] = landRgb(Math.abs(lat));
		for (let x = 0; x < W; x++) {
			const a = m[(y * W + x) * 4 + 3] / 255;
			const polar = Math.abs(lat) > 80 ? 0.8 : 0;
			let r = 18 + (lr - 18) * a, gg = 58 + (lg - 58) * a, b = 118 + (lb - 118) * a;
			r += (232 - r) * polar; gg += (238 - gg) * polar; b += (245 - b) * polar;
			const i = (y * W + x) * 4;
			img.data[i] = r; img.data[i + 1] = gg; img.data[i + 2] = b; img.data[i + 3] = 255;
		}
	}
	o.putImageData(img, 0, 0);
	return out;
}

/** Schematic Mars: rusty plains darkened or brightened by the hand-placed albedo features. */
export function marsTexture(): HTMLCanvasElement | null {
	const c = document.createElement('canvas');
	c.width = W / 2; c.height = H / 2;
	const o = c.getContext('2d');
	if (!o) return null;
	const img = o.createImageData(c.width, c.height);
	for (let y = 0; y < c.height; y++) {
		const lat = 90 - (y + 0.5) * (180 / c.height);
		for (let x = 0; x < c.width; x++) {
			const lon = (x + 0.5) * (360 / c.width) - 180;
			const d = marsDarkness(lat, lon);
			const k = 1 - 0.38 * d;
			const cap = Math.abs(lat) > 82 ? 0.85 : 0;
			const i = (y * c.width + x) * 4;
			img.data[i] = Math.min(255, (196 * k) * (1 - cap) + 240 * cap);
			img.data[i + 1] = Math.min(255, (104 * k) * (1 - cap) + 238 * cap);
			img.data[i + 2] = Math.min(255, (66 * k) * (1 - cap) + 235 * cap);
			img.data[i + 3] = 255;
		}
	}
	o.putImageData(img, 0, 0);
	return c;
}
