// src/lib/fly/ship/pods.ts
// How the two engine pods are aimed. Each pod is a free-pivoting thruster (about the span axis): tilt 0 points its exhaust straight down
// (pure lift), a positive tilt swings the exhaust aft so the thrust pushes the ship FORWARD, and a negative tilt swings it forward so the
// thrust pushes the ship BACK (braking). The pitch comes from the thrust the flight model is actually producing (atan2 of the forward and
// lift components, so what you see is what the physics does); yaw tilts the two pods oppositely (the left forward, the right back to turn
// right), and roll gives one pod more power than the other (less on the side that is going down).

export interface PodCommand {
	/** Lift (up) and forward thrust actually produced, newtons; forward is negative while braking. */
	hoverN: number;
	mainN: number;
	/** Pilot inputs, −1…1 (yaw + = turn right, roll + = right wing down). */
	yaw: number;
	roll: number;
}

export interface PodTarget { left: number; right: number; thrustLeft: number; thrustRight: number }

/** Tilt range (rad): a little past horizontal either way. */
export const MAX_TILT = 1.75;
const YAW_TILT = 0.45;
const ROLL_POWER = 0.3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** `liftScale` is the lift thrust that counts as full power (the hover engines' rating). */
export function podTargets(c: PodCommand, liftScale: number): PodTarget {
	const mag = Math.hypot(c.hoverN, c.mainN);
	const tilt = mag < 1 ? 0 : Math.atan2(c.mainN, Math.max(c.hoverN, 0));
	const base = clamp(mag / Math.max(1, liftScale), 0, 1);
	const yaw = clamp(c.yaw, -1, 1) * YAW_TILT, roll = clamp(c.roll, -1, 1);
	return {
		left: clamp(tilt + yaw, -MAX_TILT, MAX_TILT),
		right: clamp(tilt - yaw, -MAX_TILT, MAX_TILT),
		thrustLeft: clamp(base * (1 + ROLL_POWER * roll), 0, 1),
		thrustRight: clamp(base * (1 - ROLL_POWER * roll), 0, 1),
	};
}

/** Move `current` toward `target` at most `rate` rad/s (the pods slew; they do not snap). */
export function slew(current: number, target: number, rate: number, dt: number): number {
	const d = target - current, step = rate * dt;
	return Math.abs(d) <= step ? target : current + Math.sign(d) * step;
}
