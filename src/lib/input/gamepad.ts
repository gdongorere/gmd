// src/lib/input/gamepad.ts
// Universal gamepad layer. Targets the DualShock 4 (and DualSense / Xbox / generic pads) through the browser Gamepad API, which is the one
// mechanism that works on desktop, Android, iPhone/iPad and ChromeOS without a driver. It turns whatever the browser reports into one
// normalised state, with three ways to make sense of a pad, in order:
//   1. the W3C "standard" mapping (Chrome, Edge, Safari, Android, iOS all report DS4 this way),
//   2. a built-in DS4 profile for browsers that report a raw layout (e.g. Firefox),
//   3. a mapping the user taught us once through the 30-second wizard (stored locally), which makes ANY pad work.
// Pure TypeScript: no DOM access here except the optional storage helpers, so it is unit-tested with fake pads.

export type Control =
	| 'cross' | 'circle' | 'square' | 'triangle' | 'l1' | 'r1' | 'l2' | 'r2' | 'share' | 'options' | 'l3' | 'r3'
	| 'up' | 'down' | 'left' | 'right' | 'ps' | 'touchpad';

export const CONTROLS: Control[] = ['cross', 'circle', 'square', 'triangle', 'l1', 'r1', 'l2', 'r2', 'share', 'options', 'l3', 'r3', 'up', 'down', 'left', 'right', 'ps', 'touchpad'];

export type PadFamily = 'playstation' | 'xbox' | 'generic';
export type MappingSource = 'standard' | 'profile' | 'learned' | 'fallback';

/** The subset of the browser Gamepad object we use (also what tests fake). */
export interface RawPad {
	id: string;
	index: number;
	connected: boolean;
	mapping: string;
	axes: readonly number[];
	buttons: readonly { pressed: boolean; value: number }[];
	timestamp?: number;
	vibrationActuator?: { playEffect?: (type: string, params: Record<string, number>) => Promise<unknown>; reset?: () => Promise<unknown> } | null;
	hapticActuators?: readonly { pulse?: (value: number, duration: number) => Promise<unknown> }[];
}

export interface PadState {
	id: string;
	index: number;
	family: PadFamily;
	label: string;
	source: MappingSource;
	/** Sticks after radial dead zone and response curve, −1…1 (y positive = down, as reported). */
	lx: number; ly: number; rx: number; ry: number;
	/** Analogue triggers 0…1. */
	l2: number; r2: number;
	down: Record<Control, boolean>;
}

const emptyDown = (): Record<Control, boolean> => Object.fromEntries(CONTROLS.map((c) => [c, false])) as Record<Control, boolean>;

// --- identification -----------------------------------------------------------------------------

/** Sony vendor 054c: DualShock 4 = 05c4 / 09cc / 0ba0 (dongle); DualSense = 0ce6 / 0df2; Xbox vendor 045e. */
export function detectFamily(id: string): PadFamily {
	const s = id.toLowerCase();
	if (/054c|dualshock|dualsense|wireless controller|playstation|ps4|ps5/.test(s)) return 'playstation';
	if (/045e|xbox|xinput/.test(s)) return 'xbox';
	return 'generic';
}

export function padLabel(id: string): string {
	const s = id.toLowerCase();
	if (/0ce6|0df2|dualsense/.test(s)) return 'DualSense';
	if (/05c4|09cc|0ba0|dualshock/.test(s)) return 'DualShock 4';
	if (detectFamily(id) === 'playstation') return 'PlayStation controller';
	if (detectFamily(id) === 'xbox') return 'Xbox controller';
	return 'Gamepad';
}

