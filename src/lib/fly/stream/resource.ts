import type { Budget } from './budget';
import type { Disposable, Pool, ResourceKind } from './types';

interface Entry {
	obj: Disposable;
	kind: ResourceKind;
	owner: string;
	pool: Pool;
	bytes: number;
}

export type Counts = Record<ResourceKind, number>;

const emptyCounts = (): Counts => ({ geometry: 0, texture: 0, material: 0, target: 0, bitmap: 0, worker: 0, url: 0, other: 0 });

/**
 * Owns every GPU/worker object by owner id so nothing leaks (docs/fly/12 §5.2).
 * Create through `track`; `unloadOwner` disposes everything an owner holds; `disposeAll` ends the session.
 */
export class ResourceTracker {
	private entries = new Map<Disposable, Entry>();

	constructor(private budget?: Budget) {}

	/** Register `obj` under `owner`. Returns `obj` for inline use. Re-tracking the same object is a no-op. */
	track<T extends Disposable>(obj: T, owner: string, kind: ResourceKind = 'other', bytes = 0, pool: Pool = 'gpu'): T {
		if (this.entries.has(obj)) return obj;
		this.entries.set(obj, { obj, kind, owner, pool, bytes });
		this.budget?.add(pool, bytes);
		return obj;
	}

	/** Dispose one object now (idempotent). */
	release(obj: Disposable): boolean {
		const e = this.entries.get(obj);
		if (!e) return false;
		this.entries.delete(obj);
		this.budget?.release(e.pool, e.bytes);
		try {
			if (e.obj.dispose) e.obj.dispose();
			else if (e.obj.close) e.obj.close();
			else if (e.obj.terminate) e.obj.terminate();
		} catch {
			/* a failing dispose must never stop the rest of the cleanup */
		}
		return true;
	}

	/** Dispose everything `owner` holds. Returns how many objects were released. */
	unloadOwner(owner: string): number {
		let n = 0;
		for (const e of [...this.entries.values()]) if (e.owner === owner && this.release(e.obj)) n++;
		return n;
	}

	disposeAll(): number {
		let n = 0;
		for (const e of [...this.entries.values()]) if (this.release(e.obj)) n++;
		return n;
	}

	/** Live objects per kind, optionally for one owner: the leak counter. */
	counts(owner?: string): Counts {
		const c = emptyCounts();
		for (const e of this.entries.values()) if (!owner || e.owner === owner) c[e.kind]++;
		return c;
	}

	total(owner?: string): number {
		return Object.values(this.counts(owner)).reduce((a, b) => a + b, 0);
	}

	owners(): string[] {
		return [...new Set([...this.entries.values()].map((e) => e.owner))];
	}
}

/** Rough GPU bytes for common three.js shapes, for budget accounting (no three import needed). */
export function textureBytes(width: number, height: number, bytesPerPixel = 4, mips = true): number {
	return Math.round(width * height * bytesPerPixel * (mips ? 4 / 3 : 1));
}
export function geometryBytes(vertices: number, indices = 0, floatsPerVertex = 8): number {
	return vertices * floatsPerVertex * 4 + indices * 4;
}
