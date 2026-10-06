import { describe, expect, it } from 'vitest';
import { lightingFor, toneMapACES } from './lighting';

describe('lighting from the sky model', () => {
	it('noon: strong white-ish sun, bluish ambient, little haze colour shift', () => {
		const l = lightingFor(100, 60);
		expect(l.sunColor[0]).toBeGreaterThan(0.85); expect(l.skyColor[2]).toBeGreaterThan(l.skyColor[0]); expect(l.starVisibility).toBe(0);
	});
	it('sunset: the sunlight is red-orange, much dimmer, and the exposure rises (eye adaptation)', () => {
		const noon = lightingFor(100, 60), dusk = lightingFor(100, 2);
		expect(dusk.sunColor[0]).toBeGreaterThan(dusk.sunColor[2] * 10); expect(dusk.exposure).toBeGreaterThan(noon.exposure * 3);
	});
	it('night: no sunlight, stars visible, exposure clamped (not turned to daylight)', () => {
		const n = lightingFor(100, -30);
		expect(n.sunColor).toEqual([0, 0, 0]); expect(n.starVisibility).toBe(1); expect(n.exposure).toBeLessThanOrEqual(14);
	});
	it('haze thins with altitude and vanishes in space', () => {
		expect(lightingFor(0, 40).fogDensity).toBeGreaterThan(lightingFor(10000, 40).fogDensity * 4);
		expect(lightingFor(400000, 40).fogDensity).toBeLessThan(1e-12);
	});
	it('exposure never leaves its range and is finite everywhere', () => {
		for (const a of [0, 1000, 20000, 150000, 400000]) for (const e of [-40, -10, -3, 0, 3, 10, 40, 80]) { const l = lightingFor(a, e); expect(Number.isFinite(l.exposure)).toBe(true); expect(l.exposure).toBeGreaterThanOrEqual(0.25); expect(l.exposure).toBeLessThanOrEqual(14); }
	});
	it('ACES maps black to black and bright to near white without exceeding 1', () => {
		expect(toneMapACES([0, 0, 0], 1)).toEqual([0, 0, 0]);
		const w = toneMapACES([8, 8, 8], 1); expect(Math.min(...w)).toBeGreaterThan(0.9); expect(Math.max(...w)).toBeLessThanOrEqual(1);
	});
});
