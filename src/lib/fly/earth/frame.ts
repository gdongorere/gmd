// src/lib/fly/earth/frame.ts
// The render frame. ECEF doubles cannot go to the GPU; everything is drawn in a local east/up/south frame anchored near the ship
// (x = east, y = up, z = south, so +Y is "up" exactly as the existing ship, camera and arena code assume). The anchor is re-based when the
// ship wanders more than REBASE_DISTANCE away, so float32 stays precise and the local "up" never tilts visibly (5 km ⇒ 0.045°).

import * as THREE from 'three';
import { type Vec3, ecefToGeodetic, enuBasis } from './geo';

export const REBASE_DISTANCE = 4000;

export class LocalFrame {
	anchor = new THREE.Vector3();
	/** Local → ECEF rotation (columns east, up, south). */
	readonly basis = new THREE.Matrix4();
	/** ECEF → local rotation (transpose). */
	readonly inverse = new THREE.Matrix4();
	readonly qBasis = new THREE.Quaternion();
	/** ECEF → local rotation as a quaternion (the orientation for objects whose vertices are in ECEF axes). */
	readonly qInv = new THREE.Quaternion();
	private tmp = new THREE.Vector3();

	constructor(anchorEcef?: Vec3) { if (anchorEcef) this.setAnchor(anchorEcef); }

	setAnchor(p: Vec3) {
		this.anchor.set(p[0], p[1], p[2]);
		const g = ecefToGeodetic(p[0], p[1], p[2]);
		const { east, up, north } = enuBasis(g.lat, g.lon);
		const E = new THREE.Vector3(...east), U = new THREE.Vector3(...up), S = new THREE.Vector3(...north).multiplyScalar(-1);
		this.basis.makeBasis(E, U, S);
		this.inverse.copy(this.basis).transpose();
		this.qBasis.setFromRotationMatrix(this.basis).normalize();
		this.qInv.copy(this.qBasis).invert();
	}

	/** True when `ecef` is far enough from the anchor that the frame should be moved to it. */
	needsRebase(ecef: THREE.Vector3): boolean { return this.tmp.copy(ecef).sub(this.anchor).lengthSq() > REBASE_DISTANCE * REBASE_DISTANCE; }

	/** ECEF point → local coordinates (metres from the anchor). Writes into `out`. */
	toLocal(ecef: THREE.Vector3 | Vec3, out = new THREE.Vector3()): THREE.Vector3 {
		if (Array.isArray(ecef)) out.set(ecef[0], ecef[1], ecef[2]); else out.copy(ecef);
		return out.sub(this.anchor).applyMatrix4(this.inverse);
	}
	/** ECEF direction/velocity → local. */
	dirToLocal(v: THREE.Vector3 | Vec3, out = new THREE.Vector3()): THREE.Vector3 {
		if (Array.isArray(v)) out.set(v[0], v[1], v[2]); else out.copy(v);
		return out.applyMatrix4(this.inverse);
	}
	/** Local → ECEF point. */
	toEcef(local: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
		return out.copy(local).applyMatrix4(this.basis).add(this.anchor);
	}
	/** Body→ECEF orientation → body→local orientation. */
	quatToLocal(q: THREE.Quaternion, out = new THREE.Quaternion()): THREE.Quaternion { return out.copy(this.qInv).multiply(q); }
}
