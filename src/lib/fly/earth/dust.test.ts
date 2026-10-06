import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Dust } from './dust';

const run = (d: Dust, secs: number, thrust: number, agl: number) => { for (let t = 0; t < secs; t += 1 / 60) d.update(1 / 60, new THREE.Vector3(), new THREE.Quaternion(), -3, thrust, agl, false, 1); };

describe('downwash dust', () => {
	it('rises with thrust close to the ground', () => { const d = new Dust(); run(d, 1, 1, 3); expect(d.alive).toBeGreaterThan(60); d.dispose(); });
	it('is absent with no thrust or high above the ground', () => {
		const a = new Dust(); run(a, 2, 0, 3); expect(a.alive).toBe(0); a.dispose();
		const b = new Dust(); run(b, 2, 1, 40); expect(b.alive).toBe(0); b.dispose();
	});
	it('fades out after the thrust stops', () => { const d = new Dust(); run(d, 1, 1, 3); run(d, 4, 0, 3); expect(d.alive).toBe(0); d.dispose(); });
	it('stays within the pool', () => { const d = new Dust(); run(d, 10, 1, 1); expect(d.alive).toBeLessThanOrEqual(260); d.dispose(); });
});
