import * as THREE from 'three';
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
		for (const n of ['canopy', 'frame-ring', 'engine-sphere', 'intake-grille', 'vent-star', 'gear-ball', 'spine', 'wing-r', 'wing-l', 'turbine-shell', 'stabilizer-vanes', 'leg-0', 'leg-1', 'leg-2', 'leg-3', 'lift-plume', 'seat-base', 'screen']) expect(names.has(n), n).toBe(true);
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
	it('retracted gear is hidden entirely and comes back when deployed', () => {
		const m = model();
		const gear = m.root.getObjectByName('gear')!;
		expect(gear.visible).toBe(true);
		m.setGear(0.5); expect(gear.visible).toBe(true);
		m.setGear(0); expect(gear.visible).toBe(false);
		m.setGear(1); expect(gear.visible).toBe(true);
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
	it('at rest the thruster faces point straight down (not forward)', () => {
		const m = model(); m.root.updateMatrixWorld(true);
		for (const side of ['l', 'r']) {
			const g = m.root.getObjectByName(`engine-pod-${side}`)!.getObjectByName('intake-grille')!;
			const normal = new THREE.Vector3(0, 0, 1).transformDirection(g.matrixWorld); // a circle geometry faces +Z locally
			expect(normal.y).toBeLessThan(-0.99); expect(Math.abs(normal.x)).toBeLessThan(0.01);
		}
		m.dispose();
	});
	it('each pod pivots on its own: braking and accelerating swing them opposite ways, yaw tilts them oppositely', () => {
		const m = model();
		const l = m.root.getObjectByName('engine-pod-l')!, r = m.root.getObjectByName('engine-pod-r')!;
		expect(l.rotation.z).toBeCloseTo(0, 9); expect(r.rotation.z).toBeCloseTo(0, 9);
		m.setPods({ left: 0.8, right: 0.8, thrustLeft: 1, thrustRight: 1 }); for (let i = 0; i < 60; i++) m.update(1 / 30);
		expect(l.rotation.z).toBeCloseTo(-0.8, 5); expect(r.rotation.z).toBeCloseTo(-0.8, 5); // exhaust aft: accelerating
		m.setPods({ left: -0.5, right: -0.5, thrustLeft: 1, thrustRight: 1 }); for (let i = 0; i < 60; i++) m.update(1 / 30);
		expect(l.rotation.z).toBeCloseTo(0.5, 5); // exhaust forward: braking
		m.setPods({ left: 0.4, right: -0.4, thrustLeft: 1, thrustRight: 1 }); for (let i = 0; i < 60; i++) m.update(1 / 30);
		expect(l.rotation.z).toBeCloseTo(-0.4, 5); expect(r.rotation.z).toBeCloseTo(0.4, 5);
		m.dispose();
	});
	it('pods slew at a limited rate (they do not snap) and glow follows power per pod', () => {
		const m = model();
		const l = m.root.getObjectByName('engine-pod-l')!;
		m.setPods({ left: 1.5, right: 0, thrustLeft: 1, thrustRight: 0.2 }); m.update(0.1);
		expect(Math.abs(l.rotation.z)).toBeLessThan(0.4); expect(Math.abs(l.rotation.z)).toBeGreaterThan(0.2);
		for (let i = 0; i < 60; i++) m.update(1 / 30);
		m.dispose();
	});
	it('the tail ring is a fixed stabiliser: it never rotates or swings', () => {
		const m = model();
		const t = m.root.getObjectByName('turbine')!, v = m.root.getObjectByName('stabilizer-vanes')!;
		const before = [t.rotation.y, v.rotation.z];
		m.setThrust(1); m.setPods({ left: 1, right: 1, thrustLeft: 1, thrustRight: 1 }); for (let i = 0; i < 90; i++) m.update(1 / 30);
		expect([t.rotation.y, v.rotation.z]).toEqual(before);
		m.dispose();
	});
});
