// src/lib/fly/earth/terrarium.ts
// Real elevation from the public "Terrarium" tiles (Mapzen/AWS Open Data: SRTM, ASTER, NED, and others, merged; ocean from GEBCO).
// URL layout: https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png (256 px, Web Mercator, CORS-open).
// Encoding: elevation_m = R·256 + G + B/256 − 32768. Resolution is ~30 m globally (z12) and finer in places (z14–15).

import { lonLatToFraction, type TileId, tileKey } from './geo';

export const TERRARIUM_URL = (t: TileId) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${t.z}/${t.x}/${t.y}.png`;
/** The data's finest useful zoom (≈ 4.8 m/px at the equator; the true source resolution is coarser almost everywhere). */
export const TERRARIUM_MAX_ZOOM = 14;
export const TILE_PX = 256;

export interface HeightTile {
	id: TileId;
	size: number;
	/** Metres above the WGS84 ellipsoid-ish datum (EGM96 geoid in the source; the difference, up to ±100 m, is below this simulation's resolution and is documented as ignored). */
	heights: Float32Array;
}

/** Decode RGBA pixels (as from canvas or pngjs) into metres. */
export function decodeTerrarium(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, id: TileId): HeightTile {
	const heights = new Float32Array(width * height);
	for (let i = 0, n = width * height; i < n; i++) heights[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768;
	return { id, size: width, heights };
}

/** Bilinear height at fractional pixel coordinates (pixel centres at +0.5), clamped to the tile. */
export function sampleTile(t: HeightTile, px: number, py: number): number {
	const n = t.size;
	const x = Math.min(n - 1, Math.max(0, px - 0.5)), y = Math.min(n - 1, Math.max(0, py - 0.5));
	const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(n - 1, x0 + 1), y1 = Math.min(n - 1, y0 + 1);
	const fx = x - x0, fy = y - y0, h = t.heights;
	const a = h[y0 * n + x0], b = h[y0 * n + x1], c = h[y1 * n + x0], d = h[y1 * n + x1];
	return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

/** Height of the tile at a lat/lon (degrees) that lies inside it. */
export function heightAt(t: HeightTile, lonDeg: number, latDeg: number): number {
	const { fx, fy } = lonLatToFraction(t.id.z, lonDeg, latDeg);
	return sampleTile(t, (fx - t.id.x) * t.size, (fy - t.id.y) * t.size);
}

/**
 * The set of height tiles currently resident. Ground queries use the finest resident tile covering the point; if none is loaded the
 * answer is `null` (the caller decides: sea level while loading, never a silent wrong value).
 */
export class TerrainField {
	private tiles = new Map<string, HeightTile>();
	private maxZ = 0;

	set(t: HeightTile) { this.tiles.set(tileKey(t.id), t); this.maxZ = Math.max(this.maxZ, t.id.z); }
	delete(id: TileId) { this.tiles.delete(tileKey(id)); }
	has(id: TileId) { return this.tiles.has(tileKey(id)); }
	get(id: TileId) { return this.tiles.get(tileKey(id)); }
	get size() { return this.tiles.size; }

	/** Finest resident height (m) at lat/lon degrees, or null if no tile covers it. */
	height(lonDeg: number, latDeg: number): number | null {
		for (let z = this.maxZ; z >= 0; z--) {
			const { fx, fy } = lonLatToFraction(z, lonDeg, latDeg);
			const t = this.tiles.get(`${z}/${Math.floor(fx)}/${Math.floor(fy)}`);
			if (t) return sampleTile(t, (fx - t.id.x) * t.size, (fy - t.id.y) * t.size);
		}
		return null;
	}
}

/** Browser loader: fetch + decode through an offscreen canvas. Rejects on HTTP/decoding failure (the caller retries or falls back). */
export async function loadTerrariumTile(id: TileId, signal?: AbortSignal): Promise<HeightTile> {
	const res = await fetch(TERRARIUM_URL(id), { signal, mode: 'cors' });
	if (!res.ok) throw new Error(`terrain tile ${tileKey(id)}: HTTP ${res.status}`);
	const bmp = await createImageBitmap(await res.blob(), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
	try {
		const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(bmp.width, bmp.height) : Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
		const ctx = c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
		ctx.drawImage(bmp, 0, 0);
		const img = ctx.getImageData(0, 0, bmp.width, bmp.height);
		return decodeTerrarium(img.data, bmp.width, bmp.height, id);
	} finally {
		bmp.close();
	}
}
