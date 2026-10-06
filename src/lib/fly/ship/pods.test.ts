import { describe, expect, it } from 'vitest';
import { MAX_TILT, podTargets, slew } from './pods';

const H = 100_000;
describe('pod aiming', () => {
	it('hovering: both pods point straight down (tilt 0) at the lift they produce', () => {
		const t = podTargets({ hoverN: 83_000, mainN: 0, yaw: 0, roll: 0 }, H);
		expect(t.left).toBe(0); expect(t.right).toBe(0); expect(t.thrustLeft).toBeCloseTo(0.83, 2); expect(t.thrustLeft).toBe(t.thrustRight);
	});
	it('accelerating forward swings the exhaust aft (positive tilt) in proportion to the forward thrust', () => {
		const half = podTargets({ hoverN: 83_000, mainN: 83_000, yaw: 0, roll: 0 }, H);
		expect(half.left).toBeCloseTo(Math.PI / 4, 5);
		const hard = podTargets({ hoverN: 10_000, mainN: 120_000, yaw: 0, roll: 0 }, H);
		expect(hard.left).toBeGreaterThan(1.4); expect(hard.left).toBeLessThanOrEqual(MAX_TILT);
	});
	it('braking points the exhaust forward (negative tilt)', () => {
		const t = podTargets({ hoverN: 83_000, mainN: -36_000, yaw: 0, roll: 0 }, H);
		expect(t.left).toBeLessThan(-0.3); expect(t.left).toBeCloseTo(t.right, 9);
	});
	it('yaw tilts the pods oppositely: turning right pushes the left pod forward and the right pod back', () => {
		const t = podTargets({ hoverN: 83_000, mainN: 0, yaw: 1, roll: 0 }, H);
		expect(t.left).toBeGreaterThan(0.4); expect(t.right).toBeLessThan(-0.4);
		const l = podTargets({ hoverN: 83_000, mainN: 0, yaw: -1, roll: 0 }, H);
		expect(l.left).toBeLessThan(0); expect(l.right).toBeGreaterThan(0);
	});
	it('roll gives the side that is going down less power', () => {
		const t = podTargets({ hoverN: 83_000, mainN: 0, yaw: 0, roll: 1 }, H);
		expect(t.thrustRight).toBeLessThan(t.thrustLeft);
	});
	it('engines off: pods rest pointing down with no glow; tilt never exceeds its limit', () => {
		const off = podTargets({ hoverN: 0, mainN: 0, yaw: 0, roll: 0 }, H);
		expect(off).toEqual({ left: 0, right: 0, thrustLeft: 0, thrustRight: 0 });
		const wild = podTargets({ hoverN: 0, mainN: 500_000, yaw: 1, roll: 1 }, H);
		expect(Math.abs(wild.left)).toBeLessThanOrEqual(MAX_TILT); expect(Math.abs(wild.right)).toBeLessThanOrEqual(MAX_TILT);
	});
	it('slewing is rate limited and lands exactly on the target', () => {
		expect(slew(0, 1, 2, 0.1)).toBeCloseTo(0.2, 9); expect(slew(0, 0.1, 2, 0.1)).toBe(0.1); expect(slew(1, -1, 2, 0.25)).toBeCloseTo(0.5, 9);
	});
});
