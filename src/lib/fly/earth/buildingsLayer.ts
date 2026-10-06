// src/lib/fly/earth/buildingsLayer.ts
// Streams the 3D cities: when the ship is low, the 1 km cells around it are fetched from Overpass (OpenStreetMap outlines, ODbL), extruded into
// boxes on the real terrain and shown. One request at a time with back-off and a second endpoint, bounded cache, everything released through
// the tracker. If the service is unreachable the world simply has no buildings (flagged, never a crash).

import * as THREE from 'three';
import { type Cell, CELL_DEG, OVERPASS_ENDPOINTS, cellKey, cellOf, extrudeBuildings, overpassQuery, parseOverpass } from './buildings';
import type { LocalFrame } from './frame';
import { ResourceTracker, geometryBytes } from '../stream';

export interface BuildingStats { cells: number; buildings: number; loading: boolean; failed: number; estimatedShare: number }

interface CellRec { cell: Cell; key: string; state: 'idle' | 'loading' | 'ready' | 'failed'; mesh?: THREE.Mesh; center?: [number, number, number]; retryAt: number; lastUsed: number; buildings: number; estimated: number; abort?: AbortController }

export interface BuildingsDeps {
	/** Returns Overpass JSON for the query. */
	fetchJson(query: string, signal: AbortSignal): Promise<{ elements?: unknown[] }>;
}

export const overpassFetch: BuildingsDeps['fetchJson'] = async (query, signal) => {
	let last: unknown;
	for (const url of OVERPASS_ENDPOINTS) {
		try {
			const res = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal });
			if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
			return await res.json();
		} catch (e) { last = e; if (signal.aborted) throw e; }
	}
	throw last instanceof Error ? last : new Error('Overpass unreachable');
};

export class BuildingsLayer {
	readonly root = new THREE.Group();
	private recs = new Map<string, CellRec>();
	private material: THREE.Material;
	private busy = false;
	private disposed = false;
	enabled = true;

	constructor(private deps: BuildingsDeps, private tracker: ResourceTracker, private ground: (latDeg: number, lonDeg: number) => number | null, private maxCells = 16, cheap = false) {
		this.material = cheap ? new THREE.MeshLambertMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 });
		this.tracker.track(this.material, 'buildings', 'material');
	}

	/** Which cells to hold for a ship at lat/lon (deg) and altitude above ground (m): a 3×3 block when low, the single cell below when higher, none above 3 km. */
	cellsFor(latDeg: number, lonDeg: number, agl: number): Cell[] {
		if (!this.enabled || agl > 3000) return [];
		const c = cellOf(latDeg, lonDeg);
		if (agl > 1500) return [c];
		const out: Cell[] = [];
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) out.push({ ix: c.ix + dx, iy: c.iy + dy });
		return out;
	}

	update(frame: LocalFrame, latDeg: number, lonDeg: number, agl: number, now: number, groundReady: boolean) {
		if (this.disposed) return;
		const wanted = this.cellsFor(latDeg, lonDeg, agl);
		const keys = new Set(wanted.map(cellKey));
		for (const r of this.recs.values()) { if (r.mesh) r.mesh.visible = keys.has(r.key); }
		for (const c of wanted) {
			const key = cellKey(c);
			let r = this.recs.get(key);
			if (!r) { r = { cell: c, key, state: 'idle', retryAt: 0, lastUsed: now, buildings: 0, estimated: 0 }; this.recs.set(key, r); }
			r.lastUsed = now;
			if (groundReady && !this.busy && (r.state === 'idle' || (r.state === 'failed' && now > r.retryAt))) this.load(r, now);
			if (r.mesh && r.center) { r.mesh.visible = true; frame.toLocal(r.center, r.mesh.position); r.mesh.quaternion.copy(frame.qInv); }
		}
		if (this.recs.size > this.maxCells) {
			const old = [...this.recs.values()].filter((r) => !keys.has(r.key) && r.state !== 'loading').sort((a, b) => a.lastUsed - b.lastUsed);
			for (let i = 0; i < this.recs.size - this.maxCells && i < old.length; i++) this.drop(old[i]);
		}
	}

	private load(r: CellRec, now: number) {
		r.state = 'loading'; this.busy = true;
		const ac = new AbortController(); r.abort = ac;
		const timer = setTimeout(() => ac.abort(), 25000);
		this.deps.fetchJson(overpassQuery(r.cell), ac.signal).then((json) => {
			clearTimeout(timer);
			this.busy = false;
			if (this.disposed) return;
			const fps = parseOverpass(json as Parameters<typeof parseOverpass>[0]);
			const geo = extrudeBuildings(fps, r.cell, (la, lo) => this.ground(la, lo) ?? 0);
			r.buildings = geo.buildings; r.estimated = fps.filter((f) => f.estimated).length;
			if (geo.triangles > 0) {
				const g = new THREE.BufferGeometry();
				g.setAttribute('position', new THREE.BufferAttribute(geo.positions, 3));
				g.setAttribute('normal', new THREE.BufferAttribute(geo.normals, 3));
				g.setAttribute('color', new THREE.BufferAttribute(geo.colors, 3));
				g.setIndex(new THREE.BufferAttribute(geo.indices, 1));
				g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), (CELL_DEG * 111320) * 1.2 + geo.tallest);
				this.tracker.track(g, 'buildings', 'geometry', geometryBytes(geo.positions.length / 3, geo.indices.length, 9), 'tiles');
				const mesh = new THREE.Mesh(g, this.material);
				mesh.castShadow = false; mesh.receiveShadow = true; mesh.visible = false;
				this.root.add(mesh); r.mesh = mesh; r.center = geo.center;
			}
			r.state = 'ready';
		}).catch(() => {
			clearTimeout(timer);
			this.busy = false;
			if (this.disposed) return;
			r.state = 'failed'; r.retryAt = now + 30000;
		});
	}

	private drop(r: CellRec) {
		r.abort?.abort();
		if (r.mesh) { this.root.remove(r.mesh); this.tracker.release(r.mesh.geometry); }
		this.recs.delete(r.key);
	}

	get stats(): BuildingStats {
		let cells = 0, buildings = 0, failed = 0, est = 0, loading = false;
		for (const r of this.recs.values()) { if (r.state === 'ready') { cells++; buildings += r.buildings; est += r.estimated; } if (r.state === 'failed') failed++; if (r.state === 'loading') loading = true; }
		return { cells, buildings, loading, failed, estimatedShare: buildings ? est / buildings : 0 };
	}

	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		for (const r of this.recs.values()) r.abort?.abort();
		this.recs.clear(); this.tracker.unloadOwner('buildings'); this.root.clear();
	}
}
