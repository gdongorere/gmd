// src/lib/fly/earth/tileMesh.ts
// Builds the geometry for one terrain tile from its elevation data: a (GRID+1)² vertex patch on the WGS84 ellipsoid displaced by the real
// heights, with analytic normals, skirts that hide cracks between tiles of different detail, UVs over the tile (for imagery), and a physically
// motivated fallback colour (ocean depth, snow line by latitude, bare rock on steep slopes, lowland vegetation) used until/unless an imagery
// layer is available. Pure arrays in, pure arrays out (no three.js): runs in a worker and is unit-testable.
// Vertex positions are ECEF metres RELATIVE TO the tile centre (float32 is exact enough for that), never absolute ECEF.

import { GRID } from './quadtree';
import { type TileId, WGS84, geodeticToEcef, rad, tileBounds, tileSpanEquator, MAX_MERCATOR_LAT } from './geo';
import { type HeightTile, sampleTile } from './terrarium';

export interface TileGeometry {
	id: TileId;
	/** Absolute ECEF centre of the tile (doubles). */
	center: [number, number, number];
	positions: Float32Array;
	normals: Float32Array;
	colors: Float32Array;
	uvs: Float32Array;
	indices: Uint32Array;
	minHeight: number;
	maxHeight: number;
	/** Bounding radius from the centre including skirts. */
	radius: number;
	/** Fraction of vertices that are water. */
	water: number;
}

/** Latitude (rad) at fractional tile-row coordinate fy for zoom z. */
const latAt = (z: number, fy: number) => Math.atan(Math.sinh(Math.PI * (1 - (2 * fy) / 2 ** z)));

/** Tint for a surface point. Fallback only: labelled artistic wherever real imagery is absent. */
export function surfaceColor(height: number, slopeCos: number, latRad: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
	const lin = (c: number) => Math.pow(c, 2.2);
	if (height <= 0) {
		const depth = Math.min(1, -height / 4000);
		out[0] = lin(0.03 + 0.02 * (1 - depth)); out[1] = lin(0.16 + 0.2 * (1 - depth)); out[2] = lin(0.3 + 0.3 * (1 - depth));
		return out;
	}
	const cosLat = Math.cos(latRad);
	const snowLine = 5200 * Math.pow(Math.max(0, cosLat), 2.2) + 0; // ≈ 5.2 km tropics, ≈ 2.8 km at 47°, sea level near the poles
	const rock = [0.43, 0.4, 0.37], low = [0.28, 0.4, 0.2], dry = [0.55, 0.48, 0.34], snow = [0.93, 0.95, 0.97];
	// Vegetation fades toward desert in the subtropics and toward tundra at altitude.
	const subtropical = Math.exp(-(((((Math.abs(latRad) * 180) / Math.PI) - 25) / 10) ** 2));
	const alt = Math.min(1, height / 3500);
	let r = low[0] + (dry[0] - low[0]) * Math.max(subtropical * 0.7, alt * 0.6), g = low[1] + (dry[1] - low[1]) * Math.max(subtropical * 0.7, alt * 0.6), b = low[2] + (dry[2] - low[2]) * Math.max(subtropical * 0.7, alt * 0.6);
	const steep = Math.min(1, Math.max(0, (0.82 - slopeCos) / 0.25)); // slopes beyond ~35° are bare rock
	r += (rock[0] - r) * steep; g += (rock[1] - g) * steep; b += (rock[2] - b) * steep;
	const snowAmount = Math.min(1, Math.max(0, (height - snowLine) / 400)) * (1 - steep * 0.65);
	out[0] = lin(r + (snow[0] - r) * snowAmount); out[1] = lin(g + (snow[1] - g) * snowAmount); out[2] = lin(b + (snow[2] - b) * snowAmount);
	return out;
}

