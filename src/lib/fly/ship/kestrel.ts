// src/lib/fly/ship/kestrel.ts
// The Kestrel: a small dragonfly-like VTOL scout, built entirely in code (no downloaded assets).
//
// Design language (an ORIGINAL design inspired by the references Gee supplied, not a copy of any film craft):
//   · a glass spherical cockpit with a gyroscope-style ring frame, two seats and a console, at the nose,
//   · a Y-shaped fuselage tapering to a thin spine that ends in a side-facing ring rotor (it swings to face aft for cruise),
//   · two big white spherical engine pods on the flanks with honeycomb intakes, star-shaped rear vents and short fins,
//   · four jointed legs on a central ball joint, folding up in flight.
// The layout follows the reference sheets Gee supplied (an Oblivion-style bubble craft); the geometry is built from scratch.
// Coordinates: +X forward, +Y up, Z across the span; origin at the spine's mid-height under the engine pod. Metres.
//
// The builder returns a handle with animation setters (thrust, cruise tilt, gear, lights) and `update(dt)` for the spinning fan, plus
// `stats()` so tests can hold it to its size and triangle budget (docs/fly/11-ship-roster.md §4).

import * as THREE from 'three';
import { loft, wingSlab, triangles, type Section } from './loft';

export interface KestrelOptions {
	/** 'physical' uses a transmissive glass bubble (best looking); 'simple' uses cheap transparency for weak GPUs and tests. */
	glass?: 'physical' | 'simple';
	/** Sphere tessellation (segments around). 48 is plenty; 24 for the low tier. */
	detail?: number;
	/** Canvas panel-line texture for the pods (browser only). Off in unit tests. */
	textures?: boolean;
}

export interface KestrelStats { triangles: number; meshes: number; size: THREE.Vector3; materials: number }

export interface KestrelModel {
	root: THREE.Group;
	/** 0…1: lift ring glow and fan speed. */
	setThrust(t: number): void;
	/** 0 = turbine faces sideways (hover trim), 1 = faces aft (cruise thrust). */
	setCruise(t: number): void;
	/** 1 = legs deployed, 0 = folded. */
	setGear(e: number): void;
	setLights(on: boolean): void;
	/** Hide the pilot's own body and head so they don't block the first-person view. */
	setFirstPerson(on: boolean): void;
	update(dt: number): void;
	stats(): KestrelStats;
	dispose(): void;
}

// --- palette ------------------------------------------------------------------------------------
const WHITE = 0xe9ecee, GRAPHITE = 0x2a2d33, STEEL = 0x8e949c, AMBER = 0xffa23a, CYAN = 0x66e0ff;

/** Panel-line texture for the white pods: a faint grid of seams and a few rivet dots. Browser only. */
function panelTexture(): THREE.Texture | null {
	if (typeof document === 'undefined') return null;
	const c = document.createElement('canvas');
	c.width = 1024; c.height = 512;
	const g = c.getContext('2d');
	if (!g) return null;
	g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
	g.strokeStyle = 'rgba(40,46,56,0.55)'; g.lineWidth = 2;
	for (let i = 0; i <= 12; i++) { g.beginPath(); g.moveTo((i / 12) * c.width, 0); g.lineTo((i / 12) * c.width, c.height); g.stroke(); }
	for (const y of [0.18, 0.5, 0.82]) { g.beginPath(); g.moveTo(0, y * c.height); g.lineTo(c.width, y * c.height); g.stroke(); }
	g.fillStyle = 'rgba(40,46,56,0.45)';
	for (let i = 0; i < 12; i++) for (const y of [0.18, 0.5, 0.82]) { g.beginPath(); g.arc(((i + 0.5) / 12) * c.width, y * c.height + 8, 2.2, 0, 7); g.fill(); }
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4;
	return t;
}