/** Button names for on-screen hints: PlayStation shapes or Xbox letters. */
export function buttonName(c: Control, family: PadFamily): string {
	const ps: Partial<Record<Control, string>> = { cross: '✕', circle: '○', square: '□', triangle: '△', l1: 'L1', r1: 'R1', l2: 'L2', r2: 'R2', share: 'Share', options: 'Options', l3: 'L3', r3: 'R3', ps: 'PS', touchpad: 'Touchpad' };
	const xb: Partial<Record<Control, string>> = { cross: 'A', circle: 'B', square: 'X', triangle: 'Y', l1: 'LB', r1: 'RB', l2: 'LT', r2: 'RT', share: 'View', options: 'Menu', l3: 'LS', r3: 'RS', ps: 'Home', touchpad: 'Touchpad' };
	const names = family === 'xbox' ? xb : ps;
	return names[c] ?? { up: 'D-pad up', down: 'D-pad down', left: 'D-pad left', right: 'D-pad right' }[c as 'up'] ?? c;
}

// --- mappings -----------------------------------------------------------------------------------

export type Binding = { kind: 'button'; index: number } | { kind: 'axis'; index: number; sign: 1 | -1 };

export interface LearnedMapping {
	v: 1;
	id: string;
	sticks: { lx: Binding | null; ly: Binding | null; rx: Binding | null; ry: Binding | null };
	controls: Partial<Record<Control, Binding>>;
}

/** W3C standard mapping: this is what Chrome, Edge, Safari, Android and iOS report for a DS4. */
const STANDARD_BUTTON: Record<Control, number> = {
	cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, ps: 16, touchpad: 17,
};

/**
 * Raw DS4 layout as reported by some browsers when they do not apply the standard mapping (Firefox on desktop). From memory of the
 * common layout and NOT verified on hardware: if a pad does not behave, the wizard overrides this.
 * Buttons: 0 ▢, 1 ✕, 2 ○, 3 △, 4 L1, 5 R1, 6 L2, 7 R2, 8 Share, 9 Options, 10 L3, 11 R3, 12 PS, 13 touchpad; axes 0 LX, 1 LY, 2 RX, 3 L2, 4 R2, 5 RY, 9 hat.
 */
const DS4_RAW_BUTTON: Partial<Record<Control, number>> = { square: 0, cross: 1, circle: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9, l3: 10, r3: 11, ps: 12, touchpad: 13 };
const DS4_RAW_AXES = { lx: 0, ly: 1, rx: 2, ry: 5, l2: 3, r2: 4, hat: 9 };

/** Hat-switch axis values (−1, −5/7, −3/7, −1/7, 1/7, 3/7, 5/7, 1) → d-pad directions, neutral ≈ 1.28571. */
export function hatToDpad(v: number): { up: boolean; down: boolean; left: boolean; right: boolean } {
	const out = { up: false, down: false, left: false, right: false };
	if (!Number.isFinite(v) || v > 1.1 || v < -1.1) return out;
	const step = Math.round(((v + 1) / 2) * 7); // 0..7 clockwise from up
	if (step === 0 || step === 1 || step === 7) out.up = true;
	if (step >= 1 && step <= 3) out.right = true;
	if (step >= 3 && step <= 5) out.down = true;
	if (step >= 5 && step <= 7) out.left = true;
	return out;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));

/** Radial dead zone with rescale so the edge of the zone maps to 0 and full deflection to 1, then a response curve for fine control near centre. */
export function shapeStick(x: number, y: number, deadzone = 0.14, expo = 1.5): [number, number] {
	x = clamp(x, -1, 1); y = clamp(y, -1, 1);
	const m = Math.hypot(x, y);
	if (m <= deadzone) return [0, 0];
	const scaled = Math.min(1, (m - deadzone) / (1 - deadzone));
	const k = Math.pow(scaled, expo) / m;
	return [x * k, y * k];
}

const bindingValue = (raw: RawPad, b: Binding | null | undefined): number => {
	if (!b) return 0;
	if (b.kind === 'button') { const x = raw.buttons[b.index]; return x ? (x.value > 0 ? x.value : x.pressed ? 1 : 0) : 0; }
	const v = raw.axes[b.index];
	return typeof v === 'number' ? Math.max(0, v * b.sign) : 0;
};

