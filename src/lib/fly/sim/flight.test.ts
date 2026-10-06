import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { FOOT_OFFSET, NO_INPUT, airDensity, axes, initialState, resetToPad, step, telemetry, totalMass, type FlightState } from './flight';
import { ARENA_HALF_SIZE, PAD_RADIUS, groundHeight } from './terrain';
import { G0, KESTREL, ballisticCoefficient, terminalSpeed } from '../ships/specs';

const flat = () => 0;
const run = (s: FlightState, input: Parameters<typeof step>[1], seconds: number, opts: Parameters<typeof step>[3] = {}) => { for (let i = 0; i < seconds * 60; i++) step(s, input, 1 / 60, opts); return s; };
const sky = (h = 1000) => { const s = initialState(); s.pos.set(0, h, 0); s.landed = false; return s; };

describe('terrain', () => {
	it('is flat on the pad, deterministic, and finite everywhere in the arena', () => {
		expect(groundHeight(0, 0)).toBe(0);
		expect(groundHeight(PAD_RADIUS - 1, 0)).toBe(0);
		expect(groundHeight(123.4, -56.7)).toBe(groundHeight(123.4, -56.7));
		for (let x = -ARENA_HALF_SIZE; x <= ARENA_HALF_SIZE; x += 75) for (let z = -ARENA_HALF_SIZE; z <= ARENA_HALF_SIZE; z += 75) expect(Number.isFinite(groundHeight(x, z))).toBe(true);
	});
});

describe('atmosphere', () => {
	it('density falls with altitude and equals 1.225 at sea level', () => {
		expect(airDensity(0)).toBeCloseTo(1.225, 6);
		expect(airDensity(8500)).toBeCloseTo(1.225 / Math.E, 6);
		expect(airDensity(5000)).toBeLessThan(airDensity(1000));
	});
});