export function buildKestrel(opts: KestrelOptions = {}): KestrelModel {
	const seg = Math.max(16, opts.detail ?? 48);
	const owned: { dispose(): void }[] = [];
	const own = <T extends { dispose(): void }>(x: T): T => { owned.push(x); return x; };
	const root = new THREE.Group();
	root.name = 'Kestrel';
	const tex = opts.textures === false ? null : panelTexture();
	if (tex) own(tex);

	// ---- materials ----------------------------------------------------------------------------
	const ceramic = own(new THREE.MeshPhysicalMaterial({ color: WHITE, roughness: 0.32, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.2, map: tex ?? undefined }));
	const graphite = own(new THREE.MeshStandardMaterial({ color: GRAPHITE, roughness: 0.55, metalness: 0.65 }));
	const steel = own(new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.3, metalness: 0.95 }));
	const wingMat = own(new THREE.MeshPhysicalMaterial({ color: 0xdfe5ea, roughness: 0.25, metalness: 0.1, clearcoat: 0.6, transparent: true, opacity: 0.92 }));
	const glass = opts.glass === 'simple'
		? own(new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }))
		: own(new THREE.MeshPhysicalMaterial({ color: 0xd8f0ff, roughness: 0.02, metalness: 0, transmission: 0.95, thickness: 0.05, ior: 1.45, transparent: true, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }));
	const lightMat = (c: number) => own(new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
	const amberGlow = lightMat(AMBER), screenMat = lightMat(0x2fb6e8);
	const addMesh = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, name: string) => { own(g); const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };

	// Proportions are measured from the Bubbleship reference sheet scaled to 9.5 m nose to tail (1 px ≈ 1.04 cm). Origin: under the gear ball,
	// 2.03 m above the ground with the gear out. +X forward, +Y up, Z across the span.
	const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
	const BUBBLE = { x: 2.07, y: 0.25, r: 1.17 };
	const POD = { x: 0.1, y: 0.95, z: 2.24, r: 0.9 };

	// ---- fuselage: a deep wedge around the cockpit and gear ball, narrowing to a slim spine that runs back to the tail duct ---------
	const spineSections: Section[] = [
		{ x: -4.9, w: 0.17, top: 0.17, bottom: 0.15, n: 2.4, y: 1.05 }, { x: -3.4, w: 0.2, top: 0.2, bottom: 0.18, n: 2.6, y: 1.05 }, { x: -1.8, w: 0.26, top: 0.24, bottom: 0.22, n: 2.8, y: 1.0 },
		{ x: -1.0, w: 0.38, top: 0.42, bottom: 0.38, n: 3, y: 0.9 }, { x: -0.3, w: 0.65, top: 0.62, bottom: 0.7, n: 3.2, y: 0.55 }, { x: 0.6, w: 0.95, top: 0.78, bottom: 0.85, n: 3.2, y: 0.38 },
		{ x: 1.3, w: 0.9, top: 0.7, bottom: 0.7, n: 3, y: 0.33 }, { x: 1.7, w: 0.55, top: 0.5, bottom: 0.5, n: 2.4, y: 0.3 },
	];
	addMesh(root, loft(spineSections, Math.round(seg / 2)), ceramic, 'spine');
	// the black dorsal triangle with the craft's number, and a thin dark line down the spine
	const wedge = addMesh(root, new THREE.CylinderGeometry(0.62, 0.62, 0.03, 3), graphite, 'dorsal-wedge'); wedge.rotation.y = Math.PI / 2; wedge.scale.set(1.0, 1, 0.8); wedge.position.set(0.45, 1.19, 0); wedge.castShadow = false;
	const spineLine = addMesh(root, new THREE.BoxGeometry(3.2, 0.02, 0.07), graphite, 'spine-line'); spineLine.position.set(-2.5, 1.27, 0); spineLine.castShadow = false;

	// ---- engine pods: big white spheres high on the flanks, black intake bowl with a round honeycomb grille ahead, star vent aft ------
	const honey = (() => {
		if (typeof document === 'undefined' || opts.textures === false) return null;
		const c = document.createElement('canvas'); c.width = 256; c.height = 256;
		const g = c.getContext('2d'); if (!g) return null;
		g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#fff';
		for (let row = -9; row <= 9; row++) for (let col = -9; col <= 9; col++) {
			const x = 128 + col * 13 + (row & 1 ? 6.5 : 0), y = 128 + row * 11.3;
			if (Math.hypot(x - 128, y - 128) < 104) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; g.lineTo(x + Math.cos(a) * 5.4, y + Math.sin(a) * 5.4); } g.closePath(); g.fill(); }
		}
		const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
	})();
	if (honey) own(honey);
	const grilleMat = own(new THREE.MeshBasicMaterial({ color: 0x2a2f36, map: honey ?? undefined, toneMapped: false }));
	const GRILLE_HEX = 0xcfe6ff;
	const star = new THREE.Shape();
	for (let i = 0; i < 12; i++) { const rr = i % 2 === 0 ? 0.5 : 0.27, a = (i / 12) * Math.PI * 2; (i === 0 ? star.moveTo : star.lineTo).call(star, Math.cos(a) * rr, Math.sin(a) * rr); }
	star.closePath();
	const curtainTex = (() => {
		if (typeof document === 'undefined') return null;
		const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d'); if (!g) return null;
		const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, 'rgba(235,248,255,1)'); gr.addColorStop(0.35, 'rgba(150,200,255,0.7)'); gr.addColorStop(1, 'rgba(110,170,255,0)');
		g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
		const gx = g.createLinearGradient(0, 0, 64, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.25, 'rgba(0,0,0,0)'); gx.addColorStop(0.75, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)');
		g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, 64, 256);
		return new THREE.CanvasTexture(c);
	})();
	if (curtainTex) own(curtainTex);
	const curtainMat = own(new THREE.MeshBasicMaterial({ color: 0xbfe0ff, map: curtainTex ?? undefined, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
	const lifts: { ring: THREE.Mesh; disc: THREE.Mesh; plume: THREE.Mesh }[] = [];
	for (const side of [1, -1]) {
		const pod = new THREE.Group(); pod.name = side === 1 ? 'engine-pod-r' : 'engine-pod-l'; pod.position.set(POD.x, POD.y, side * POD.z); root.add(pod);
		const body = new THREE.Group(); body.rotation.z = -Math.PI / 2; pod.add(body); // the geometry's polar axis (+Y) now points forward (+X)
		addMesh(body, new THREE.SphereGeometry(POD.r, seg, Math.round(seg * 0.6)), ceramic, 'engine-sphere');
		addMesh(body, new THREE.SphereGeometry(POD.r * 1.006, seg, Math.round(seg * 0.35), 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28), graphite, 'pod-rear-cap'); // dark rear band
		addMesh(body, new THREE.SphereGeometry(POD.r * 1.008, seg, Math.round(seg * 0.35), 0, Math.PI * 2, 0, Math.PI * 0.3), graphite, 'intake-bowl'); // big black front bowl
		const lipR = POD.r * Math.sin(Math.PI * 0.3);
		const lip = addMesh(body, new THREE.TorusGeometry(lipR, 0.035, 8, seg * 2), steel, 'intake-ring'); lip.position.y = POD.r * Math.cos(Math.PI * 0.3); lip.rotation.x = Math.PI / 2; lip.castShadow = false;
		// round honeycomb grille on the front pole
		const grille = addMesh(pod, new THREE.CircleGeometry(0.5, seg), grilleMat, 'intake-grille'); grille.position.set(POD.r * 0.93, 0, 0); grille.rotation.y = Math.PI / 2; grille.castShadow = false;
		const gring = addMesh(pod, new THREE.TorusGeometry(0.5, 0.03, 8, seg), steel, 'grille-ring'); gring.position.set(POD.r * 0.935, 0, 0); gring.rotation.y = Math.PI / 2; gring.castShadow = false;
		// six-pointed star vent on the rear pole
		const vent = new THREE.Group(); vent.position.set(-POD.r * 0.8, 0, 0); vent.rotation.y = -Math.PI / 2; pod.add(vent);
		addMesh(vent, new THREE.CircleGeometry(0.58, seg), steel, 'vent-bowl').position.z = -0.01;
		addMesh(vent, new THREE.ShapeGeometry(star), graphite, 'vent-star').position.z = 0.012;
		// the thick neck from the fuselage out to the pod
		const neck = addMesh(root, new THREE.CylinderGeometry(0.3, 0.3, POD.z - 0.45, 20), ceramic, 'pod-strut'); neck.rotation.x = Math.PI / 2; neck.position.set(POD.x, POD.y, side * (0.45 + (POD.z - 0.45) / 2));
		// hover downwash: a wide blue-white curtain falling from the pod's belly
		const lift = new THREE.Group(); lift.position.set(0, -POD.r * 0.55, 0); pod.add(lift);
		const ring = addMesh(lift, new THREE.TorusGeometry(0.01, 0.005, 4, 8), graphite, 'lift-ring'); ring.castShadow = false; ring.visible = false;
		const plume = new THREE.Group(); plume.name = 'lift-plume'; lift.add(plume);
		for (const rot of [0, Math.PI / 2]) { const fan = new THREE.Mesh(own(new THREE.PlaneGeometry(rot === 0 ? 2.2 : 1.7, 2.8, 1, 1)), curtainMat); fan.position.y = -1.55; fan.rotation.y = rot; plume.add(fan); }
		lifts.push({ ring, disc: ring, plume: plume as unknown as THREE.Mesh });
	}
	// ---- fins: thin blades straight out of each pod's flank ------------------------------------------------------------------------------
	for (const s of [1, -1]) {
		const w = wingSlab({ z0: POD.z + 0.8, z1: 4.15, rootLE: POD.x + 0.25, rootTE: POD.x - 0.45, tipLE: POD.x + 0.15, tipTE: POD.x - 0.4, thick: 0.04, tipThick: 0.03, y: POD.y, dihedral: 0 });
		const m = addMesh(root, w, wingMat, s === 1 ? 'wing-r' : 'wing-l'); if (s === -1) m.scale.z = -1;
		const nav = addMesh(root, new THREE.SphereGeometry(0.05, 10, 8), s === 1 ? lightMat(0x40ff70) : lightMat(0xff4a3a), 'nav-light'); nav.position.set(POD.x - 0.1, POD.y, s * 4.12); nav.castShadow = false;
	}

	// ---- cockpit: a big glass bubble ahead of and below the pods, with two seats and a console ---------------------------------------
	const cockpit = new THREE.Group(); cockpit.name = 'cockpit'; cockpit.position.set(BUBBLE.x, BUBBLE.y, 0); root.add(cockpit);
	const R = BUBBLE.r;
	addMesh(cockpit, new THREE.SphereGeometry(R, seg, Math.round(seg * 0.6)), glass, 'canopy');
	// Clean glass, no bands across it. A thick dark-edged oval frame rims each SIDE of the canopy, as in the reference.
	const frame = new THREE.Group(); frame.name = 'frame'; cockpit.add(frame);
	for (const side of [1, -1]) {
		const rim = addMesh(frame, new THREE.TorusGeometry(R * 0.81, 0.07, 14, seg * 2), graphite, 'frame-ring');
		rim.position.z = side * R * 0.58; rim.scale.set(0.92, 1.04, 1);
	}
	addMesh(cockpit, new THREE.CylinderGeometry(0.35, 0.5, 0.45, 20), graphite, 'cradle').position.set(-0.75, -0.5, 0);
	const mast = addMesh(root, new THREE.CylinderGeometry(0.015, 0.025, 0.55, 8), steel, 'antenna'); mast.position.set(BUBBLE.x - 0.7, BUBBLE.y + R * 0.75 + 0.25, 0);
	const pilotParts: THREE.Object3D[] = [];
	const seat = (z: number) => {
		const s = new THREE.Group(); s.position.set(-0.15, -0.55, z);
		addMesh(s, new THREE.BoxGeometry(0.5, 0.12, 0.45), graphite, 'seat-base');
		const back = addMesh(s, new THREE.BoxGeometry(0.12, 0.65, 0.45), graphite, 'seat-back'); back.position.set(-0.23, 0.33, 0); back.rotation.z = -0.15;
		const body = addMesh(s, new THREE.CapsuleGeometry(0.16, 0.36, 4, 10), own(new THREE.MeshStandardMaterial({ color: 0x3a4658, roughness: 0.9 })), 'crew-body'); body.position.set(0.0, 0.4, 0);
		const head = addMesh(s, new THREE.SphereGeometry(0.14, 14, 10), own(new THREE.MeshStandardMaterial({ color: 0x4b566a, roughness: 0.6 })), 'crew-head'); head.position.set(0.02, 0.82, 0);
		if (z > 0) pilotParts.push(body, head);
		cockpit.add(s);
	};
	seat(0.36); seat(-0.36);
	const consoleBox = addMesh(cockpit, new THREE.BoxGeometry(0.45, 0.28, 1.3), graphite, 'console'); consoleBox.position.set(0.62, -0.42, 0); consoleBox.rotation.z = 0.35;
	for (const z of [-0.4, 0, 0.4]) { const scr = addMesh(cockpit, new THREE.PlaneGeometry(0.26, 0.18), screenMat, 'screen'); scr.position.set(0.62 - 0.07, -0.32, z); scr.rotation.set(0, -Math.PI / 2, 0.35); scr.castShadow = false; }

	// ---- tail: a short ring duct (a band 0.36 m deep, ø 1.7 m) at the end of the spine, with a tab above and below ---------------------
	const ringR = 0.85;
	const tail = new THREE.Group(); tail.name = 'tail'; tail.position.set(-5.35, 1.06, 0); root.add(tail);
	const turbine = new THREE.Group(); turbine.name = 'turbine'; tail.add(turbine);
	const bandMat = own(new THREE.MeshPhysicalMaterial({ color: WHITE, roughness: 0.32, metalness: 0.15, clearcoat: 0.7, clearcoatRoughness: 0.2, side: THREE.DoubleSide }));
	const duct = addMesh(turbine, new THREE.CylinderGeometry(ringR, ringR, 0.36, seg * 2, 1, true), bandMat, 'turbine-shell'); duct.rotation.x = Math.PI / 2; // axis along the span: the ring faces left and right
	for (const z of [0.18, -0.18]) { const lip = addMesh(turbine, new THREE.TorusGeometry(ringR, 0.04, 8, seg * 2), steel, 'turbine-lip'); lip.position.z = z; lip.castShadow = false; }
	const inner = addMesh(turbine, new THREE.CylinderGeometry(ringR * 0.74, ringR * 0.74, 0.3, seg * 2, 1, true), graphite, 'turbine-inner'); inner.rotation.x = Math.PI / 2;
	const fan = new THREE.Group(); fan.name = 'fan'; turbine.add(fan);
	const bladeGeo = own(new THREE.BoxGeometry(ringR * 1.35, 0.07, 0.012));
	for (let i = 0; i < 9; i++) { const b = new THREE.Mesh(bladeGeo, steel); b.rotation.z = (i / 9) * Math.PI; b.rotation.x = 0.35; b.castShadow = true; fan.add(b); }
	const hub = addMesh(fan, new THREE.CylinderGeometry(0.3, 0.3, 0.1, 24), ceramic, 'fan-hub'); hub.rotation.x = Math.PI / 2;
	const spoke = addMesh(turbine, new THREE.BoxGeometry(ringR * 1.6, 0.04, 0.04), steel, 'turbine-spoke'); spoke.rotation.z = Math.PI / 2; spoke.castShadow = false; // the vertical bar through the hub
	for (const s of [1, -1]) { const tab = addMesh(tail, new THREE.BoxGeometry(0.29, 0.55, 0.05), wingMat, 'tail-tab'); tab.position.set(0, s * (ringR + 0.12), 0); }
	const rimGlow = addMesh(turbine, new THREE.TorusGeometry(ringR + 0.02, 0.012, 8, seg * 2), amberGlow, 'turbine-rim'); rimGlow.castShadow = false; rimGlow.position.z = 0.19;
	const tailPlume = new THREE.Mesh(own(new THREE.ConeGeometry(ringR * 0.8, 2.6, seg, 1, true)), own(new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })));
	tailPlume.rotation.x = Math.PI / 2; tailPlume.position.z = -1.5; turbine.add(tailPlume);

	// ---- landing gear: four long legs from one central ball under the fuselage; the feet stand ±2 m fore/aft and ±2.5 m out ----------
	const ball = addMesh(root, new THREE.SphereGeometry(0.34, 24, 16), ceramic, 'gear-ball'); ball.position.set(0, -0.76, 0);
	const strutBetween = (parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, name: string) => {
		const m = addMesh(parent, new THREE.CylinderGeometry(r * 0.8, r, a.distanceTo(b), 12), mat, name);
		m.position.copy(a).add(b).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
		return m;
	};
	interface Leg { hip: THREE.Group; axis: THREE.Vector3 }
	const legs: Leg[] = [];
	const footY = -2.0 - (-0.76); // foot height relative to the hip (hip sits at the ball)
	([[1, 1], [1, -1], [-1, 1], [-1, -1]] as const).forEach(([fa, side], i) => {
		const hip = new THREE.Group(); hip.name = `leg-${i}`; hip.position.set(fa * 0.1, -0.76, side * 0.1); root.add(hip);
		const foot = V(fa * 2.0, footY, side * 2.5);
		const knee = foot.clone().multiplyScalar(0.46).add(V(fa * 0.1, 0.22, side * 0.25)); // the knee bows up and out
		strutBetween(hip, V(0, 0, 0), knee, 0.09, ceramic, 'leg-upper');
		const kg = new THREE.Group(); kg.position.copy(knee); hip.add(kg); addMesh(kg, new THREE.SphereGeometry(0.11, 12, 8), graphite, 'leg-knee');
		strutBetween(hip, knee, foot, 0.07, steel, 'leg-lower');
		const pad = addMesh(hip, new THREE.BoxGeometry(0.95, 0.06, 0.26), ceramic, 'leg-pad'); pad.position.set(foot.x, foot.y + 0.03, foot.z);
		const toe = addMesh(hip, new THREE.BoxGeometry(0.3, 0.06, 0.26), ceramic, 'leg-toe'); toe.position.set(foot.x + fa * 0.55, foot.y + 0.1, foot.z); toe.rotation.z = fa * 0.5; // upturned end
		legs.push({ hip, axis: foot.clone().normalize().cross(V(0, 1, 0)).normalize() });
	});

	// ---- running lights -----------------------------------------------------------------------------
	const lightsGroup = new THREE.Group(); root.add(lightsGroup);
	const strobe = addMesh(lightsGroup, new THREE.SphereGeometry(0.06, 10, 8), lightMat(0xffffff), 'strobe'); strobe.position.set(BUBBLE.x - 0.7, BUBBLE.y + R * 0.75 + 0.55, 0); strobe.castShadow = false;
	const lightStrip = addMesh(lightsGroup, new THREE.BoxGeometry(0.9, 0.02, 0.03), amberGlow, 'accent-stripe'); lightStrip.position.set(-2.4, 1.05, 0.2); lightStrip.castShadow = false;
	const lightStrip2 = lightStrip.clone(); lightStrip2.position.z = -0.19; lightsGroup.add(lightStrip2);

	// ---- animation state ------------------------------------------------------------------------------
	let thrust = 0, cruise = 0, gear = 1, fanAngle = 0;
	const apply = () => {
		curtainMat.opacity = 0.75 * thrust * (1 - 0.6 * cruise);
		for (const l of lifts) l.plume.scale.set(1 + 0.25 * thrust, 0.35 + 0.65 * thrust, 1 + 0.25 * thrust);
		// the honeycomb intakes light up white-hot with thrust
		const glow = 0.12 + 2.4 * thrust; grilleMat.color.setHex(thrust > 0.02 ? GRILLE_HEX : 0x2a2f36); if (thrust > 0.02) grilleMat.color.multiplyScalar(glow);
		(tailPlume.material as THREE.MeshBasicMaterial).opacity = 0.4 * thrust * cruise;
		turbine.rotation.y = (Math.PI / 2) * cruise; // 0: axis along Z (side-facing); 1: axis along X, plume aft
		// Legs swing up and out of the way as `gear` goes 1 → 0.
		legs.forEach((l) => l.hip.quaternion.setFromAxisAngle(l.axis, 1.25 * (1 - gear)));
	};
	apply();

	const box = new THREE.Box3();
	return {
		root,
		setThrust(t) { thrust = Math.min(1, Math.max(0, t)); apply(); },
		setCruise(t) { cruise = Math.min(1, Math.max(0, t)); apply(); },
		setGear(e) { gear = Math.min(1, Math.max(0, e)); apply(); },
		setLights(on) { lightsGroup.visible = on; },
		setFirstPerson(on) { pilotParts.forEach((o) => { o.visible = !on; }); },
		update(dt) { fanAngle += dt * (4 + 60 * thrust); fan.rotation.z = fanAngle; },
		stats() {
			let tri = 0, meshes = 0; const mats = new Set<THREE.Material>();
			root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { meshes++; tri += triangles(m.geometry); const mm = m.material; (Array.isArray(mm) ? mm : [mm]).forEach((x) => mats.add(x)); } });
			root.updateMatrixWorld(true);
			// Measure the hull only (not the additive plume cones, which are effects).
			box.makeEmpty();
			root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry.type !== 'ConeGeometry' && m.parent?.name !== 'lift-plume') box.expandByObject(m); });
			return { triangles: tri, meshes, size: box.getSize(new THREE.Vector3()), materials: mats.size };
		},
		dispose() { owned.forEach((o) => o.dispose()); },
	};
}