export function normalise(raw: RawPad, learned?: LearnedMapping | null, deadzone = 0.14): PadState {
	const family = detectFamily(raw.id);
	const down = emptyDown();
	let lx = 0, ly = 0, rx = 0, ry = 0, l2 = 0, r2 = 0;
	let source: MappingSource = 'fallback';
	const btn = (i: number) => { const b = raw.buttons[i]; return !!b && (b.pressed || b.value > 0.5); };
	const ax = (i: number) => (typeof raw.axes[i] === 'number' ? raw.axes[i] : 0);

	if (learned && learned.id === raw.id) {
		source = 'learned';
		const stick = (neg: Binding | null, pos: Binding | null) => bindingValue(raw, pos) - bindingValue(raw, neg);
		lx = stick(null, learned.sticks.lx) || -bindingValue(raw, flip(learned.sticks.lx));
		ly = stick(null, learned.sticks.ly) || -bindingValue(raw, flip(learned.sticks.ly));
		rx = stick(null, learned.sticks.rx) || -bindingValue(raw, flip(learned.sticks.rx));
		ry = stick(null, learned.sticks.ry) || -bindingValue(raw, flip(learned.sticks.ry));
		for (const c of CONTROLS) down[c] = bindingValue(raw, learned.controls[c]) > 0.5;
		l2 = bindingValue(raw, learned.controls.l2); r2 = bindingValue(raw, learned.controls.r2);
	} else if (raw.mapping === 'standard') {
		source = 'standard';
		[lx, ly] = [ax(0), ax(1)]; [rx, ry] = [ax(2), ax(3)];
		for (const c of CONTROLS) down[c] = btn(STANDARD_BUTTON[c]);
		l2 = raw.buttons[6]?.value ?? (down.l2 ? 1 : 0); r2 = raw.buttons[7]?.value ?? (down.r2 ? 1 : 0);
	} else if (family === 'playstation' && raw.axes.length >= 6) {
		source = 'profile';
		[lx, ly] = [ax(DS4_RAW_AXES.lx), ax(DS4_RAW_AXES.ly)]; [rx, ry] = [ax(DS4_RAW_AXES.rx), ax(DS4_RAW_AXES.ry)];
		for (const c of CONTROLS) { const i = DS4_RAW_BUTTON[c]; if (i !== undefined) down[c] = btn(i); }
		// Analogue triggers sit on axes −1 (released) … +1 (pressed) in this layout.
		l2 = clamp((ax(DS4_RAW_AXES.l2) + 1) / 2, 0, 1) || (down.l2 ? 1 : 0); r2 = clamp((ax(DS4_RAW_AXES.r2) + 1) / 2, 0, 1) || (down.r2 ? 1 : 0);
		if (raw.axes.length > DS4_RAW_AXES.hat) { const h = hatToDpad(ax(DS4_RAW_AXES.hat)); down.up = h.up; down.down = h.down; down.left = h.left; down.right = h.right; }
	} else {
		// Last resort: assume the first four axes are two sticks and the first buttons are the face buttons. Fine for a first try, then use the wizard.
		[lx, ly] = [ax(0), ax(1)]; [rx, ry] = [ax(2), ax(3)];
		for (const c of CONTROLS) { const i = STANDARD_BUTTON[c]; if (i < raw.buttons.length) down[c] = btn(i); }
		l2 = down.l2 ? 1 : 0; r2 = down.r2 ? 1 : 0;
	}
	const [sx, sy] = shapeStick(lx, ly, deadzone);
	const [tx, ty] = shapeStick(rx, ry, deadzone);
	if (l2 > 0.5) down.l2 = true; if (r2 > 0.5) down.r2 = true;
	return { id: raw.id, index: raw.index, family, label: padLabel(raw.id), source, lx: sx, ly: sy, rx: tx, ry: ty, l2: clamp(l2, 0, 1), r2: clamp(r2, 0, 1), down };
}