export function buildTileGeometry(h: HeightTile, opts: { skirt?: number; grid?: number } = {}): TileGeometry {
	const id = h.id, N = opts.grid ?? GRID, W = N + 1;
	const b = tileBounds(id);
	const lon0 = (b.west + b.east) / 2;
	const latC = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, (b.north + b.south) / 2));
	const cE = geodeticToEcef(rad(latC), rad(lon0), 0);
	const span = tileSpanEquator(id.z);
	const drop = opts.skirt ?? Math.max(30, span * 0.03);

	const lons = new Float64Array(W), lats = new Float64Array(W);
	for (let i = 0; i < W; i++) { lons[i] = rad(b.west + ((b.east - b.west) * i) / N); lats[i] = latAt(id.z, id.y + i / N); }
	const hgt = new Float32Array(W * W);
	let minH = Infinity, maxH = -Infinity, waterCount = 0;
	for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
		const v = sampleTile(h, (i / N) * h.size, (j / N) * h.size);
		hgt[j * W + i] = v; minH = Math.min(minH, v); maxH = Math.max(maxH, v);
	}

	const skirtVerts = 4 * W;
	const nV = W * W + skirtVerts;
	const positions = new Float32Array(nV * 3), normals = new Float32Array(nV * 3), colors = new Float32Array(nV * 3), uvs = new Float32Array(nV * 2);
	const abs = new Float64Array(W * W * 3); // absolute ECEF of the main grid, for normals
	const surf = (i: number, j: number) => Math.max(0, hgt[j * W + i]); // the sea surface is at 0
	for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
		const p = geodeticToEcef(lats[j], lons[i], surf(i, j));
		const k = j * W + i;
		abs[k * 3] = p[0]; abs[k * 3 + 1] = p[1]; abs[k * 3 + 2] = p[2];
		positions[k * 3] = p[0] - cE[0]; positions[k * 3 + 1] = p[1] - cE[1]; positions[k * 3 + 2] = p[2] - cE[2];
		uvs[k * 2] = i / N; uvs[k * 2 + 1] = j / N;
	}
	// Normals from central differences of the absolute positions (no seams: edges use one-sided differences).
	const nrm = [0, 0, 0], col: [number, number, number] = [0, 0, 0];
	for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
		const i0 = Math.max(0, i - 1), i1 = Math.min(N, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(N, j + 1);
		const a = (j * W + i1) * 3, c = (j * W + i0) * 3, d = (j1 * W + i) * 3, e = (j0 * W + i) * 3;
		const tx = abs[a] - abs[c], ty = abs[a + 1] - abs[c + 1], tz = abs[a + 2] - abs[c + 2]; // west→east
		const sx = abs[d] - abs[e], sy = abs[d + 1] - abs[e + 1], sz = abs[d + 2] - abs[e + 2]; // north→south (j grows southward)
		// outward normal = (south direction) × (east direction)
		nrm[0] = sy * tz - sz * ty; nrm[1] = sz * tx - sx * tz; nrm[2] = sx * ty - sy * tx;
		const len = Math.hypot(nrm[0], nrm[1], nrm[2]) || 1;
		nrm[0] /= len; nrm[1] /= len; nrm[2] /= len;
		const k = j * W + i;
		normals[k * 3] = nrm[0]; normals[k * 3 + 1] = nrm[1]; normals[k * 3 + 2] = nrm[2];
		// slope: angle between this normal and the radial direction
		const r = Math.hypot(abs[k * 3], abs[k * 3 + 1], abs[k * 3 + 2]);
		const slopeCos = (nrm[0] * abs[k * 3] + nrm[1] * abs[k * 3 + 1] + nrm[2] * abs[k * 3 + 2]) / r;
		const raw = hgt[k];
		if (raw <= 0) waterCount++;
		surfaceColor(raw, slopeCos, lats[j], col);
		colors[k * 3] = col[0]; colors[k * 3 + 1] = col[1]; colors[k * 3 + 2] = col[2];
	}

	// Skirts: every edge vertex duplicated and dropped toward the Earth's centre.
	let sv = W * W;
	const edge: number[][] = [[], [], [], []];
	for (let i = 0; i < W; i++) { edge[0].push(i); edge[1].push(N * W + i); edge[2].push(i * W); edge[3].push(i * W + N); }
	const skirtBase: number[] = [];
	for (const e of edge) {
		skirtBase.push(sv);
		for (const k of e) {
			const nx = abs[k * 3], ny = abs[k * 3 + 1], nz = abs[k * 3 + 2], r = Math.hypot(nx, ny, nz), f = drop / r;
			positions[sv * 3] = positions[k * 3] - nx * f; positions[sv * 3 + 1] = positions[k * 3 + 1] - ny * f; positions[sv * 3 + 2] = positions[k * 3 + 2] - nz * f;
			normals[sv * 3] = normals[k * 3]; normals[sv * 3 + 1] = normals[k * 3 + 1]; normals[sv * 3 + 2] = normals[k * 3 + 2];
			colors[sv * 3] = colors[k * 3]; colors[sv * 3 + 1] = colors[k * 3 + 1]; colors[sv * 3 + 2] = colors[k * 3 + 2];
			uvs[sv * 2] = uvs[k * 2]; uvs[sv * 2 + 1] = uvs[k * 2 + 1];
			sv++;
		}
	}

	const quads = N * N + 8 * N; // the skirts are doubled (once per winding) so they are lit correctly from either side with back-face culling
	const indices = new Uint32Array(quads * 6);
	let n = 0;
	// Top surface, counter-clockwise seen from outside (east = +i, south = +j, outward = south × east → CCW is (a, c, b) below).
	for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
		const a = j * W + i, bq = a + 1, c = a + W, d = c + 1;
		indices[n++] = a; indices[n++] = c; indices[n++] = bq;
		indices[n++] = bq; indices[n++] = c; indices[n++] = d;
	}
	// Skirt quads between each edge and its dropped copy, emitted in both windings: each side then faces its viewer, so with back-face culling
	// the visible side is always lit with the (upward) vertex normal instead of a flipped one, which used to show as dark seams.
	edge.forEach((e) => {
		const base = skirtBase[edge.indexOf(e)];
		for (let i = 0; i < N; i++) {
			const t0 = e[i], t1 = e[i + 1], s0 = base + i, s1 = s0 + 1;
			indices[n++] = t0; indices[n++] = s0; indices[n++] = t1; indices[n++] = t1; indices[n++] = s0; indices[n++] = s1;
			indices[n++] = t0; indices[n++] = t1; indices[n++] = s0; indices[n++] = t1; indices[n++] = s1; indices[n++] = s0;
		}
	});

	let radius = 0;
	for (let i = 0; i < nV; i++) radius = Math.max(radius, Math.hypot(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
	void WGS84;
	return { id, center: cE, positions, normals, colors, uvs, indices, minHeight: minH, maxHeight: maxH, radius, water: waterCount / (W * W) };
}
