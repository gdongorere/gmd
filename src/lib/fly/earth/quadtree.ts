// src/lib/fly/earth/quadtree.ts
// Chooses which terrain tiles to show for a camera: the Web-Mercator quadtree is refined where the geometric error, projected to the
// screen, exceeds a pixel tolerance τ (docs/fly/12 §4). Tiles behind the horizon and outside the view are culled. Parents of every
// selected tile are never selected together with it (no overdraw, no holes): the selection is a "cut" of the tree.

import { MAX_MERCATOR_LAT, type TileId, childrenOf, deg, geodeticToEcef, rad, tileBounds, tileSpanEquator, type Vec3, WGS84 } from './geo';

export const GRID = 32; // vertices per tile edge minus one (a 32×32-cell mesh)
const ERROR_FACTOR = 0.3; // geometric error as a fraction of the cell size (heightfield vs. true relief)
const MAX_RELIEF = 9000;

export interface SelectOptions {
	/** Camera position, ECEF metres. */
	camera: Vec3;
	/** Vertical field of view (rad) and viewport height (px) for the screen-space error. */
	fov: number;
	viewportHeight: number;
	/** Pixel tolerance τ: 2 (high), 4 (low). */
	tolerance?: number;
	minZoom?: number;
	maxZoom?: number;
	/** Safety cap on the selected set; τ is raised until it fits. */
	maxTiles?: number;
	/** Optional frustum test for a bounding sphere (ECEF centre, radius). Return false to cull. */
	inView?: (center: Vec3, radius: number) => boolean;
	/** Skip horizon culling (tests). */
	noHorizonCull?: boolean;
}

export interface SelectedTile { id: TileId; center: Vec3; radius: number; distance: number }

const cache = new Map<string, { center: Vec3; radius: number }>();

/** Bounding sphere of a tile (ECEF), with a relief allowance that scales with the tile size. */
export function tileSphere(id: TileId): { center: Vec3; radius: number } {
	const key = `${id.z}/${id.x}/${id.y}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const b = tileBounds(id);
	const lat0 = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, (b.north + b.south) / 2));
	const lon0 = (b.west + b.east) / 2;
	const mid = geodeticToEcef(rad(lat0), rad(lon0), 0);
	let r = 0;
	for (const [la, lo] of [[b.north, b.west], [b.north, b.east], [b.south, b.west], [b.south, b.east], [b.north, lon0], [b.south, lon0], [lat0, b.west], [lat0, b.east]]) {
		const p = geodeticToEcef(rad(Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, la))), rad(lo), 0);
		r = Math.max(r, Math.hypot(p[0] - mid[0], p[1] - mid[1], p[2] - mid[2]));
	}
	const relief = Math.min(MAX_RELIEF, tileSpanEquator(id.z) * 0.7);
	const out = { center: mid, radius: r + relief };
	if (cache.size > 20000) cache.clear();
	cache.set(key, out);
	return out;
}

/** True when a sphere is (at least partly) above the horizon seen from the camera, allowing for mountains. */
function aboveHorizon(cam: Vec3, center: Vec3, radius: number): boolean {
	const camR = Math.hypot(...cam), cR = Math.hypot(...center);
	const cos = (cam[0] * center[0] + cam[1] * center[1] + cam[2] * center[2]) / (camR * cR);
	const theta = Math.acos(Math.min(1, Math.max(-1, cos)));
	const Rmin = WGS84.b;
	const horizon = camR > Rmin ? Math.acos(Math.min(1, Rmin / camR)) : 0;
	const mountains = Math.acos(Rmin / (Rmin + MAX_RELIEF)); // peaks poke above the sea-level horizon
	// Angular radius of the bounding sphere as seen from Earth's centre (exact; a sphere that contains the centre is always visible).
	const ang = radius >= cR ? Math.PI : Math.asin(radius / cR);
	return theta <= horizon + mountains + ang;
}

export function selectTiles(opts: SelectOptions): SelectedTile[] {
	const { camera, fov, viewportHeight } = opts;
	const minZ = opts.minZoom ?? 3, maxZ = opts.maxZoom ?? 14, maxTiles = opts.maxTiles ?? 700;
	const k = viewportHeight / (2 * Math.tan(fov / 2));
	let tau = opts.tolerance ?? 3;
	for (let attempt = 0; attempt < 8; attempt++) {
		const out: SelectedTile[] = [];
		const visit = (id: TileId) => {
			const { center, radius } = tileSphere(id);
			if (!opts.noHorizonCull && !aboveHorizon(camera, center, radius)) return;
			if (opts.inView && !opts.inView(center, radius)) return;
			const dist = Math.max(1, Math.hypot(center[0] - camera[0], center[1] - camera[1], center[2] - camera[2]) - radius);
			const err = (ERROR_FACTOR * tileSpanEquator(id.z)) / GRID;
			const px = (err * k) / dist;
			if (id.z < minZ || (id.z < maxZ && px > tau)) {
				for (const c of childrenOf(id)) visit(c);
			} else out.push({ id, center, radius, distance: dist });
			if (out.length > maxTiles * 4) return; // runaway guard; the retry raises τ
		};
		visit({ z: 0, x: 0, y: 0 });
		if (out.length <= maxTiles) return out.sort((a, b) => a.distance - b.distance);
		tau *= 1.6;
	}
	return [];
}

/** Largest zoom whose tile (at the equator) has ground resolution no coarser than `metresPerPixel`. */
export const zoomForResolution = (metresPerPixel: number) => Math.max(0, Math.ceil(Math.log2(tileSpanEquator(0) / (256 * metresPerPixel))));

export { deg };