function flip(b: Binding | null): Binding | null {
	return b && b.kind === 'axis' ? { kind: 'axis', index: b.index, sign: (b.sign * -1) as 1 | -1 } : null;
}

// --- picking the active pad and detecting presses ---------------------------------------------------

/** Tracks which pad is in use and reports edges (just pressed / just released) between frames. */
export class PadTracker {
	private prev = new Map<number, Record<Control, boolean>>();
	private lastActive = -1;
	constructor(private learnedFor: (id: string) => LearnedMapping | null = () => null) {}

	/** `pads` is the result of navigator.getGamepads() (entries may be null). Returns the active pad, or null. */
	update(pads: readonly (RawPad | null | undefined)[]): { pad: PadState; pressed: Control[]; released: Control[]; anyInput: boolean } | null {
		let best: { state: PadState; score: number } | null = null;
		for (const raw of pads) {
			if (!raw || !raw.connected) continue;
			const state = normalise(raw, this.learnedFor(raw.id));
			const active = Math.abs(state.lx) + Math.abs(state.ly) + Math.abs(state.rx) + Math.abs(state.ry) + state.l2 + state.r2 + CONTROLS.filter((c) => state.down[c]).length;
			// Prefer the pad being touched; otherwise the last one used; otherwise a PlayStation pad over others.
			const score = active * 10 + (raw.index === this.lastActive ? 5 : 0) + (state.family === 'playstation' ? 1 : 0);
			if (!best || score > best.score) best = { state, score };
		}
		if (!best) { this.prev.clear(); return null; }
		const s = best.state;
		this.lastActive = s.index;
		const before = this.prev.get(s.index) ?? emptyDown();
		const pressed = CONTROLS.filter((c) => s.down[c] && !before[c]);
		const released = CONTROLS.filter((c) => !s.down[c] && before[c]);
		this.prev.set(s.index, { ...s.down });
		const anyInput = best.score >= 10;
		return { pad: s, pressed, released, anyInput };
	}
}

// --- vibration ---------------------------------------------------------------------------------------

/** Rumble where the browser allows it (Chrome/Edge dual-rumble, Firefox pulse); silently does nothing elsewhere. Returns whether a request was made. */
export function rumble(raw: RawPad | null | undefined, opts: { strong?: number; weak?: number; ms?: number }): boolean {
	if (!raw) return false;
	const strong = clamp(opts.strong ?? 0.5, 0, 1), weak = clamp(opts.weak ?? 0.5, 0, 1), ms = Math.max(10, Math.min(2000, opts.ms ?? 120));
	try {
		const va = raw.vibrationActuator;
		if (va && typeof va.playEffect === 'function') { void va.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {}); return true; }
		const ha = raw.hapticActuators?.[0];
		if (ha && typeof ha.pulse === 'function') { void ha.pulse(Math.max(strong, weak), ms)?.catch?.(() => {}); return true; }
	} catch { /* unsupported: no rumble */ }
	return false;
}

// --- learning a mapping (wizard) ----------------------------------------------------------------------

export interface LearnStep { key: string; prompt: string; kind: 'stick-x' | 'stick-y' | 'control'; target: 'lx' | 'ly' | 'rx' | 'ry' | Control; optional?: boolean }

export const LEARN_STEPS: LearnStep[] = [
	{ key: 'lx', prompt: 'Push the LEFT stick fully to the right', kind: 'stick-x', target: 'lx' },
	{ key: 'ly', prompt: 'Push the LEFT stick fully down', kind: 'stick-y', target: 'ly' },
	{ key: 'rx', prompt: 'Push the RIGHT stick fully to the right', kind: 'stick-x', target: 'rx' },
	{ key: 'ry', prompt: 'Push the RIGHT stick fully down', kind: 'stick-y', target: 'ry' },
	...(['cross', 'circle', 'square', 'triangle', 'l1', 'r1', 'l2', 'r2', 'share', 'options', 'l3', 'r3', 'up', 'down', 'left', 'right'] as Control[]).map((c) => ({ key: c, prompt: `Press ${buttonName(c, 'playstation')} (${c.toUpperCase()})`, kind: 'control' as const, target: c })),
	{ key: 'ps', prompt: 'Press the PS button (or skip)', kind: 'control', target: 'ps', optional: true },
	{ key: 'touchpad', prompt: 'Click the touchpad (or skip)', kind: 'control', target: 'touchpad', optional: true },
];

