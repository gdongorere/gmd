// src/lib/astro/clock.ts
// The simulation clock shared by the galaxy engine, the solar-system views and the time HUD.
// It boots at the real current instant (rate 1×, playing), so everything shown is accurate to the
// moment the page loads, then lets the visitor run time forwards or backwards at any rate or jump
// to any date. Time is held as a Julian Date (UT), which has no calendar range limit.

import { DAYS_PER_YEAR, J2000, calendarFromJd, formatDateHuman, formatTime, jdFromUnixMs, unixMsFromJd } from './julian';

export const MAX_ABS_YEARS = 2e9; // ± two billion years from J2000

export interface RatePreset {
	id: string;
	label: string;
	/** Simulated seconds per real second. */
	secondsPerSecond: number;
}

export const RATE_PRESETS: RatePreset[] = [
	{ id: 'live', label: 'Real time', secondsPerSecond: 1 },
	{ id: 'min', label: '1 min/s', secondsPerSecond: 60 },
	{ id: 'hour', label: '1 hour/s', secondsPerSecond: 3600 },
	{ id: 'day', label: '1 day/s', secondsPerSecond: 86400 },
	{ id: 'month', label: '1 month/s', secondsPerSecond: 86400 * 30.4375 },
	{ id: 'year', label: '1 year/s', secondsPerSecond: 86400 * DAYS_PER_YEAR },
	{ id: 'century', label: '100 years/s', secondsPerSecond: 86400 * DAYS_PER_YEAR * 100 },
	{ id: 'kyr', label: '1,000 years/s', secondsPerSecond: 86400 * DAYS_PER_YEAR * 1e3 },
	{ id: '10kyr', label: '10,000 years/s', secondsPerSecond: 86400 * DAYS_PER_YEAR * 1e4 },
	{ id: 'myr', label: '1 Myr/s', secondsPerSecond: 86400 * DAYS_PER_YEAR * 1e6 },
	{ id: '10myr', label: '10 Myr/s', secondsPerSecond: 86400 * DAYS_PER_YEAR * 1e7 },
];

export interface ClockSnapshot {
	jd: number;
	rate: number; // sim seconds per real second, signed
	playing: boolean;
	/** True while the clock is tracking the real current time (1×, forward, playing, no jump). */
	live: boolean;
}

const clampJd = (jd: number) => Math.min(J2000 + MAX_ABS_YEARS * DAYS_PER_YEAR, Math.max(J2000 - MAX_ABS_YEARS * DAYS_PER_YEAR, jd));

type Listener = () => void;

export class SimClock {
	private anchorJd: number;
	private anchorPerf: number;
	private _rate = 1;
	private _playing = true;
	private listeners = new Set<Listener>();
	private perf: () => number;
	private wall: () => number;

	constructor(wall: () => number = () => Date.now(), perf: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
		this.wall = wall;
		this.perf = perf;
		this.anchorJd = jdFromUnixMs(wall());
		this.anchorPerf = perf();
	}

	/** Current simulated Julian Date (UT). */
	jd(): number {
		if (!this._playing) return this.anchorJd;
		return clampJd(this.anchorJd + (this._rate * (this.perf() - this.anchorPerf)) / 1000 / 86400);
	}

	get rate() { return this._rate; }
	get playing() { return this._playing; }

	/** Years since J2000 (for the galaxy engine). */
	yearsSinceJ2000(): number {
		return (this.jd() - J2000) / DAYS_PER_YEAR;
	}

	snapshot(): ClockSnapshot {
		return { jd: this.jd(), rate: this._rate, playing: this._playing, live: this._playing && this._rate === 1 && this.isNearWallClock() };
	}

	private isNearWallClock() {
		return Math.abs(this.jd() - jdFromUnixMs(this.wall())) < 2 / 86400;
	}

	private rebase() {
		this.anchorJd = this.jd();
		this.anchorPerf = this.perf();
	}

	setJd(jd: number) {
		this.anchorJd = clampJd(jd);
		this.anchorPerf = this.perf();
		this.emit();
	}

	setRate(secondsPerSecond: number) {
		this.rebase();
		this._rate = secondsPerSecond;
		this.emit();
	}

	setPlaying(playing: boolean) {
		this.rebase();
		this._playing = playing;
		this.emit();
	}

	/** Step by a number of simulated seconds (jumps; pauses nothing). */
	nudge(seconds: number) {
		this.setJd(this.jd() + seconds / 86400);
	}

	/** Back to the real, current instant at 1×. */
	now() {
		this._rate = 1;
		this._playing = true;
		this.anchorJd = jdFromUnixMs(this.wall());
		this.anchorPerf = this.perf();
		this.emit();
	}

	subscribe(l: Listener) {
		this.listeners.add(l);
		return () => { this.listeners.delete(l); };
	}

	private emit() {
		this.listeners.forEach((l) => l());
	}
}

/** The one clock the app shares. Created lazily so server rendering never touches it. */
let shared: SimClock | null = null;
export const simClock = (): SimClock => (shared ??= new SimClock());
export const resetSimClockForTests = () => { shared = null; };

/** Unix ms for Date-range-safe operations; NaN when outside what Date can represent. */
export const unixMsOrNaN = (jd: number) => {
	const ms = unixMsFromJd(jd);
	return Math.abs(ms) <= 8.64e15 ? ms : NaN;
};

export interface EpochLabel {
	/** "5 Oct 2026" or "19,050 BCE" or "−203 Myr". */
	date: string;
	/** "14:32:07" or "" when time of day is meaningless (deep past/future). */
	time: string;
	/** "now", "19,076 years ago", "in 203 million years". */
	relative: string;
	/** True when the label is a coarse epoch rather than a calendar date. */
	coarse: boolean;
}

const fmtBig = (n: number) => {
	const a = Math.abs(n);
	if (a >= 1e9) return `${(a / 1e9).toFixed(2)} billion`;
	if (a >= 1e6) return `${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)} million`;
	return Math.round(a).toLocaleString('en-US');
};

export function describeEpoch(jd: number, nowJd: number): EpochLabel {
	const years = (jd - nowJd) / DAYS_PER_YEAR;
	const abs = Math.abs(years);
	let relative: string;
	if (abs < 1 / 365.25) relative = 'now';
	else if (abs < 1) relative = years < 0 ? `${Math.round(abs * 365.25)} days ago` : `in ${Math.round(abs * 365.25)} days`;
	else relative = years < 0 ? `${fmtBig(abs)} years ago` : `in ${fmtBig(abs)} years`;

	const y = 2000 + (jd - J2000) / DAYS_PER_YEAR;
	if (Math.abs(y) > 1e6) {
		const myr = (y - (2000 + (nowJd - J2000) / DAYS_PER_YEAR)) / 1e6;
		return { date: `${myr >= 0 ? '+' : '−'}${Math.abs(myr).toFixed(Math.abs(myr) < 10 ? 2 : 0)} Myr`, time: '', relative, coarse: true };
	}
	const c = calendarFromJd(jd);
	// Time of day is only meaningful while ΔT and Earth's spin are known: roughly the last 2,500 years.
	const showTime = y > -500 && y < 3000;
	return { date: formatDateHuman(c), time: showTime ? formatTime(c) : '', relative, coarse: false };
}
