// src/lib/fly/earth/buildings.ts
// Cities as 3D boxes. OpenStreetMap building outlines (ODbL, © OpenStreetMap contributors) are extruded to their mapped or estimated height
// and placed on the real terrain. This file is pure: Overpass JSON in, typed arrays out (no network, no three.js objects), so it runs in a
// worker and is tested on fixtures. Live fetching lives in manager.ts.
//
// What it is NOT: it ignores multipolygon relations with holes (courtyards fill in), roof shapes (all roofs are flat), and building:part
// detail. Heights come from OSM `height` / `building:levels` where mapped and are ESTIMATES (by building type) elsewhere; the HUD says so.

import * as THREE from 'three';
import { type Vec3, geodeticToEcef, rad } from './geo';

export interface Footprint {
	id: number;
	/** Ring as [lon, lat] degrees, open (first ≠ last). */
	ring: [number, number][];
	/** Metres from the base to the roof. */
	height: number;
	/** True when the height is a guess from the building type rather than mapped. */
	estimated: boolean;
	kind: string;
}

export const CELL_DEG = 0.01; // ≈ 1.1 km × 0.8 km cells
export interface Cell { ix: number; iy: number }
export const cellOf = (latDeg: number, lonDeg: number): Cell => ({ ix: Math.floor(lonDeg / CELL_DEG), iy: Math.floor(latDeg / CELL_DEG) });
export const cellKey = (c: Cell) => `${c.ix}/${c.iy}`;
export const cellBounds = (c: Cell) => ({ west: c.ix * CELL_DEG, east: (c.ix + 1) * CELL_DEG, south: c.iy * CELL_DEG, north: (c.iy + 1) * CELL_DEG });

export const OVERPASS_ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

/** Overpass QL for every building outline in a cell (ways only; geometry inline). */
export function overpassQuery(c: Cell): string {
	const b = cellBounds(c);
	return `[out:json][timeout:25];way["building"](${b.south},${b.west},${b.north},${b.east});out tags geom;`;
}

// Typical storey-based defaults (metres) when nothing is mapped. Documented estimates.
const DEFAULT_HEIGHT: Record<string, number> = {
	house: 7, detached: 7, semidetached_house: 7, terrace: 8, residential: 12, apartments: 18, dormitory: 15, hotel: 24, commercial: 16, retail: 8, office: 28,
	industrial: 9, warehouse: 8, garage: 3, garages: 3, shed: 3, hut: 3, cabin: 4, church: 18, cathedral: 38, school: 11, university: 16, hospital: 20, civic: 14,
	public: 12, train_station: 12, stadium: 30, tower: 40, roof: 4, yes: 9,
};

/** Parse an OSM height value ("12", "12.5 m", "40 ft", "40'") to metres, or null. */
export function parseHeight(v: string | undefined): number | null {
	if (!v) return null;
	const m = /^\s*(-?\d+(?:[.,]\d+)?)\s*(m|ft|feet|')?\s*$/i.exec(v);
	if (!m) return null;
	const n = parseFloat(m[1].replace(',', '.'));
	if (!Number.isFinite(n) || n <= 0) return null;
	return m[2] && /^(ft|feet|')$/i.test(m[2]) ? n * 0.3048 : n;
}

/** Deterministic ±15 % variety from the way id so estimated blocks do not look cloned. */
const jitter = (id: number) => 0.85 + 0.3 * (((Math.imul(id | 0, 2654435761) >>> 0) % 1000) / 1000);

export function buildingHeight(tags: Record<string, string>, id: number): { height: number; estimated: boolean } {
	const h = parseHeight(tags.height) ?? parseHeight(tags['building:height']);
	if (h) return { height: Math.min(h, 900), estimated: false };
	const levels = parseFloat(tags['building:levels'] ?? '');
	if (Number.isFinite(levels) && levels > 0) return { height: Math.min(levels * 3.2 + (tags['roof:levels'] ? 1.5 : 0.8), 900), estimated: false };
	const kind = tags.building ?? 'yes';
	return { height: (DEFAULT_HEIGHT[kind] ?? DEFAULT_HEIGHT.yes) * jitter(id), estimated: true };
}

interface OverpassWay { type: string; id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] }

/** Overpass JSON → footprints. Skips degenerate, tiny and non-closed rings. */
export function parseOverpass(json: { elements?: OverpassWay[] }, opts: { minArea?: number; max?: number } = {}): Footprint[] {
	const out: Footprint[] = [];
	for (const el of json.elements ?? []) {
		if (el.type !== 'way' || !el.geometry || el.geometry.length < 4) continue;
		const g = el.geometry;
		const closed = g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon;
		if (!closed) continue;
		const ring = g.slice(0, -1).map((p) => [p.lon, p.lat] as [number, number]);
		if (ring.length < 3 || ringAreaM2(ring) < (opts.minArea ?? 8)) continue;
		const tags = el.tags ?? {};
		const { height, estimated } = buildingHeight(tags, el.id);
		out.push({ id: el.id, ring, height, estimated, kind: tags.building ?? 'yes' });
		if (out.length >= (opts.max ?? 6000)) break;
	}
	return out;
}

/** Planar area (m²) of a small lon/lat ring (equirectangular at its own latitude). */
export function ringAreaM2(ring: [number, number][]): number {
	const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
	const kx = 111320 * Math.cos(rad(lat0)), ky = 110574;
	let a = 0;
	for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length]; a += x1 * kx * y2 * ky - x2 * kx * y1 * ky; }
	return Math.abs(a) / 2;
}

