import { describe, expect, it } from 'vitest';
import { SUN_ORBIT_MYR, SUN_TOTAL_SPEED, sunDistanceLy, sunHeightLy, sunHeightPc, SUN_GALAXY } from '../galaxySun';

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
