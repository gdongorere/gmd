import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ResourceTracker } from './resource';
import { trackObject } from './three';

function scene(): THREE.Scene {
	const s = new THREE.Scene();
	const shared = new THREE.CylinderGeometry(1, 1, 2, 8);
	const mat = new THREE.MeshStandardMaterial({ map: new THREE.DataTexture(new Uint8Array(64), 4, 4) });
	for (let i = 0; i < 4; i++) s.add(new THREE.Mesh(shared, mat));
	s.add(new THREE.Mesh(new THREE.RingGeometry(1, 2, 16), [new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial()]));
	return s;
}

describe('trackObject (leak test)', () => {
	it('tracks shared geometry/material once, including textures and material arrays', () => {
		const t = new ResourceTracker();
		trackObject(t, scene(), 'arena');
		expect(t.counts('arena')).toEqual({ geometry: 2, material: 3, texture: 1, target: 0, bitmap: 0, worker: 0, url: 0, other: 0 });
		trackObject(t, scene(), 'arena'); // a second, different scene adds its own; same objects would not
		expect(t.total()).toBe(12);
	});

	it('flying away returns the counts to baseline and disposes for real', () => {
		const t = new ResourceTracker();
		const base = t.counts();
		const s = scene();
		const disposed = new Set<THREE.BufferGeometry>();
		s.traverse((o) => {
			const m = o as THREE.Mesh;
			m.geometry?.addEventListener('dispose', () => disposed.add(m.geometry));
		});
		trackObject(t, s, 'moon');
		t.unloadOwner('moon');
		expect(t.counts()).toEqual(base);
		expect(disposed.size).toBe(2);
	});
});
