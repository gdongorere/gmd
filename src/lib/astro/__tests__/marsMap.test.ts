import { describe, expect, it } from 'vitest';
import { marsDarkness, northCapEdge, southCapEdge, angularDistance } from '../marsMap';

describe('Mars schematic map', () => {
	it('dark at Syrtis Major, bright in Hellas', () => {
		expect(marsDarkness(8, 69)).toBeGreaterThan(0.6);
		expect(marsDarkness(-42, 70)).toBeLessThan(-0.6);
	});
	it('caps are largest in their winter and smallest in summer', () => {
		expect(northCapEdge(0)).toBeLessThan(northCapEdge(120)); // spring recedes poleward
		expect(southCapEdge(90)).toBeGreaterThan(-65); // south winter cap reaches ~ −58°
		expect(Math.abs(southCapEdge(90))).toBeLessThan(Math.abs(southCapEdge(270)));
	});
	it('angular distance is symmetric and 180° at antipodes', () => {
		expect(angularDistance(10, 20, -10, -160)).toBeCloseTo(180, 3);
	});
});
