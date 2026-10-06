// src/lib/fly/sim/flight.ts
// A simplified but physical flight model for the Kestrel's test arena: gravity, thrust with propellant mass flow, quadratic drag,
// rate-limited attitude control, ground contact and landing classification. Pure TypeScript (three.js vectors only), deterministic,
// SI units. It follows the physicality rules (docs/fly/09): mass changes as propellant burns (ṁ = F/(Isp·g0)), drag uses real air density
// that falls with altitude, and every effect comes from a simulated quantity. It is NOT the final flight engine (no atmosphere
// model per world, no heating, no wind): those come in later phases.

import * as THREE from 'three';
import { G0, KESTREL, type ShipSpec } from '../ships/specs';
import { groundHeight } from './terrain';

export interface FlightState {
	pos: THREE.Vector3;
	vel: THREE.Vector3;
	q: THREE.Quaternion;
	/** Angular velocity in the body frame, rad/s (x = roll about forward, y = yaw about up, z = pitch about the span). Input conventions: yaw + = right, pitch + = nose up, roll + = right wing down. */
	w: THREE.Vector3;
	propellant: number;
	gear: boolean;
	landed: boolean;
	time: number;
	/** Last touchdown report: set when the ship touches the ground; cleared by `clearEvent`. */
	event: null | { kind: 'landed' | 'rough' | 'crash'; speed: number; time: number };
	/** Thrust actually produced this step (N), for effects and sound. */
	hover: number;
	main: number;
}

export interface FlightInput {
	/** Collective: −1…1 (down … up). With the hover assist on it commands vertical speed; off, it sets the hover lever directly. */
	collective: number;
	/** Longitudinal thrust −1…1 (retro … main engine). */
	forward: number;
	/** Lateral RCS −1…1 (left … right). */
	strafe: number;
	yaw: number; pitch: number; roll: number;
}

export const NO_INPUT: FlightInput = { collective: 0, forward: 0, strafe: 0, yaw: 0, pitch: 0, roll: 0 };

export interface FlightOptions {
	spec?: ShipSpec;
	/** Surface gravity m/s² (default Earth). */
	g?: number;
	/** Constant air density override (kg/m³); default is Earth's exponential atmosphere. */
	rho?: number;
	/** Hover assist: holds a commanded vertical speed. */
	hoverAssist?: boolean;
	/** Level assist: gently returns pitch and roll to upright when there is no attitude input. */
	levelAssist?: boolean;
	groundHeight?: (x: number, z: number) => number;
}

/** Feet below the origin with the gear out / folded (the belly rests on the ground when folded). */
export const FOOT_OFFSET = { down: 2.03, up: 1.3 };
const MAX_RATE = { yaw: 1.1, pitch: 0.9, roll: 1.2 };
const RETRO_FRACTION = 0.3;
const RCS_FORCE = 20_000;

export const airDensity = (altitude: number) => 1.225 * Math.exp(-Math.max(0, altitude) / 8500);

export function initialState(spec: ShipSpec = KESTREL): FlightState {
	const h = groundHeight(0, 0);
	return {
		pos: new THREE.Vector3(0, h + FOOT_OFFSET.down, 0), vel: new THREE.Vector3(), q: new THREE.Quaternion(), w: new THREE.Vector3(),
		propellant: spec.mass.propellant, gear: true, landed: true, time: 0, event: null, hover: 0, main: 0,
	};
}

export const totalMass = (s: FlightState, spec: ShipSpec = KESTREL) => spec.mass.dry + s.propellant;

const UP = new THREE.Vector3(0, 1, 0);
const tmp = { f: new THREE.Vector3(), u: new THREE.Vector3(), r: new THREE.Vector3(), a: new THREE.Vector3(), t: new THREE.Vector3(), e: new THREE.Euler(), qd: new THREE.Quaternion() };

