// src/lib/fly/earth/dust.ts
// Dust and spray thrown up by the downwash when the ship hovers close to the ground (reference: the dust cloud under a hovering Bubbleship).
// A recycled pool of soft sprites in the local render frame. Emission follows the simulated thrust and the height above ground, and the
// colour follows the surface: grey-brown dust on land, white spray over water.

import * as THREE from 'three';

const N = 260;

export class Dust {
	readonly points: THREE.Points;
	private pos = new Float32Array(N * 3);
	private vel = new Float32Array(N * 3);
	private life = new Float32Array(N);
	private age = new Float32Array(N).fill(1e9);
	private alpha = new Float32Array(N);
	private geo = new THREE.BufferGeometry();
	private mat: THREE.PointsMaterial;
	private tex: THREE.Texture | null = null;
	private cursor = 0;
	private carry = 0;

	constructor() {
		if (typeof document !== 'undefined') {
			const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
			if (g) { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); this.tex = new THREE.CanvasTexture(c); }
		}
		this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
		this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
		this.mat = new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: true, map: this.tex ?? undefined, transparent: true, opacity: 0.55, depthWrite: false, color: 0x8a7f72, fog: true });
		this.points = new THREE.Points(this.geo, this.mat);
		this.points.frustumCulled = false; this.points.renderOrder = 5;
	}

	/** `groundY` is the ground height in local coordinates under the ship; `thrust` 0…1; `agl` metres above ground; `water` true over sea. */
	update(dt: number, ship: THREE.Vector3, quat: THREE.Quaternion, groundY: number, thrust: number, agl: number, water: boolean, lightness: number) {
		this.mat.color.setHex(water ? 0xdde8f0 : 0x8a7f72).multiplyScalar(Math.max(0.12, lightness));
		const reach = 22;
		const strength = thrust * Math.max(0, 1 - agl / reach);
		this.carry += dt * 140 * strength;
		const side = new THREE.Vector3();
		while (this.carry >= 1) {
			this.carry -= 1;
			const i = this.cursor; this.cursor = (this.cursor + 1) % N;
			side.set(0.2 + Math.random() * 0.4, 0, (Math.random() < 0.5 ? -1 : 1) * 2.25).applyQuaternion(quat); // under the pods
			const a = Math.random() * Math.PI * 2, sp = (3 + Math.random() * 7) * (0.5 + strength);
			this.pos[i * 3] = ship.x + side.x; this.pos[i * 3 + 1] = groundY + 0.3; this.pos[i * 3 + 2] = ship.z + side.z;
			this.vel[i * 3] = Math.cos(a) * sp; this.vel[i * 3 + 1] = 0.5 + Math.random() * 2.2; this.vel[i * 3 + 2] = Math.sin(a) * sp;
			this.life[i] = 1.2 + Math.random() * 1.8; this.age[i] = 0;
		}
		for (let i = 0; i < N; i++) {
			if (this.age[i] >= this.life[i]) { this.alpha[i] = 0; this.pos[i * 3 + 1] = -1e5; continue; }
			this.age[i] += dt;
			const k = Math.exp(-dt * 1.1);
			this.vel[i * 3] *= k; this.vel[i * 3 + 2] *= k; this.vel[i * 3 + 1] *= Math.exp(-dt * 0.6);
			this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
			this.alpha[i] = 1 - this.age[i] / this.life[i];
		}
		this.geo.attributes.position.needsUpdate = true;
		this.mat.opacity = 0.5;
	}

	/** Particles currently alive (for tests). */
	get alive(): number { let n = 0; for (let i = 0; i < N; i++) if (this.age[i] < this.life[i]) n++; return n; }

	dispose() { this.geo.dispose(); this.mat.dispose(); this.tex?.dispose(); }
}
