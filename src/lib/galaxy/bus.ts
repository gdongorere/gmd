// src/lib/galaxy/bus.ts
// A tiny shared store between the page (waypoint sections, explore UI) and the render
// engine. The engine pulls from it every frame, so React never re-renders the galaxy.

import type { CameraPose, GalaxyViewName } from './camera';

export interface WaypointEntry {
	id: string;
	view: GalaxyViewName;
	/** Document-space Y of the section's centre, in CSS px. */
	y: number;
}

/** Commands and read-outs the engine offers once it is running. */
export interface GalaxyApi {
	/** Project a scene-space point to CSS px; `visible` is false when off-screen or behind the camera. */
	project(x: number, y: number, z: number): { x: number; y: number; visible: boolean; distance: number };
	/** Millions of years elapsed since the galaxy first appeared (scaled by the time controls). */
	elapsedMyr(): number;
	/** Camera distance from its target, in light-years. */
	cameraDistanceLy(): number;
	/** Current camera pose (a copy). */
	pose(): CameraPose;
	/** Capture the next rendered frame as a PNG. */
	capture(): Promise<Blob | null>;
}

export interface ExploreState {
	/** Explore mode drives the camera directly instead of following the page's waypoints. */
	active: boolean;
	target: CameraPose;
	/** Time scale: 1 = normal speed, 0 = paused, negative = reverse. Ignored when `galacticYears` is set. */
	timeScale: number;
	/** Simulated years since J2000. When provided, the galaxy's rotation follows it exactly. */
	galacticYears?: () => number;
}

class GalaxyBus {
	readonly waypoints = new Map<string, WaypointEntry>();
	/** Bumped whenever waypoints change so the engine can re-sort lazily. */
	version = 0;
	api: GalaxyApi | null = null;
	explore: ExploreState | null = null;
	/** 0–1: how much to dim the galaxy for reading (modals, long text). */
	dim = 0;
	/** Stop rendering entirely (e.g. while a full-screen 3D page covers the galaxy). */
	paused = false;
	private listeners = new Set<() => void>();

	setWaypoint(entry: WaypointEntry) {
		const existing = this.waypoints.get(entry.id);
		if (existing && existing.view === entry.view && Math.abs(existing.y - entry.y) < 1) return;
		this.waypoints.set(entry.id, entry);
		this.version++;
	}

	removeWaypoint(id: string) {
		if (this.waypoints.delete(id)) this.version++;
	}

	setExplore(state: ExploreState | null) {
		this.explore = state;
		this.emit();
	}

	setDim(value: number) {
		this.dim = Math.min(1, Math.max(0, value));
	}

	attach(api: GalaxyApi) {
		this.api = api;
		this.emit();
	}

	detach() {
		this.api = null;
		this.emit();
	}

	subscribe(listener: () => void) {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private emit() {
		this.listeners.forEach((l) => l());
	}
}

export const galaxyBus = new GalaxyBus();