describe('flight model physics', () => {
	it('rests on the pad with the gear out and does not drift', () => {
		const s = initialState();
		run(s, NO_INPUT, 5, { groundHeight: flat });
		expect(s.landed).toBe(true);
		expect(s.pos.y).toBeCloseTo(FOOT_OFFSET.down, 3);
		expect(s.vel.length()).toBeLessThan(1e-3);
	});

	it('free fall in a constant atmosphere reaches the terminal speed √(2βg/ρ) (within 2 %)', () => {
		const s = sky(20000); s.propellant = KESTREL.mass.propellant;
		run(s, NO_INPUT, 40, { rho: 1.225, hoverAssist: false, spec: { ...KESTREL, thrust: { main: 0, hover: 0 } }, groundHeight: () => -1e9 });
		const vt = terminalSpeed(KESTREL, 9.81, 1.225);
		expect(-s.vel.y / vt).toBeGreaterThan(0.98); expect(-s.vel.y / vt).toBeLessThan(1.02);
	});

	it('the hover lever at weight/thrust gives zero vertical acceleration (assist off)', () => {
		const s = sky(500);
		const lever = (totalMass(s) * 9.81) / KESTREL.thrust.hover; // 0.834
		const collective = (lever - 0.5) / 0.5;
		run(s, { ...NO_INPUT, collective }, 2, { hoverAssist: false, rho: 0, groundHeight: flat, levelAssist: false });
		expect(Math.abs(s.vel.y)).toBeLessThan(0.15);
	});

	it('the hover assist holds a commanded climb rate of 8 m/s', () => {
		const s = sky(500);
		run(s, { ...NO_INPUT, collective: 1 }, 8, { groundHeight: flat, rho: 0 });
		expect(s.vel.y).toBeGreaterThan(7.6); expect(s.vel.y).toBeLessThan(8.4);
	});

	it('obeys the rocket equation: Δv = Isp·g0·ln(m0/m1) for a main-engine burn in zero gravity and vacuum (within 1 %)', () => {
		const s = sky(0); s.q.identity();
		const m0 = totalMass(s);
		run(s, { ...NO_INPUT, forward: 1, collective: -1 }, 60, { g: 0, rho: 0, hoverAssist: false, levelAssist: false, groundHeight: () => -1e9 }); // collective −1 = hover lever at zero: only the main engine burns
		const m1 = totalMass(s);
		const dvIdeal = KESTREL.isp * G0 * Math.log(m0 / m1);
		expect(s.vel.length() / dvIdeal).toBeGreaterThan(0.99); expect(s.vel.length() / dvIdeal).toBeLessThan(1.01);
	});

	it('burns propellant and gets lighter while thrusting', () => {
		const s = sky(500);
		const m0 = totalMass(s);
		run(s, { ...NO_INPUT, collective: 0 }, 10, { groundHeight: flat, rho: 0 });
		expect(totalMass(s)).toBeLessThan(m0);
		expect(telemetry(s).fuelFraction).toBeLessThan(1);
	});

	it('with no propellant the engines produce nothing and the ship falls', () => {
		const s = sky(500); s.propellant = 0;
		run(s, { ...NO_INPUT, collective: 1, forward: 1 }, 2, { groundHeight: flat, rho: 0 });
		expect(s.vel.y).toBeLessThan(-15);
		expect(s.hover).toBe(0);
	});

	it('yaw input turns the nose right; pitch up raises it; roll right tips the right wing down', () => {
		const a = sky(); run(a, { ...NO_INPUT, yaw: 1 }, 1, { groundHeight: flat, levelAssist: false, rho: 0 });
		expect(axes(a.q).fwd.z).toBeGreaterThan(0.3); // right = +Z
		const b = sky(); run(b, { ...NO_INPUT, pitch: 1 }, 1, { groundHeight: flat, levelAssist: false, rho: 0 });
		expect(axes(b.q).fwd.y).toBeGreaterThan(0.3);
		const c = sky(); run(c, { ...NO_INPUT, roll: 1 }, 1, { groundHeight: flat, levelAssist: false, rho: 0 });
		expect(axes(c.q).up.z).toBeGreaterThan(0.3);
	});

	it('the level assist brings a tilted ship back toward upright', () => {
		const s = sky(); s.q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5);
		const before = axes(s.q).up.y;
		run(s, NO_INPUT, 6, { groundHeight: flat, rho: 0 });
		expect(axes(s.q).up.y).toBeGreaterThan(before);
		expect(axes(s.q).up.y).toBeGreaterThan(0.95);
	});

	it('main engine accelerates along the nose; retro is weaker than main', () => {
		const a = sky(); run(a, { ...NO_INPUT, forward: 1 }, 2, { groundHeight: flat, rho: 0, g: 0, levelAssist: false, hoverAssist: false });
		const b = sky(); run(b, { ...NO_INPUT, forward: -1 }, 2, { groundHeight: flat, rho: 0, g: 0, levelAssist: false, hoverAssist: false });
		expect(a.vel.x).toBeGreaterThan(0); expect(b.vel.x).toBeLessThan(0);
		expect(Math.abs(b.vel.x)).toBeLessThan(a.vel.x * 0.5);
	});

	it('classifies touchdowns: gentle = landed, fast = rough or crash; folded gear is worse', () => {
		const soft = initialState(); soft.pos.set(0, 6, 0); soft.vel.set(0, -2, 0); soft.landed = false;
		run(soft, { ...NO_INPUT, collective: -0.2 }, 6); // assist commands a 1.6 m/s descent
		expect(soft.event?.kind).toBe('landed');
		const hard = initialState(); hard.pos.set(0, 12, 0); hard.vel.set(0, -14, 0); hard.landed = false;
		const hardInput = { ...NO_INPUT, collective: -1 };
		run(hard, hardInput, 3, { hoverAssist: false, rho: 1.225 });
		expect(['rough', 'crash']).toContain(hard.event?.kind);
		const noGear = initialState(); noGear.gear = false; noGear.pos.set(0, 4, 0); noGear.vel.set(0, -4, 0); noGear.landed = false;
		run(noGear, hardInput, 3, { hoverAssist: false });
		expect(['rough', 'crash']).toContain(noGear.event?.kind);
	});

	it('is deterministic: the same inputs give the same state', () => {
		const run1 = () => { const s = sky(300); run(s, { ...NO_INPUT, collective: 0.4, forward: 0.3, yaw: 0.2, pitch: 0.1 }, 6, { groundHeight: flat }); return [s.pos.toArray(), s.vel.toArray(), s.q.toArray(), s.propellant]; };
		expect(run1()).toEqual(run1());
	});

	it('ignores non-finite inputs', () => {
		const s = sky();
		run(s, { collective: NaN, forward: Infinity, strafe: NaN, yaw: NaN, pitch: NaN, roll: NaN }, 1, { groundHeight: flat });
		expect(Number.isFinite(s.pos.y) && Number.isFinite(s.vel.x)).toBe(true);
	});

	it('resetToPad restores the pad state', () => {
		const s = sky(); run(s, { ...NO_INPUT, forward: 1 }, 2, { groundHeight: flat });
		resetToPad(s);
		expect(s.landed).toBe(true); expect(s.propellant).toBe(KESTREL.mass.propellant); expect(s.vel.length()).toBe(0);
	});
});

describe('ballistic coefficient used by the sim matches the spec', () => {
	it('β ≈ 157 kg/m²', () => expect(ballisticCoefficient(KESTREL)).toBeCloseTo(157, 0));
});
