// src/lib/input/hub.ts
// One shared polling loop for every component that wants gamepad input, so a page with several consumers still reads the pad once per frame.
// Browser only. Starts when the first subscriber arrives and stops with the last. Pauses while the tab is hidden (browsers return stale data then).

import { PadTracker, loadLearned, rumble, type Control, type LearnedMapping, type PadState, type RawPad } from './gamepad';

export interface PadFrame {
	pad: PadState;
	pressed: Control[];
	released: Control[];
	/** True when a stick, trigger or button is being touched this frame. */
	anyInput: boolean;
	/** Seconds since the previous frame (clamped to 0.1 so a stalled tab cannot cause a jump). */
	dt: number;
	raw: RawPad | null;
}

export interface PadSummary { id: string; label: string; family: PadState['family']; source: PadState['source']; index: number }

type FrameFn = (f: PadFrame) => void;
type StatusFn = (s: PadSummary | null) => void;

class PadHub {
	private frameListeners = new Set<FrameFn>();
	private statusListeners = new Set<StatusFn>();
	private raf = 0;
	private last = 0;
	// Learned mappings are read from storage once per pad id, not every frame.
	private learnedCache = new Map<string, LearnedMapping | null>();
	private learned = (id: string) => { if (!this.learnedCache.has(id)) this.learnedCache.set(id, loadLearned(id)); return this.learnedCache.get(id) ?? null; };
	private tracker = new PadTracker((id) => this.learned(id));
	private current: PadSummary | null = null;
	private lastRaw: RawPad | null = null;
	private bound = false;

	get supported() { return typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function'; }
	status(): PadSummary | null { return this.current; }
	rawPad(): RawPad | null { return this.lastRaw; }

	subscribe(fn: FrameFn): () => void {
		this.frameListeners.add(fn);
		this.start();
		return () => { this.frameListeners.delete(fn); this.maybeStop(); };
	}

	onStatus(fn: StatusFn): () => void {
		this.statusListeners.add(fn);
		this.start();
		fn(this.current);
		return () => { this.statusListeners.delete(fn); this.maybeStop(); };
	}

	/** Rumble the active pad if the browser supports it. */
	rumble(opts: { strong?: number; weak?: number; ms?: number }): boolean { return rumble(this.lastRaw, opts); }

	/** Re-read the learned mapping (after the wizard saved one). */
	refresh() { this.learnedCache.clear(); this.tracker = new PadTracker((id) => this.learned(id)); }

	private start() {
		if (!this.supported || this.raf) return;
		if (!this.bound) {
			this.bound = true;
			// Browsers only reveal a pad after its first button press; these events make the status chip react immediately.
			window.addEventListener('gamepadconnected', () => this.poll(performance.now()));
			window.addEventListener('gamepaddisconnected', () => this.poll(performance.now()));
		}
		this.last = performance.now();
		const loop = (t: number) => { this.raf = requestAnimationFrame(loop); this.poll(t); };
		this.raf = requestAnimationFrame(loop);
	}

	private maybeStop() {
		if (this.frameListeners.size === 0 && this.statusListeners.size === 0 && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
	}

	private poll(t: number) {
		if (document.hidden) { this.last = t; return; }
		const dt = Math.min(0.1, Math.max(0, (t - this.last) / 1000));
		this.last = t;
		let pads: (RawPad | null)[] = [];
		try { pads = Array.from(navigator.getGamepads() as unknown as (RawPad | null)[]); } catch { /* blocked by a permissions policy: no pad */ }
		const r = this.tracker.update(pads);
		const next: PadSummary | null = r ? { id: r.pad.id, label: r.pad.label, family: r.pad.family, source: r.pad.source, index: r.pad.index } : null;
		if (next?.id !== this.current?.id || next?.source !== this.current?.source) { this.current = next; this.statusListeners.forEach((f) => f(next)); }
		this.lastRaw = r ? pads[r.pad.index] ?? null : null;
		if (r) { const frame: PadFrame = { pad: r.pad, pressed: r.pressed, released: r.released, anyInput: r.anyInput, dt, raw: this.lastRaw }; this.frameListeners.forEach((f) => f(frame)); }
	}
}

export const padHub = new PadHub();
