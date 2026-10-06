// src/lib/fly/ship/kestrel.ts
// The Kestrel: a small dragonfly-like VTOL scout, built entirely in code (no downloaded assets).
//
// Design language (an ORIGINAL design inspired by the references Gee supplied, not a copy of any film craft):
//   · a glass spherical cockpit with a gyroscope-style ring frame, two seats and a console,
//   · a white spherical engine pod behind it with seam lines and a glowing lift ring underneath,
//   · a long, thin spine ending in a side-facing ring turbine that can swing to face aft for cruise,
//   · thin swept wing blades, and four spindly, jointed insect legs that fold up in flight.
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
	const amberGlow = lightMat(AMBER), cyanGlow = lightMat(CYAN), screenMat = lightMat(0x2fb6e8);
	const addMesh = (parent: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, name: string) => { own(g); const mesh = new THREE.Mesh(g, m); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh; };

	// ---- spine (thin tapered fairing from the cockpit cradle back to the tail ring) -------------
	const spineSections: Section[] = [
		{ x: -4.0, w: 0.10, top: 0.10, bottom: 0.10, n: 2 }, { x: -3.2, w: 0.14, top: 0.14, bottom: 0.14, n: 2 }, { x: -2.0, w: 0.2, top: 0.2, bottom: 0.2, n: 2 },
		{ x: -0.9, w: 0.34, top: 0.34, bottom: 0.3, n: 2.2 }, { x: 0.6, w: 0.4, top: 0.38, bottom: 0.34, n: 2.2 }, { x: 2.0, w: 0.34, top: 0.32, bottom: 0.3, n: 2.2 },
		{ x: 3.2, w: 0.22, top: 0.22, bottom: 0.22, n: 2 },
	];
	addMesh(root, loft(spineSections, Math.round(seg / 2)), ceramic, 'spine');

	// ---- engine pod: a white sphere with seam rings and a glowing lift ring underneath ----------
	const engine = new THREE.Group(); engine.name = 'engine-pod'; engine.position.set(0.6, 0.0, 0); root.add(engine);
	addMesh(engine, new THREE.SphereGeometry(1.25, seg, Math.round(seg * 0.6)), ceramic, 'engine-sphere');
	for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
		const ring = addMesh(engine, new THREE.TorusGeometry(1.255, 0.018, 8, seg * 2), graphite, 'engine-seam');
		ring.rotation.y = a; // meridian seams at 0°, 60°, 120°
	}
	const lift = new THREE.Group(); lift.position.y = -1.18; engine.add(lift);
	const liftRing = addMesh(lift, new THREE.TorusGeometry(0.72, 0.06, 10, seg), amberGlow, 'lift-ring'); liftRing.rotation.x = Math.PI / 2; liftRing.castShadow = false;
	const liftDisc = addMesh(lift, new THREE.CircleGeometry(0.66, seg), cyanGlow, 'lift-disc'); liftDisc.rotation.x = Math.PI / 2; liftDisc.position.y = -0.04; liftDisc.castShadow = false;
	const liftPlume = new THREE.Mesh(own(new THREE.ConeGeometry(0.64, 2.4, seg, 1, true)), own(new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })));
	liftPlume.position.y = -1.25; lift.add(liftPlume);
	// intake ring on the front of the pod (a bezel with a dark centre)
	const bezel = new THREE.Group(); bezel.position.set(1.18, 0.0, 0); bezel.rotation.y = Math.PI / 2; engine.add(bezel);
	addMesh(bezel, new THREE.TorusGeometry(0.38, 0.05, 10, seg), steel, 'bezel-ring');
	addMesh(bezel, new THREE.CircleGeometry(0.34, seg), graphite, 'bezel-core');

	// ---- cockpit: glass sphere, gyroscope frame, cradle, seats, console -------------------------
	const cockpit = new THREE.Group(); cockpit.name = 'cockpit'; cockpit.position.set(3.4, 0.45, 0); root.add(cockpit);
	const R = 1.35;
	addMesh(cockpit, new THREE.SphereGeometry(R, seg, Math.round(seg * 0.6)), glass, 'canopy');
	const tube = 0.032;
	const frame = new THREE.Group(); frame.name = 'frame'; cockpit.add(frame);
	const ringAt = (rx: number, ry: number, rz: number) => { const r = addMesh(frame, new THREE.TorusGeometry(R * 1.003, tube, 8, seg * 2), graphite, 'frame-ring'); r.rotation.set(rx, ry, rz); r.castShadow = false; return r; };
	ringAt(Math.PI / 2, 0, 0); // equator
	ringAt(0, 0, 0); // vertical, across the span
	ringAt(0, Math.PI / 2, 0); // vertical, fore-aft
	ringAt(Math.PI / 2.6, Math.PI / 5, 0); // a tilted ring for the gyroscope look
	// cradle: dark structure joining the sphere to the spine
	addMesh(cockpit, new THREE.CylinderGeometry(0.5, 0.7, 0.55, 20), graphite, 'cradle').position.set(-0.55, -0.95, 0);
	const strut = addMesh(cockpit, new THREE.BoxGeometry(1.6, 0.22, 0.36), graphite, 'cradle-beam'); strut.position.set(-1.1, -0.55, 0);
	// interior: two seats, a console with glowing screens, two crew silhouettes
	const pilotParts: THREE.Object3D[] = [];
	const seat = (z: number) => {
		const s = new THREE.Group(); s.position.set(-0.15, -0.6, z);
		addMesh(s, new THREE.BoxGeometry(0.55, 0.12, 0.5), graphite, 'seat-base');
		const back = addMesh(s, new THREE.BoxGeometry(0.12, 0.7, 0.5), graphite, 'seat-back'); back.position.set(-0.25, 0.35, 0); back.rotation.z = -0.15;
		const body = addMesh(s, new THREE.CapsuleGeometry(0.17, 0.4, 4, 10), own(new THREE.MeshStandardMaterial({ color: 0x3a4658, roughness: 0.9 })), 'crew-body'); body.position.set(0.0, 0.42, 0);
		const head = addMesh(s, new THREE.SphereGeometry(0.15, 14, 10), own(new THREE.MeshStandardMaterial({ color: 0x4b566a, roughness: 0.6 })), 'crew-head'); head.position.set(0.02, 0.88, 0);
		if (z > 0) pilotParts.push(body, head); // the left seat is the pilot's (first-person eye position)
		cockpit.add(s);
	};
	seat(0.42); seat(-0.42);
	const consoleBox = addMesh(cockpit, new THREE.BoxGeometry(0.5, 0.3, 1.5), graphite, 'console'); consoleBox.position.set(0.7, -0.45, 0); consoleBox.rotation.z = 0.35;
	for (const z of [-0.45, 0, 0.45]) { const scr = addMesh(cockpit, new THREE.PlaneGeometry(0.3, 0.2), screenMat, 'screen'); scr.position.set(0.7 - 0.07, -0.34, z); scr.rotation.set(0, -Math.PI / 2, 0.35); scr.castShadow = false; }

	// ---- tail: pylon + ring turbine that swings from side-facing to aft-facing ------------------
	const tail = new THREE.Group(); tail.name = 'tail'; tail.position.set(-3.85, 0.35, 0); root.add(tail);
	addMesh(root, new THREE.CylinderGeometry(0.06, 0.09, 0.45, 10), graphite, 'tail-pylon').position.set(-3.85, 0.15, 0);
	const turbine = new THREE.Group(); turbine.name = 'turbine'; tail.add(turbine);
	const ringR = 0.9;
	const shell = addMesh(turbine, new THREE.TorusGeometry(ringR, 0.1, 14, seg * 2), ceramic, 'turbine-shell'); // axis = turbine local Z (faces ±Z when cruise = 0)
	void shell;
	const inner = addMesh(turbine, new THREE.TorusGeometry(ringR - 0.1, 0.03, 8, seg * 2), steel, 'turbine-lip'); void inner;
	const fan = new THREE.Group(); fan.name = 'fan'; turbine.add(fan);
	const bladeGeo = own(new THREE.BoxGeometry(ringR * 1.7, 0.08, 0.012));
	for (let i = 0; i < 11; i++) { const b = new THREE.Mesh(bladeGeo, steel); b.rotation.z = (i / 11) * Math.PI; b.rotation.x = 0.35; b.castShadow = true; fan.add(b); }
	const hub = addMesh(fan, new THREE.CylinderGeometry(0.13, 0.13, 0.1, 16), graphite, 'fan-hub'); hub.rotation.x = Math.PI / 2;
	// glowing ring on the turbine rim
	const rimGlow = addMesh(turbine, new THREE.TorusGeometry(ringR + 0.1, 0.018, 8, seg * 2), amberGlow, 'turbine-rim'); rimGlow.castShadow = false;
	const tailPlume = new THREE.Mesh(own(new THREE.ConeGeometry(ringR * 0.8, 2.6, seg, 1, true)), own(new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })));
	tailPlume.rotation.x = Math.PI / 2; tailPlume.position.z = -1.5; turbine.add(tailPlume); // exhaust trails along turbine local −Z, which is aft (−X) once it swings to cruise
	// small tail fins
	for (const s of [1, -1]) { const fin = addMesh(root, wingSlab({ z0: 0, z1: s * 0.8, rootLE: -3.2, rootTE: -3.9, tipLE: -3.6, tipTE: -4.0, thick: 0.04, tipThick: 0.02, y: 0.1 }), wingMat, 'tail-fin'); void fin; }

	// ---- wings: thin swept blades from the engine pod --------------------------------------------
	for (const s of [1, -1]) {
		const w = wingSlab({ z0: 1.1, z1: 4.0, rootLE: 0.5, rootTE: -1.1, tipLE: -1.2, tipTE: -1.75, thick: 0.07, tipThick: 0.03, y: 0.25, dihedral: 0.35 });
		const m = addMesh(root, w, wingMat, s === 1 ? 'wing-r' : 'wing-l'); if (s === -1) m.scale.z = -1;
		// tip navigation light
		const nav = addMesh(root, new THREE.SphereGeometry(0.05, 10, 8), s === 1 ? lightMat(0x40ff70) : lightMat(0xff4a3a), 'nav-light'); nav.position.set(-1.45, 0.62, s * 3.98); nav.castShadow = false;
	}

	// ---- legs: four spindly, jointed insect legs (hip → knee → foot) --------------------------------
	interface Leg { hip: THREE.Group; knee: THREE.Group }
	const legs: Leg[] = [];
	// [hip x, side, hip y, upper length, lower length]: sized so the feet sit ≈ 2.0 m below the spine with the gear out.
	const legSpec: [number, number, number, number, number][] = [
		[3.0, 1, -0.9, 0.72, 0.56], [3.0, -1, -0.9, 0.72, 0.56], [0.3, 1, -0.95, 0.62, 0.52], [0.3, -1, -0.95, 0.62, 0.52],
	];
	legSpec.forEach(([hx, side, hy, up, low], i) => {
		const front = i < 2;
		const hip = new THREE.Group(); hip.name = `leg-${i}`;
		hip.position.set(hx, hy, side * (front ? 0.45 : 0.8)); root.add(hip);
		const upper = addMesh(hip, new THREE.CylinderGeometry(0.04, 0.05, up, 8), steel, 'leg-upper'); upper.position.y = -up / 2;
		const knee = new THREE.Group(); knee.position.y = -up; hip.add(knee);
		addMesh(knee, new THREE.SphereGeometry(0.075, 12, 8), graphite, 'leg-knee');
		const lower = addMesh(knee, new THREE.CylinderGeometry(0.03, 0.045, low, 8), steel, 'leg-lower'); lower.position.y = -low / 2;
		const pad = addMesh(knee, new THREE.BoxGeometry(0.34, 0.05, 0.22), graphite, 'leg-pad'); pad.position.y = -low - 0.02;
		hip.rotation.z = (front ? 1 : -1) * 0.12; // slight fore/aft splay
		legs.push({ hip, knee });
	});

	// ---- running lights -----------------------------------------------------------------------------
	const lightsGroup = new THREE.Group(); root.add(lightsGroup);
	const strobe = addMesh(lightsGroup, new THREE.SphereGeometry(0.06, 10, 8), lightMat(0xffffff), 'strobe'); strobe.position.set(0.6, 1.27, 0); strobe.castShadow = false;
	const lightStrip = addMesh(lightsGroup, new THREE.BoxGeometry(0.9, 0.02, 0.03), amberGlow, 'accent-stripe'); lightStrip.position.set(-1.8, 0.2, 0.19); lightStrip.castShadow = false;
	const lightStrip2 = lightStrip.clone(); lightStrip2.position.z = -0.19; lightsGroup.add(lightStrip2);

	// ---- animation state ------------------------------------------------------------------------------
	let thrust = 0, cruise = 0, gear = 1, fanAngle = 0;
	const apply = () => {
		(liftPlume.material as THREE.MeshBasicMaterial).opacity = 0.35 * thrust * (1 - 0.7 * cruise);
		liftPlume.scale.y = 0.4 + 0.6 * thrust;
		(liftDisc.material as THREE.MeshBasicMaterial).color.setHex(thrust > 0.02 ? CYAN : 0x335566);
		(tailPlume.material as THREE.MeshBasicMaterial).opacity = 0.4 * thrust * cruise;
		turbine.rotation.y = (Math.PI / 2) * cruise; // 0: axis along Z (side-facing); 1: axis along X, plume aft
		// Legs fold up and inwards as `gear` goes 1 → 0.
		legs.forEach((l, i) => { const side = i % 2 === 0 ? 1 : -1; const f = 1 - gear; l.hip.rotation.x = side * (-0.38 - f * 1.0); l.knee.rotation.x = side * f * 1.9; });
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
			root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry.type !== 'ConeGeometry') box.expandByObject(m); });
			return { triangles: tri, meshes, size: box.getSize(new THREE.Vector3()), materials: mats.size };
		},
		dispose() { owned.forEach((o) => o.dispose()); },
	};
}
