// src/lib/solar/scene.ts
// The real 3D solar system: Sun, eight planets, Earth's Moon and orbit lines, in AU, with a camera that
// can sit anywhere from low Earth orbit to beyond Neptune. Loaded lazily (three.js) by System3D.
//
// Precision: every position is computed in float64 relative to the camera's focus point and only then handed
// to the GPU, so bodies stay stable at Earth-orbit scale (1e-5 AU) as well as at Neptune scale. A logarithmic
// depth buffer lets one frustum span 1e-9 … 1e3 AU.
// Frame: scene (x, y, z) = (ecliptic x, ecliptic z, −ecliptic y), so ecliptic north is "up".

import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import { PLANETS, planetStates, type PlanetId } from '../astro/planets';
import { unixMsOrNaN } from '../astro/clock';
import { marsOrientation } from '../astro/globe';
import { earthOrientation, eclToScene } from './earthFrame';
import { EARTH_RADIUS_AU, KM_PER_AU, MAX_DISTANCE_AU, MIN_DISTANCE_AU, flightDistance, planFlight } from './ladder';
import { earthTexture, marsTexture } from './textures';

export type BodyId = 'Sun' | PlanetId | 'Moon';
export const BODY_IDS: BodyId[] = ['Sun', 'Mercury', 'Venus', 'Earth', 'Moon', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
const RADIUS_KM: Record<BodyId, number> = {
	Sun: 695_700, Moon: 1737.4, Mercury: 2439.7, Venus: 6051.8, Earth: 6371, Mars: 3389.5, Jupiter: 69_911, Saturn: 58_232, Uranus: 25_362, Neptune: 24_622,
};
const COLOR: Record<BodyId, string> = {
	Sun: '#fff2c0', Moon: '#b9b6ad', Mercury: '#b8a99a', Venus: '#e8cda0', Earth: '#5ab0ff', Mars: '#e2724a', Jupiter: '#d9b38c', Saturn: '#e8d8a0', Uranus: '#9fe3e8', Neptune: '#6a8cff',
};

export type V3 = [number, number, number];
export interface ScreenLabel { id: BodyId; x: number; y: number; visible: boolean; distanceAu: number }
export interface SceneOptions { dprCap?: number; antialias?: boolean }

export function webglAvailable(): boolean {
	try {
		const c = document.createElement('canvas');
		return !!(c.getContext('webgl2') || c.getContext('webgl'));
	} catch { return false; }
}

const toScene = (e: { x: number; y: number; z: number }): V3 => eclToScene(e.x, e.y, e.z);

export class SolarScene {
	readonly renderer: THREE.WebGLRenderer;
	private scene = new THREE.Scene();
	private camera = new THREE.PerspectiveCamera(50, 1, 1e-9, 1e3);
	private meshes = new Map<BodyId, THREE.Object3D>();
	private earthGroup = new THREE.Group();
	private earthSpin!: THREE.Mesh;
	private marsMesh!: THREE.Mesh;
	private orbitLines: THREE.Line[] = [];
	private orbitPositions: Float64Array[] = [];
	private sunLight = new THREE.PointLight(0xffffff, 2.2, 0, 0);
	private glow: THREE.Sprite;
	private positions = new Map<BodyId, V3>();
	private disposed = false;

	focus: BodyId = 'Sun';
	distanceAu = 45;
	azimuth = 0.6;
	polar = 1.15;
	trueScale = false;
	showOrbits = true;
	/** Moving the focus between bodies is interpolated: `blendFrom` → `focus` over a flight. */
	private flight: null | { fromPos: V3 | null; from: BodyId; to: BodyId; fromD: number; toD: number; az0: number; az1: number; po0: number; po1: number; plan: ReturnType<typeof planFlight>; t0: number; resolve: () => void } = null;
	private flightPaused = false;
	private flightElapsed = 0;
	private lastTick = 0;
	private jd = 0;

	constructor(private canvas: HTMLCanvasElement, opts: SceneOptions = {}) {
		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.antialias ?? true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.dprCap ?? 2));
		this.renderer.setClearColor(0x02030a, 1);
		this.scene.add(new THREE.AmbientLight(0x2a3350, 1.1));
		this.scene.add(this.sunLight);
		this.buildBodies();
		this.buildStars();
		const gl = document.createElement('canvas'); gl.width = gl.height = 128;
		const g = gl.getContext('2d')!;
		const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
		grad.addColorStop(0, 'rgba(255,244,200,1)'); grad.addColorStop(0.2, 'rgba(255,200,100,0.55)'); grad.addColorStop(1, 'rgba(255,160,40,0)');
		g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
		this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(gl), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
		this.scene.add(this.glow);
	}

	// ---- construction -------------------------------------------------------------------------
	private buildBodies() {
		const geo = new THREE.SphereGeometry(1, 48, 32);
		for (const id of BODY_IDS) {
			let mesh: THREE.Object3D;
			if (id === 'Sun') mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: COLOR.Sun }));
			else if (id === 'Earth') {
				this.earthSpin = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLOR.Earth, roughness: 0.9, metalness: 0 }));
				this.earthGroup.add(this.earthSpin);
				mesh = this.earthGroup;
			} else if (id === 'Mars') {
				this.marsMesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLOR.Mars, roughness: 1 }));
				mesh = this.marsMesh;
			} else mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLOR[id], roughness: 1 }));
			this.scene.add(mesh);
			this.meshes.set(id, mesh);
		}
		// Saturn's rings (decorative, flat in the ecliptic as an approximation of its ~27° tilt: tilted here too).
		const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 2.3, 96), new THREE.MeshBasicMaterial({ color: '#cdbb8a', side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
		ring.rotation.x = Math.PI / 2 - (26.7 * Math.PI) / 180;
		this.meshes.get('Saturn')!.add(ring);
		// Orbit lines are sampled once, around the current date; planets barely change orbit over centuries.
	}

	private buildStars() {
		const n = 1800, pos = new Float32Array(n * 3);
		let s = 12345;
		const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
		for (let i = 0; i < n; i++) {
			const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u), d = 900;
			pos.set([r * Math.cos(a) * d, u * d, r * Math.sin(a) * d], i * 3);
		}
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
		const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, depthWrite: false }));
		pts.frustumCulled = false;
		this.scene.add(pts);
	}

	/** Loads the land textures (async, once). Safe to call before the first frame; the globe is a plain blue sphere until it lands. */
	async loadTextures(landUrl = '/solar/land.json') {
		try {
			const rings: [number, number][][] = await (await fetch(landUrl)).json();
			if (this.disposed) return;
			const ec = earthTexture(rings);
			if (ec) {
				const t = new THREE.CanvasTexture(ec); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
				(this.earthSpin.material as THREE.MeshStandardMaterial).map = t; (this.earthSpin.material as THREE.MeshStandardMaterial).color.set('#ffffff'); (this.earthSpin.material as THREE.MeshStandardMaterial).needsUpdate = true;
			}
		} catch { /* plain globe */ }
		const mc = marsTexture();
		if (mc && !this.disposed) {
			const t = new THREE.CanvasTexture(mc); t.colorSpace = THREE.SRGBColorSpace;
			const m = this.marsMesh.material as THREE.MeshStandardMaterial; m.map = t; m.color.set('#ffffff'); m.needsUpdate = true;
		}
	}

	private ensureOrbits(jd: number) {
		if (this.orbitLines.length) return;
		const ms = unixMsOrNaN(jd);
		if (Number.isNaN(ms)) return;
		const rot = Astronomy.Rotation_EQJ_ECL();
		for (const p of PLANETS) {
			const period = Math.pow(p.a, 1.5) * 365.25 * 86400e3;
			const n = 180, arr = new Float64Array((n + 1) * 3);
			for (let i = 0; i <= n; i++) {
				const v = Astronomy.RotateVector(rot, Astronomy.HelioVector(p.body, new Date(ms + (i / n) * period)));
				const [x, y, z] = toScene(v);
				arr.set([x, y, z], i * 3);
			}
			const geom = new THREE.BufferGeometry();
			geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 1) * 3), 3));
			const line = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: p.color, transparent: true, opacity: 0.4 }));
			line.frustumCulled = false;
			this.scene.add(line);
			this.orbitLines.push(line); this.orbitPositions.push(arr);
		}
	}

	// ---- per-frame ----------------------------------------------------------------------------
	/** Heliocentric scene position (AU, float64) of a body at `jd`. */
	bodyPosition(id: BodyId): V3 { return this.positions.get(id) ?? [0, 0, 0]; }

	private computePositions(jd: number) {
		this.positions.set('Sun', [0, 0, 0]);
		const states = planetStates(jd);
		if (!states) return false;
		for (const s of states) this.positions.set(s.id, toScene(s));
		const ms = unixMsOrNaN(jd);
		// GeoMoon is equatorial J2000; rotate to ecliptic first.
		const m = toScene(Astronomy.RotateVector(Astronomy.Rotation_EQJ_ECL(), Astronomy.GeoMoon(new Date(ms))));
		const earth = this.positions.get('Earth')!;
		this.positions.set('Moon', [earth[0] + m[0], earth[1] + m[1], earth[2] + m[2]]);
		return true;
	}

	private focusPosition(): V3 {
		const f = this.flight;
		if (!f) return this.bodyPosition(this.focus);
		const a = f.fromPos ?? this.bodyPosition(f.from), b = this.bodyPosition(f.to);
		const s = smooth(this.flightElapsed / (f.plan.duration * 1000));
		return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
	}

	/** Smoothly fly to a body at a camera distance. Resolves when done (or immediately when `instant`). */
	flyTo(body: BodyId, distanceAu: number, instant = false): Promise<void> {
		const d1 = Math.min(MAX_DISTANCE_AU, Math.max(this.minDistance(body), distanceAu));
		// Redirecting mid-flight starts from where the camera actually is, not from the old focus body.
		const fromPos = this.flight ? this.focusPosition() : null;
		this.flight?.resolve();
		this.flight = null;
		this.flightPaused = false;
		const lit = this.litView(body);
		if (instant) { this.focus = body; this.distanceAu = d1; if (lit) { this.azimuth = lit.az; this.polar = lit.polar; } return Promise.resolve(); }
		const from = this.focus, a = fromPos ?? this.bodyPosition(from), b = this.bodyPosition(body);
		const travel = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
		const plan = planFlight(this.distanceAu, d1, travel);
		return new Promise<void>((resolve) => {
			this.flightElapsed = 0;
			const az1 = lit ? this.azimuth + wrapPi(lit.az - this.azimuth) : this.azimuth;
			this.flight = { fromPos, from, to: body, fromD: this.distanceAu, toD: d1, az0: this.azimuth, az1, po0: this.polar, po1: lit ? lit.polar : this.polar, plan, t0: performance.now(), resolve };
		});
	}

	/** Camera angles that look at a body from its sunlit side, a little off the Sun line so it shows a phase. Null for the Sun. */
	private litView(body: BodyId): { az: number; polar: number } | null {
		if (body === 'Sun') return null;
		const p = this.bodyPosition(body);
		const len = Math.hypot(p[0], p[1], p[2]) || 1;
		const x = -p[0] / len, y = -p[1] / len, z = -p[2] / len;
		const az = Math.atan2(-z, x) + 0.55;
		const polar = Math.min(Math.PI - 0.1, Math.max(0.1, Math.acos(Math.max(-1, Math.min(1, y))) - 0.12));
		return { az, polar };
	}

	get flying() { return this.flight !== null; }
	/** The body the camera is heading for (or already on). */
	get displayFocus(): BodyId { return this.flight?.to ?? this.focus; }
	setFlightPaused(p: boolean) { this.flightPaused = p; }
	/** Cancels a flight where it is (focus stays on the destination body at the current distance). */
	stopFlight() {
		if (!this.flight) return;
		this.focus = this.flight.to;
		this.flight.resolve();
		this.flight = null;
		this.flightPaused = false;
	}
	finishFlight() {
		if (!this.flight) return;
		this.focus = this.flight.to; this.distanceAu = this.flight.toD;
		this.flight.resolve(); this.flight = null; this.flightPaused = false;
	}

	minDistance(body: BodyId): number {
		const r = (RADIUS_KM[body] / KM_PER_AU) * 1.4;
		return body === 'Earth' ? MIN_DISTANCE_AU : Math.max(r, 1e-7);
	}

	orbit(dAz: number, dPolar: number) {
		this.azimuth += dAz;
		this.polar = Math.min(Math.PI - 0.05, Math.max(0.05, this.polar + dPolar));
	}
	zoom(factor: number) {
		if (this.flight) return;
		this.distanceAu = Math.min(MAX_DISTANCE_AU, Math.max(this.minDistance(this.focus), this.distanceAu * factor));
	}

	resize(w: number, h: number) {
		this.renderer.setSize(w, h, false);
		this.camera.aspect = w / Math.max(1, h);
		// Portrait screens: the HUD fills the lower third, so lift the focus point up into the free sky.
		if (w < h * 0.8) this.camera.setViewOffset(w, h, 0, Math.round(h * 0.16), w, h); else this.camera.clearViewOffset();
		this.camera.updateProjectionMatrix();
	}

	/** Advances the scene to `jd` and draws one frame; returns screen positions for labels, or null when the date is outside JS Date's range (nothing is drawn). */
	render(jd: number): ScreenLabel[] | null {
		const now = performance.now();
		const dt = this.lastTick ? now - this.lastTick : 0;
		this.lastTick = now;
		this.jd = jd;
		if (!this.computePositions(jd)) return null;
		this.ensureOrbits(jd);
		const f = this.flight;
		if (f) {
			if (!this.flightPaused) this.flightElapsed += dt;
			const p = Math.min(1, this.flightElapsed / (f.plan.duration * 1000));
			this.distanceAu = flightDistance(f.fromD, f.toD, p, f.plan.arc);
			const e = smooth(p);
			this.azimuth = f.az0 + (f.az1 - f.az0) * e; this.polar = f.po0 + (f.po1 - f.po0) * e;
			if (p >= 1) { this.focus = f.to; this.distanceAu = f.toD; f.resolve(); this.flight = null; }
		}
		const origin = this.focusPosition();
		const rel = (id: BodyId): V3 => { const p = this.bodyPosition(id); return [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]]; };
		const d = this.distanceAu;
		// Body sizes: true radius, or enlarged just enough to stay visible ("visible scale").
		const earthSpin = earthOrientation(jd);
		for (const id of BODY_IDS) {
			const obj = this.meshes.get(id)!;
			const r = rel(id);
			obj.position.set(r[0], r[1], r[2]);
			const trueR = RADIUS_KM[id] / KM_PER_AU;
			const camToBody = Math.hypot(r[0] - this.cam()[0], r[1] - this.cam()[1], r[2] - this.cam()[2]);
			const k = id === 'Sun' ? 0.02 : id === this.displayFocus ? 0.07 : id === 'Moon' ? 0.02 : 0.012;
			const minVisible = camToBody * k;
			const radius = this.trueScale ? trueR : Math.max(trueR, minVisible);
			// Never let an enlarged body swallow the camera: cap by distance to the camera.
			(id === 'Earth' ? this.earthGroup : obj).scale.setScalar(Math.min(radius, camToBody * 0.45));
		}
		this.earthGroup.rotation.set(earthSpin.tiltRad, 0, 0);
		this.earthSpin.rotation.set(0, earthSpin.gmstRad, 0);
		this.orientMars(jd, this.bodyPosition('Mars'));
		const sunRel = rel('Sun');
		this.sunLight.position.set(sunRel[0], sunRel[1], sunRel[2]);
		this.glow.position.set(sunRel[0], sunRel[1], sunRel[2]);
		const sunCam = Math.hypot(sunRel[0] - this.cam()[0], sunRel[1] - this.cam()[1], sunRel[2] - this.cam()[2]);
		this.glow.scale.setScalar(Math.max(sunCam * 0.18, 0.02));
		(this.glow.material as THREE.SpriteMaterial).opacity = this.trueScale ? 0.5 : 0.9;
		// Orbit lines: offset by the focus in float64, then written as float32. Hidden when zoomed so far in that float32 jitter would show.
		const showLines = this.showOrbits && d > 0.02;
		this.orbitLines.forEach((line, i) => {
			line.visible = showLines;
			if (!showLines) return;
			const src = this.orbitPositions[i];
			const attr = line.geometry.getAttribute('position') as THREE.BufferAttribute;
			for (let k = 0; k < src.length; k += 3) attr.setXYZ(k / 3, src[k] - origin[0], src[k + 1] - origin[1], src[k + 2] - origin[2]);
			attr.needsUpdate = true;
		});
		const c = this.cam();
		this.camera.position.set(c[0], c[1], c[2]);
		this.camera.up.set(0, 1, 0);
		this.camera.lookAt(0, 0, 0);
		this.camera.near = Math.max(1e-10, d * 1e-4);
		this.camera.updateProjectionMatrix();
		this.renderer.render(this.scene, this.camera);
		return this.labels(rel);
	}

	private cam(): V3 {
		const sp = Math.sin(this.polar), cp = Math.cos(this.polar);
		return [this.distanceAu * sp * Math.cos(this.azimuth), this.distanceAu * cp, -this.distanceAu * sp * Math.sin(this.azimuth)];
	}

	/** Mars's visible face toward the Sun follows its sub-solar point; `helio` is Mars's heliocentric position. The spin axis is approximated (documented in the UI). */
	private orientMars(jd: number, helio: V3) {
		const { subsolar } = marsOrientation(jd);
		const toSun = new THREE.Vector3(-helio[0], -helio[1], -helio[2]).normalize();
		const la = (subsolar.lat * Math.PI) / 180, lo = (subsolar.lon * Math.PI) / 180;
		const local = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
		const q = new THREE.Quaternion().setFromUnitVectors(local, toSun);
		// Twist about the Sun line so Mars's north points roughly toward ecliptic north.
		const north = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
		const want = new THREE.Vector3(0, 1, 0).sub(toSun.clone().multiplyScalar(toSun.y));
		const have = north.clone().sub(toSun.clone().multiplyScalar(north.dot(toSun)));
		if (want.lengthSq() > 1e-9 && have.lengthSq() > 1e-9) {
			const ang = have.angleTo(want) * (new THREE.Vector3().crossVectors(have, want).dot(toSun) < 0 ? -1 : 1);
			q.premultiply(new THREE.Quaternion().setFromAxisAngle(toSun, ang));
		}
		this.marsMesh.quaternion.copy(q);
	}

	private labels(rel: (id: BodyId) => V3): ScreenLabel[] {
		const v = new THREE.Vector3();
		const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
		const camPos = this.camera.position;
		return BODY_IDS.map((id) => {
			const r = rel(id);
			v.set(r[0], r[1], r[2]).project(this.camera);
			const dist = Math.hypot(r[0] - camPos.x, r[1] - camPos.y, r[2] - camPos.z);
			return { id, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, visible: v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05, distanceAu: dist };
		});
	}

	/** Distance from the camera to the focus body's centre and, for Earth, altitude. */
	get focusDistanceAu() { return this.distanceAu; }
	get earthRadiusAu() { return EARTH_RADIUS_AU; }

	dispose() {
		this.disposed = true;
		this.flight?.resolve();
		this.scene.traverse((o) => {
			const m = o as THREE.Mesh;
			if (m.geometry) m.geometry.dispose();
			const mat = (m as { material?: THREE.Material | THREE.Material[] }).material;
			if (mat) (Array.isArray(mat) ? mat : [mat]).forEach((x) => { (x as THREE.MeshBasicMaterial).map?.dispose(); x.dispose(); });
		});
		this.renderer.dispose();
		this.renderer.forceContextLoss();
	}
}

const wrapPi = (a: number) => ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
const smooth = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * x * (x * (x * 6 - 15) + 10); };