export interface BuildingGeometry {
	/** Absolute ECEF centre of the cell. */
	center: Vec3;
	/** Positions relative to `center`, in ECEF axes (the same convention as terrain tiles). */
	positions: Float32Array;
	normals: Float32Array;
	colors: Float32Array;
	indices: Uint32Array;
	buildings: number;
	triangles: number;
	tallest: number;
}

const PALETTE: Record<string, number[][]> = {
	residential: [[0.78, 0.7, 0.62], [0.72, 0.62, 0.55], [0.82, 0.78, 0.7]],
	commercial: [[0.62, 0.66, 0.7], [0.7, 0.73, 0.76], [0.55, 0.6, 0.66]],
	industrial: [[0.58, 0.58, 0.56], [0.65, 0.64, 0.6]],
	civic: [[0.8, 0.76, 0.68], [0.72, 0.7, 0.66]],
};
const GROUP: Record<string, string> = { house: 'residential', detached: 'residential', terrace: 'residential', semidetached_house: 'residential', apartments: 'residential', residential: 'residential', dormitory: 'residential', office: 'commercial', commercial: 'commercial', retail: 'commercial', hotel: 'commercial', industrial: 'industrial', warehouse: 'industrial', garage: 'industrial', garages: 'industrial', church: 'civic', cathedral: 'civic', school: 'civic', university: 'civic', hospital: 'civic', civic: 'civic', public: 'civic' };

/**
 * Extrude footprints into box-like prisms. `ground(lat, lon)` gives terrain height in metres (degrees in); a building's base is the
 * lowest ground under its outline so slopes never leave it floating, and walls reach 2 m below that to hide the slope gap.
 */
export function extrudeBuildings(footprints: Footprint[], cell: Cell, ground: (latDeg: number, lonDeg: number) => number): BuildingGeometry {
	const b = cellBounds(cell);
	const center = geodeticToEcef(rad((b.north + b.south) / 2), rad((b.east + b.west) / 2), 0);
	const pos: number[] = [], nrm: number[] = [], col: number[] = [], idx: number[] = [];
	let tallest = 0, count = 0;

	for (const f of footprints) {
		let ring = f.ring;
		// Make the ring counter-clockwise in (lon, lat) so the winding is known.
		let area2 = 0;
		for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length]; area2 += x1 * y2 - x2 * y1; }
		if (area2 < 0) ring = [...ring].reverse();
		const n = ring.length;
		let base = Infinity;
		for (const [lon, lat] of ring) base = Math.min(base, Math.max(0, ground(lat, lon)));
		const lowZ = base - 2, topZ = base + f.height;
		const centLat = ring.reduce((s, p) => s + p[1], 0) / n, centLon = ring.reduce((s, p) => s + p[0], 0) / n;
		const upC = new THREE.Vector3(Math.cos(rad(centLat)) * Math.cos(rad(centLon)), Math.cos(rad(centLat)) * Math.sin(rad(centLon)), Math.sin(rad(centLat)));
		const group = PALETTE[GROUP[f.kind] ?? 'commercial'] ?? PALETTE.commercial;
		const tint = group[Math.abs(f.id) % group.length];
		const lin = (c: number) => Math.pow(c, 2.2);
		const rel = (lat: number, lon: number, h: number) => { const p = geodeticToEcef(rad(lat), rad(lon), h); return [p[0] - center[0], p[1] - center[1], p[2] - center[2]]; };

		// walls
		for (let i = 0; i < n; i++) {
			const [lon1, lat1] = ring[i], [lon2, lat2] = ring[(i + 1) % n];
			const a = rel(lat1, lon1, lowZ), bq = rel(lat2, lon2, lowZ), c = rel(lat2, lon2, topZ), d = rel(lat1, lon1, topZ);
			// outward normal for a CCW ring: (edge) × up
			const e = new THREE.Vector3(bq[0] - a[0], bq[1] - a[1], bq[2] - a[2]);
			const nn = new THREE.Vector3().crossVectors(e, upC).normalize();
			const v0 = pos.length / 3;
			for (const p of [a, bq, c, d]) { pos.push(p[0], p[1], p[2]); nrm.push(nn.x, nn.y, nn.z); const s = 0.92 + 0.08 * (p === a || p === bq ? 0 : 1); col.push(lin(tint[0] * s), lin(tint[1] * s), lin(tint[2] * s)); }
			idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
		}
		// flat roof
		const contour = ring.map(([lon, lat]) => new THREE.Vector2((lon - centLon) * 111320 * Math.cos(rad(centLat)), (lat - centLat) * 110574));
		const tris = THREE.ShapeUtils.triangulateShape(contour, []);
		const roofBase = pos.length / 3;
		for (const [lon, lat] of ring) { const p = rel(lat, lon, topZ); pos.push(p[0], p[1], p[2]); nrm.push(upC.x, upC.y, upC.z); col.push(lin(tint[0] * 0.78), lin(tint[1] * 0.78), lin(tint[2] * 0.78)); }
		for (const t of tris) idx.push(roofBase + t[0], roofBase + t[1], roofBase + t[2]);
		tallest = Math.max(tallest, f.height); count++;
	}
	return {
		center, positions: new Float32Array(pos), normals: new Float32Array(nrm), colors: new Float32Array(col), indices: new Uint32Array(idx),
		buildings: count, triangles: idx.length / 3, tallest,
	};
}
