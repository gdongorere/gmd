// src/lib/astro/shortcuts.ts
// Keyboard shortcuts for the clock, kept pure so they can be tested without a DOM.

import { RATE_PRESETS } from './clock';

export type TimeAction = 'step-back' | 'step-forward' | 'slower' | 'faster' | 'now' | 'open-time-machine' | 'bookmark' | 'time-tour';

/** Maps a keydown to a clock action, or null. Letters are case-insensitive; Shift+T starts the time-travel tour. */
export function timeActionForKey(key: string, shift = false): TimeAction | null {
	switch (key) {
		case ',': case '<': return 'step-back';
		case '.': case '>': return 'step-forward';
		case '[': case '{': return 'slower';
		case ']': case '}': return 'faster';
	}
	switch (key.toLowerCase()) {
		case 'n': return 'now';
		case 'j': return 'open-time-machine';
		case 'b': return 'bookmark';
		case 't': return shift ? 'time-tour' : null;
		default: return null;
	}
}

/** Simulated seconds for one step: what a second of the current speed covers, but never less than a minute. */
export const stepSeconds = (rate: number) => Math.max(60, Math.abs(rate));

/** The next slower/faster preset speed (signed like `rate`); stays at the ends of the list. */
export function neighbourRate(rate: number, direction: 1 | -1): number {
	const sign = rate < 0 ? -1 : 1;
	const speeds = RATE_PRESETS.map((p) => p.secondsPerSecond);
	const mag = Math.abs(rate) || 1;
	// nearest preset on a log scale
	let idx = 0, best = Infinity;
	speeds.forEach((s, i) => { const d = Math.abs(Math.log(s / mag)); if (d < best) { best = d; idx = i; } });
	const next = Math.min(speeds.length - 1, Math.max(0, idx + direction));
	return sign * speeds[next];
}
