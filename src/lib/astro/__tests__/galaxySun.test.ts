import { describe, expect, it } from 'vitest';
import { armFanHalfAngleDeg, SUN_ORBIT_MYR, SUN_TOTAL_SPEED, sunDistanceLy, sunHeightLy, sunHeightPc, SUN_GALAXY } from '../galaxySun';

describe('galactic Sun', () => {
	it('R0 = 8.178 kpc ≈ 26,673 ly', () => expect(sunDistanceLy()).toBeCloseTo(26673, -1));
	it('height ≈ 68 ly', () => expect(sunHeightLy()).toBeCloseTo(67.8, 0));
	it('total speed ≈ 247 km/s and lap ≈ 203 Myr', () => {
		expect(SUN_TOTAL_SPEED).toBeGreaterThan(245);
		expect(SUN_TOTAL_SPEED).toBeLessThan(249);
		expect(SUN_ORBIT_MYR).toBeGreaterThan(200);
		expect(SUN_ORBIT_MYR).toBeLessThan(207);
	});
	it('vertical oscillation starts at z0 and is bounded', () => {
		expect(sunHeightPc(0)).toBeCloseTo(SUN_GALAXY.z0.value, 5);
		for (let m = -200; m <= 200; m += 10) expect(Math.abs(sunHeightPc(m * 1e6))).toBeLessThan(110);
	});
});

describe('sunHeightPc continuity', () => {
	it('equals z0 today and varies smoothly (no jumps between 1 kyr steps)', () => {
		expect(sunHeightPc(0)).toBeCloseTo(SUN_GALAXY.z0.value, 6);
		let prev = sunHeightPc(-150e6);
		for (let y = -150e6 + 1e5; y <= 150e6; y += 1e5) {
			const h = sunHeightPc(y);
			expect(Math.abs(h - prev)).toBeLessThan(8); // pc per 0.1 Myr, far below any discontinuity
			prev = h;
		}
	});
	it('oscillates with the stated vertical period', () => {
		expect(sunHeightPc(SUN_GALAXY.verticalPeriodMyr.value * 1e6)).toBeCloseTo(sunHeightPc(0), 4);
	});
});

describe('arm-drift uncertainty fan', () => {
	it('is zero now, grows with |time|, and is symmetric and capped', () => {
		expect(armFanHalfAngleDeg(0)).toBe(0);
		expect(armFanHalfAngleDeg(-50e6)).toBeCloseTo(armFanHalfAngleDeg(50e6), 9);
		expect(armFanHalfAngleDeg(50e6)).toBeGreaterThan(armFanHalfAngleDeg(10e6));
		expect(armFanHalfAngleDeg(1e10)).toBe(180);
	});
});
