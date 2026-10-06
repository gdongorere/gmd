import { describe, expect, it } from 'vitest';
import { KESTREL, ballisticCoefficient, deltaV, terminalSpeed, thrustToWeight } from './specs';

describe('Kestrel performance matches the roster (docs/fly/11-ship-roster.md §1)', () => {
	it('Δv ≈ 14.9 km/s at full tanks', () => expect(deltaV(KESTREL) / 1000).toBeCloseTo(14.9, 1));
	it('β ≈ 157 kg/m²', () => expect(ballisticCoefficient(KESTREL)).toBeCloseTo(157, 0));
	it('thrust-to-weight: Earth 2.64, Mars 6.98, Moon 15.98', () => {
		expect(thrustToWeight(KESTREL, 9.81)).toBeCloseTo(2.64, 2);
		expect(thrustToWeight(KESTREL, 3.71)).toBeCloseTo(6.98, 1);
		expect(thrustToWeight(KESTREL, 1.62)).toBeCloseTo(15.98, 0);
	});
	it('hover ducts alone can hold it up on Earth (TWR 1.2)', () => {
		expect(KESTREL.thrust.hover / ((KESTREL.mass.dry + KESTREL.mass.propellant) * 9.81)).toBeCloseTo(1.2, 1);
	});
	it('terminal speeds: Earth sea level 50 m/s, Mars surface 242 m/s', () => {
		expect(terminalSpeed(KESTREL, 9.81, 1.225)).toBeCloseTo(50, 0);
		expect(terminalSpeed(KESTREL, 3.71, 0.02)).toBeCloseTo(242, 0);
	});
});
