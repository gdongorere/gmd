import { describe, expect, it } from 'vitest';
import { buildKestrel } from './kestrel';
import { KESTREL } from '../ships/specs';

const model = () => buildKestrel({ glass: 'simple', textures: false, detail: 32 });

describe('Kestrel procedural model', () => {
	it('matches the spec size (length 9.5 m, span 8 m, height 3.8 m, ±0.3 m)', () => {
		const m = model();
		const { size } = m.stats();
		expect(Math.abs(size.x - KESTREL.dims.length)).toBeLessThan(0.3);
		expect(Math.abs(size.z - KESTREL.dims.span)).toBeLessThan(0.3);
		expect(Math.abs(size.y - KESTREL.dims.height)).toBeLessThan(0.3);
		m.dispose();
	});
	it('stays inside the triangle and draw-call budgets (≤ 60 k triangles, ≤ 120 meshes)', () => {
		const m = buildKestrel({ glass: 'physical', textures: false, detail: 48 });
		const s = m.stats();
		expect(s.triangles).toBeLessThanOrEqual(60_000);
		expect(s.meshes).toBeLessThanOrEqual(120);
		m.dispose();
	});
	it('has the parts of the design: glass canopy with a ring frame, engine pod, spine, wings, tail turbine, four legs', () => {
		const m = model();
		const names = new Set<string>();
		m.root.traverse((o) => names.add(o.name));
		for (const n of ['canopy', 'frame-ring', 'engine-sphere', 'intake-grille', 'vent-star', 'gear-ball', 'spine', 'wing-r', 'wing-l', 'turbine-shell', 'fan', 'leg-0', 'leg-1', 'leg-2', 'leg-3', 'lift-plume', 'seat-base', 'screen']) expect(names.has(n), n).toBe(true);
		m.dispose();
	});
	it('folding the gear raises the feet (the model gets shorter)', () => {
		const m = model();
		const down = m.stats().size.y;
		m.setGear(0);
		expect(m.stats().size.y).toBeLessThan(down - 0.5);
		m.setGear(1);
		expect(Math.abs(m.stats().size.y - down)).toBeLessThan(1e-6);
		m.dispose();
	});
	it('cruise swings the turbine from sideways to aft', () => {
		const m = model();
		const t = m.root.getObjectByName('turbine')!;
		m.setCruise(0); expect(t.rotation.y).toBeCloseTo(0, 6);
		m.setCruise(1); expect(t.rotation.y).toBeCloseTo(Math.PI / 2, 6);
		m.dispose();
	});
	it('thrust lights the downwash curtain and the honeycomb intakes, and clamps its input', () => {
		const m = model();
		const curtain = (m.root.getObjectByName('lift-plume') as unknown as { children: { material: { opacity: number } }[] }).children[0].material;
		const grille = (m.root.getObjectByName('intake-grille') as unknown as { material: { color: { r: number } } }).material;
		m.setThrust(0); expect(curtain.opacity).toBe(0); const dim = grille.color.r;
		m.setThrust(5); expect(curtain.opacity).toBeGreaterThan(0.5); expect(grille.color.r).toBeGreaterThan(dim * 10);
		m.setThrust(-3); expect(curtain.opacity).toBe(0);
		m.dispose();
	});
	it('the fan spins faster with thrust', () => {
		const m = model();
		const fan = m.root.getObjectByName('fan')!;
		m.setThrust(0); m.update(1); const slow = fan.rotation.z;
		m.setThrust(1); m.update(1); const fast = fan.rotation.z - slow;
		expect(fast).toBeGreaterThan(slow * 5);
		m.dispose();
	});
});
