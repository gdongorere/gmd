import { describe, expect, it, vi } from 'vitest';
import {
	LEARN_STEPS, PadTracker, applyLearned, buttonName, detectBinding, detectFamily, emptyLearned, hatToDpad, normalise, padLabel, parseLearned, rumble, shapeStick,
	type RawPad,
} from './gamepad';

const btn = (pressed = false, value = pressed ? 1 : 0) => ({ pressed, value });
function pad(over: Partial<RawPad> & { pressedIdx?: number[]; axes?: number[] } = {}): RawPad {
	const buttons = Array.from({ length: 18 }, (_, i) => btn(!!over.pressedIdx?.includes(i)));
	const { pressedIdx: _p, ...rest } = over; void _p;
	return { id: 'Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons, ...rest };
}

describe('identification', () => {
	it('recognises the DS4 under the ids browsers actually use', () => {
		for (const id of ['Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)', '054c-09cc-Wireless Controller', 'Wireless Controller (054c, 05c4)', 'PS4 Controller']) {
			expect(detectFamily(id)).toBe('playstation');
		}
		expect(padLabel('054c-09cc-Wireless Controller')).toBe('DualShock 4');
		expect(padLabel('054c-0ce6-Wireless Controller')).toBe('DualSense');
		expect(detectFamily('Xbox 360 Controller (XInput STANDARD GAMEPAD)')).toBe('xbox');
		expect(detectFamily('Some Pad')).toBe('generic');
	});
	it('labels buttons with PlayStation shapes or Xbox letters', () => {
		expect(buttonName('cross', 'playstation')).toBe('✕');
		expect(buttonName('cross', 'xbox')).toBe('A');
		expect(buttonName('up', 'playstation')).toBe('D-pad up');
	});
});

describe('standard mapping (Chrome, Edge, Safari, Android, iOS)', () => {
	it('maps sticks, triggers and buttons', () => {
		const p = normalise(pad({ axes: [1, 0, 0, -1], pressedIdx: [0, 4, 12, 17] }));
		expect(p.source).toBe('standard');
		expect(p.lx).toBeGreaterThan(0.95);
		expect(p.ry).toBeLessThan(-0.95);
		expect(p.down.cross && p.down.l1 && p.down.up && p.down.touchpad).toBe(true);
		expect(p.down.circle).toBe(false);
	});
	it('reads analogue triggers from button values', () => {
		const b = Array.from({ length: 18 }, () => btn());
		b[7] = { pressed: true, value: 0.8 };
		const p = normalise(pad({ buttons: b }));
		expect(p.r2).toBeCloseTo(0.8, 5);
		expect(p.down.r2).toBe(true);
		expect(p.l2).toBe(0);
	});
});

describe('raw DS4 layout (e.g. Firefox)', () => {
	it('uses the built-in profile when the mapping is not standard', () => {
		const buttons = Array.from({ length: 14 }, (_, i) => btn(i === 1));
		const axes = [0, 0, 0, -1, -1, 0, 0, 0, 0, 1.2857];
		const p = normalise({ id: '054c-09cc-Wireless Controller', index: 0, connected: true, mapping: '', axes, buttons });
		expect(p.source).toBe('profile');
		expect(p.down.cross).toBe(true); // raw index 1 is ✕ in this layout
		expect(p.l2).toBe(0);
	});
	it('decodes the hat axis into d-pad directions', () => {
		expect(hatToDpad(-1)).toEqual({ up: true, down: false, left: false, right: false });
		expect(hatToDpad(-3 / 7)).toMatchObject({ right: true });
		expect(hatToDpad(1 / 7)).toMatchObject({ down: true });
		expect(hatToDpad(5 / 7)).toMatchObject({ left: true });
		expect(hatToDpad(1.2857)).toEqual({ up: false, down: false, left: false, right: false });
	});
});

describe('stick shaping', () => {
	it('has a radial dead zone and reaches full deflection', () => {
		expect(shapeStick(0.1, 0.05)).toEqual([0, 0]);
		const [x, y] = shapeStick(1, 0);
		expect(x).toBeCloseTo(1, 5); expect(y).toBeCloseTo(0, 5);
	});
	it('is monotone and gentle near the centre (finer control)', () => {
		const a = shapeStick(0.3, 0)[0], b = shapeStick(0.6, 0)[0], c = shapeStick(0.9, 0)[0];
		expect(a).toBeLessThan(b); expect(b).toBeLessThan(c);
		expect(a).toBeLessThan(0.3);
	});
	it('rejects non-finite values', () => {
		expect(shapeStick(NaN, Infinity)).toEqual([0, 0]);
	});
});

describe('PadTracker', () => {
	it('reports presses and releases once, and none when no pad is connected', () => {
		const t = new PadTracker();
		expect(t.update([null, undefined])).toBeNull();
		const a = t.update([pad()])!;
		expect(a.pressed).toEqual([]);
		const b = t.update([pad({ pressedIdx: [0] })])!;
		expect(b.pressed).toEqual(['cross']);
		const c = t.update([pad({ pressedIdx: [0] })])!;
		expect(c.pressed).toEqual([]);
		const d = t.update([pad()])!;
		expect(d.released).toEqual(['cross']);
	});
	it('prefers the pad that is being used', () => {
		const t = new PadTracker();
		const idle = pad({ index: 0, id: 'Some Pad', mapping: 'standard' });
		const used = pad({ index: 1, axes: [0.9, 0, 0, 0] });
		expect(t.update([idle, used])!.pad.index).toBe(1);
		expect(t.update([idle, pad({ index: 1 })])!.pad.index).toBe(1); // sticks to the last-used pad
	});
	it('ignores disconnected pads', () => {
		const t = new PadTracker();
		expect(t.update([pad({ connected: false })])).toBeNull();
	});
});

describe('learning a mapping for an unknown pad', () => {
	it('detects a pressed button and a moved axis', () => {
		const rest = pad({ mapping: '', axes: [0, 0, 0, 0, 0, 0] });
		const pressed = pad({ mapping: '', axes: [0, 0, 0, 0, 0, 0], pressedIdx: [5] });
		expect(detectBinding(rest, pressed)).toEqual({ kind: 'button', index: 5 });
		const moved = pad({ mapping: '', axes: [0, 0, 0, 0, 0.9, 0] });
		expect(detectBinding(rest, moved)).toEqual({ kind: 'axis', index: 4, sign: 1 });
		const movedNeg = pad({ mapping: '', axes: [0, -1, 0, 0, 0, 0] });
		expect(detectBinding(rest, movedNeg)).toEqual({ kind: 'axis', index: 1, sign: -1 });
		expect(detectBinding(rest, rest)).toBeNull();
	});
	it('a learned mapping drives normalise() even for a pad with a scrambled layout', () => {
		const id = 'Weird Pad 1234';
		let m = emptyLearned(id);
		const scrambled: Record<string, { kind: 'button' | 'axis'; index: number; sign?: 1 | -1 }> = {
			lx: { kind: 'axis', index: 3, sign: 1 }, ly: { kind: 'axis', index: 2, sign: 1 }, rx: { kind: 'axis', index: 5, sign: 1 }, ry: { kind: 'axis', index: 4, sign: 1 },
			cross: { kind: 'button', index: 7 }, circle: { kind: 'button', index: 2 },
		};
		for (const step of LEARN_STEPS) {
			const b = scrambled[step.key];
			if (b) m = applyLearned(m, step, b.kind === 'axis' ? { kind: 'axis', index: b.index, sign: b.sign ?? 1 } : { kind: 'button', index: b.index });
		}
		const raw: RawPad = { id, index: 0, connected: true, mapping: '', axes: [0, 0, 0.9, 0.9, 0, 0], buttons: Array.from({ length: 10 }, (_, i) => btn(i === 7)) };
		const p = normalise(raw, m);
		expect(p.source).toBe('learned');
		expect(p.down.cross).toBe(true);
		expect(p.down.circle).toBe(false);
		expect(p.lx).toBeGreaterThan(0.5); // axis 3 → left stick X
		expect(p.ly).toBeGreaterThan(0.5); // axis 2 → left stick Y
		const neg = normalise({ ...raw, axes: [0, 0, 0, -1, 0, 0] }, m);
		expect(neg.lx).toBeLessThan(-0.5);
	});
});

describe('stored mappings are validated', () => {
	it('rejects junk and keeps well-formed entries', () => {
		expect(parseLearned(null)).toEqual({});
		expect(parseLearned('nope')).toEqual({});
		const good = { v: 1, id: 'x', sticks: { lx: { kind: 'axis', index: 0, sign: 1 }, ly: null, rx: null, ry: null }, controls: { cross: { kind: 'button', index: 3 } } };
		const bad = { v: 1, id: 'y', sticks: { lx: { kind: 'axis', index: 999, sign: 1 }, ly: null, rx: null, ry: null }, controls: {} };
		const out = parseLearned(JSON.stringify({ x: good, y: bad, z: 5, w: { v: 2 } }));
		expect(Object.keys(out)).toEqual(['x']);
	});
});

describe('rumble', () => {
	it('uses dual-rumble where present and clamps values', () => {
		const playEffect = vi.fn().mockResolvedValue(undefined);
		expect(rumble(pad({ vibrationActuator: { playEffect } }), { strong: 5, weak: -1, ms: 99999 })).toBe(true);
		expect(playEffect).toHaveBeenCalledWith('dual-rumble', { startDelay: 0, duration: 2000, strongMagnitude: 1, weakMagnitude: 0 });
	});
	it('falls back to pulse, and quietly does nothing when unsupported', () => {
		const pulse = vi.fn().mockResolvedValue(undefined);
		expect(rumble(pad({ hapticActuators: [{ pulse }] }), { strong: 0.4 })).toBe(true);
		expect(pulse).toHaveBeenCalled();
		expect(rumble(pad(), {})).toBe(false);
		expect(rumble(null, {})).toBe(false);
	});
});