/** Ship axes in the world frame: +X forward, +Y up, +Z right-hand span axis (the model's convention). */
export function axes(q: THREE.Quaternion) {
	return { fwd: new THREE.Vector3(1, 0, 0).applyQuaternion(q), up: new THREE.Vector3(0, 1, 0).applyQuaternion(q), right: new THREE.Vector3(0, 0, 1).applyQuaternion(q) };
}

/** Advances the ship by `dt` seconds (sub-stepped internally at ≤ 1/120 s). Mutates and returns `s`. */
export function step(s: FlightState, input: FlightInput, dt: number, opts: FlightOptions = {}): FlightState {
	const n = Math.max(1, Math.ceil(dt * 120));
	const h = dt / n;
	for (let i = 0; i < n; i++) substep(s, input, h, opts);
	return s;
}

function substep(s: FlightState, input: FlightInput, dt: number, opts: FlightOptions) {
	const spec = opts.spec ?? KESTREL, g = opts.g ?? 9.81, ground = opts.groundHeight ?? groundHeight;
	const clamp1 = (v: number) => Math.max(-1, Math.min(1, Number.isFinite(v) ? v : 0));
	const inp = { collective: clamp1(input.collective), forward: clamp1(input.forward), strafe: clamp1(input.strafe), yaw: clamp1(input.yaw), pitch: clamp1(input.pitch), roll: clamp1(input.roll) };
	const m = totalMass(s, spec);
	const { fwd, up, right } = axes(s.q);
	const hasFuel = s.propellant > 0;

	// --- attitude: rate commands with a first-order response (≈ 0.25 s), plus an optional gentle return to upright ---
	let cmdRoll = inp.roll * MAX_RATE.roll, cmdPitch = inp.pitch * MAX_RATE.pitch;
	const cmdYaw = -inp.yaw * MAX_RATE.yaw; // positive input = turn right (a positive rotation about +Y turns the nose left)
	if ((opts.levelAssist ?? true) && !s.landed) {
		// Tilt errors read from the world vertical: right.y < 0 means the right wing is low (roll left to fix); fwd.y > 0 means nose up (pitch down to fix).
		if (inp.roll === 0) cmdRoll += right.y * 1.6;
		if (inp.pitch === 0) cmdPitch += -fwd.y * 1.6;
	}
	const k = 1 - Math.exp(-dt / 0.25);
	// Body rates: roll about X (forward), yaw about Y (up), pitch about Z (span). Positive pitch input = nose up.
	s.w.x += (cmdRoll - s.w.x) * k; s.w.y += (cmdYaw - s.w.y) * k; s.w.z += (cmdPitch - s.w.z) * k;
	if (s.landed) { s.w.x *= 0.2; s.w.z *= 0.2; }
	// Integrate attitude: q ← q · exp(w dt) (body frame rates).
	tmp.e.set(s.w.x * dt, s.w.y * dt, s.w.z * dt, 'XYZ');
	tmp.qd.setFromEuler(tmp.e);
	s.q.multiply(tmp.qd).normalize();

	// --- thrust ---
	const hoverMax = spec.thrust.hover, mainMax = spec.thrust.main;
	let hover = 0;
	if (opts.hoverAssist ?? true) {
		// Command a vertical speed of ±8 m/s; the assist computes the hover thrust that tracks it, compensating for tilt.
		const vzCmd = inp.collective * 8;
		const aCmd = g + 2.2 * (vzCmd - s.vel.y);
		hover = (m * aCmd) / Math.max(0.25, up.y);
	} else {
		hover = hoverMax * (0.5 + 0.5 * inp.collective); // lever mid-position ≈ 50 %
	}
	hover = hasFuel ? Math.min(hoverMax, Math.max(0, hover)) : 0;
	const mainCmd = inp.forward >= 0 ? inp.forward * mainMax : inp.forward * mainMax * RETRO_FRACTION;
	const main = hasFuel ? mainCmd : 0; // signed: negative = retro burn
	const rcs = hasFuel ? inp.strafe * RCS_FORCE : 0;

	// --- forces ---
	const altitude = s.pos.y - ground(s.pos.x, s.pos.z);
	const rho = opts.rho ?? airDensity(altitude);
	const speed = s.vel.length();
	tmp.a.set(0, -g, 0);
	tmp.t.copy(up).multiplyScalar(hover / m).add(tmp.f.copy(fwd).multiplyScalar(main / m)).add(tmp.r.copy(right).multiplyScalar(rcs / m));
	tmp.a.add(tmp.t);
	tmp.a.addScaledVector(s.vel, (-0.5 * rho * spec.cdA * speed) / m); // quadratic drag, F = ½ρ C_D A |v| v
	s.vel.addScaledVector(tmp.a, dt);
	s.pos.addScaledVector(s.vel, dt);

	// --- propellant: ṁ = F / (Isp g0); mass falls as it burns ---
	const burn = (Math.abs(hover) + Math.abs(main) + Math.abs(rcs) * 0.2) / (spec.isp * G0) * dt;
	s.propellant = Math.max(0, s.propellant - burn);
	s.hover = hover; s.main = Math.abs(main);

	// --- ground contact ---
	const foot = s.gear ? FOOT_OFFSET.down : FOOT_OFFSET.up;
	const gy = ground(s.pos.x, s.pos.z) + foot;
	if (s.pos.y <= gy) {
		const impact = -s.vel.y;
		if (!s.landed && impact > 0.05) {
			const hspeed = Math.hypot(s.vel.x, s.vel.z);
			const tilt = Math.acos(Math.min(1, Math.max(-1, up.dot(UP)))) * (180 / Math.PI);
			const bad = Math.max(impact / spec.landing.maxVz, hspeed / 2.5, tilt / (spec.landing.maxSlopeDeg * 1.2));
			const kind = !s.gear ? (impact > 1.5 ? 'crash' : 'rough') : bad > 2 ? 'crash' : bad > 1 ? 'rough' : 'landed';
			// Keep the worst report until it is shown: a hard hit that bounces must not be overwritten by the gentle second touch.
			const rank = { landed: 0, rough: 1, crash: 2 } as const;
			if (!s.event || rank[kind] > rank[s.event.kind]) s.event = { kind, speed: impact, time: s.time };
		}
		s.pos.y = gy;
		if (s.vel.y < 0) s.vel.y = impact > 2 ? impact * 0.12 : 0;
		const f = Math.exp(-dt * (s.gear ? 3.2 : 6)); // wheel/skid friction
		s.vel.x *= f; s.vel.z *= f;
		s.landed = s.vel.y <= 0.2 && up.y > 0.7 && hover < m * g * 1.02;
	} else if (s.pos.y > gy + 0.3) {
		s.landed = false;
	}
	s.time += dt;
}

export const clearEvent = (s: FlightState) => { s.event = null; };

/** Reset to the pad. */
export function resetToPad(s: FlightState, spec: ShipSpec = KESTREL) { Object.assign(s, initialState(spec)); }

export interface Telemetry { speed: number; altitude: number; verticalSpeed: number; heading: number; fuelFraction: number; mass: number; hover: number; main: number }
export function telemetry(s: FlightState, spec: ShipSpec = KESTREL, ground: (x: number, z: number) => number = groundHeight): Telemetry {
	const foot = s.gear ? FOOT_OFFSET.down : FOOT_OFFSET.up;
	const { fwd } = axes(s.q);
	return {
		speed: s.vel.length(), altitude: Math.max(0, s.pos.y - foot - ground(s.pos.x, s.pos.z)), verticalSpeed: s.vel.y,
		heading: (((Math.atan2(fwd.z, fwd.x) * 180) / Math.PI) + 360) % 360, fuelFraction: s.propellant / spec.mass.propellant,
		mass: totalMass(s, spec), hover: s.hover / spec.thrust.hover, main: s.main / spec.thrust.main,
	};
}