/** What changed between a resting snapshot and now: a pressed button, or an axis moved past 0.6 (or a hat axis jumping). */
export function detectBinding(rest: RawPad, now: RawPad): Binding | null {
	for (let i = 0; i < now.buttons.length; i++) {
		const was = rest.buttons[i]; const b = now.buttons[i];
		if (b && (b.pressed || b.value > 0.6) && !(was && (was.pressed || was.value > 0.6))) return { kind: 'button', index: i };
	}
	let bestI = -1, bestD = 0, sign: 1 | -1 = 1;
	for (let i = 0; i < now.axes.length; i++) {
		const d = (now.axes[i] ?? 0) - (rest.axes[i] ?? 0);
		if (Math.abs(d) > Math.abs(bestD)) { bestD = d; bestI = i; sign = d >= 0 ? 1 : -1; }
	}
	if (bestI >= 0 && Math.abs(bestD) >= 0.6) return { kind: 'axis', index: bestI, sign };
	return null;
}

export function emptyLearned(id: string): LearnedMapping {
	return { v: 1, id, sticks: { lx: null, ly: null, rx: null, ry: null }, controls: {} };
}

export function applyLearned(m: LearnedMapping, step: LearnStep, b: Binding | null): LearnedMapping {
	if (!b) return m;
	if (step.kind === 'control') return { ...m, controls: { ...m.controls, [step.target as Control]: b } };
	// A stick axis binding is stored as the direction that means "positive" (right / down).
	return { ...m, sticks: { ...m.sticks, [step.target as 'lx']: b.kind === 'axis' ? b : null } };
}

// --- persistence (guarded: storage can be blocked) -----------------------------------------------------

const KEY = 'gmd.padMappings.v1';

export function parseLearned(raw: string | null): Record<string, LearnedMapping> {
	if (!raw) return {};
	try {
		const data: unknown = JSON.parse(raw);
		if (!data || typeof data !== 'object') return {};
		const out: Record<string, LearnedMapping> = {};
		for (const [id, v] of Object.entries(data as Record<string, unknown>)) {
			const m = v as Partial<LearnedMapping> | null;
			if (!m || m.v !== 1 || typeof m.id !== 'string' || !m.sticks || !m.controls) continue;
			if (!validBinding(m.sticks.lx) || !validBinding(m.sticks.ly) || !validBinding(m.sticks.rx) || !validBinding(m.sticks.ry)) continue;
			if (!Object.values(m.controls).every((b) => validBinding(b as Binding))) continue;
			out[id.slice(0, 200)] = m as LearnedMapping;
		}
		return out;
	} catch { return {}; }
}

function validBinding(b: Binding | null | undefined): boolean {
	if (b === null || b === undefined) return true;
	if (typeof b !== 'object') return false;
	if (b.kind === 'button') return Number.isInteger(b.index) && b.index >= 0 && b.index < 64;
	if (b.kind === 'axis') return Number.isInteger(b.index) && b.index >= 0 && b.index < 64 && (b.sign === 1 || b.sign === -1);
	return false;
}

export function loadLearned(id: string): LearnedMapping | null {
	try { return parseLearned(window.localStorage.getItem(KEY))[id] ?? null; } catch { return null; }
}
export function saveLearned(m: LearnedMapping): boolean {
	try { const all = parseLearned(window.localStorage.getItem(KEY)); all[m.id] = m; window.localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; }
}
export function clearLearned(id: string): void {
	try { const all = parseLearned(window.localStorage.getItem(KEY)); delete all[id]; window.localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* ignore */ }
}
