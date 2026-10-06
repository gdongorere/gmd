// src/lib/fly/ship/loft.ts
// Small geometry helpers for the procedural ships: a lofted body through superellipse cross-sections, and a swept wing slab.

import * as THREE from 'three';

export interface Section {
	/** Position along the body axis (+X is forward), metres. */
	x: number;
	/** Half-width (Z), half-height above the centre line and below it (Y), metres. */
	w: number; top: number; bottom: number;
	/** Vertical offset of the section centre. */
	y?: number;
	/** Superellipse exponent: 2 = ellipse, higher = squarer. */
	n?: number;
}

const sgnpow = (v: number, p: number) => Math.sign(v) * Math.pow(Math.abs(v), p);

/**
 * A closed lofted body through the given sections (ordered tail → nose). `ring` points per section; the ends are capped with fans.
 * UVs run u = along the body, v = around, so a panel-line texture wraps naturally.
 */
export function loft(sections: Section[], ring = 28): THREE.BufferGeometry {
	const pos: number[] = [], uv: number[] = [], idx: number[] = [];
	const m = sections.length;
	for (let i = 0; i < m; i++) {
		const s = sections[i], n = s.n ?? 2.4, yc = s.y ?? 0;
		for (let j = 0; j <= ring; j++) {
			const t = (j / ring) * Math.PI * 2;
			const c = Math.cos(t), sn = Math.sin(t);
			const z = s.w * sgnpow(c, 2 / n);
			const y = yc + (sn >= 0 ? s.top : s.bottom) * sgnpow(sn, 2 / n);
			pos.push(s.x, y, z);
			uv.push(i / (m - 1), j / ring);
		}
	}
	const row = ring + 1;
	for (let i = 0; i < m - 1; i++) {
		for (let j = 0; j < ring; j++) {
			const a = i * row + j, b = a + 1, c = a + row, d = c + 1;
			idx.push(a, c, b, b, c, d);
		}
	}
	// End caps.
	for (const [i, flip] of [[0, true], [m - 1, false]] as const) {
		const s = sections[i];
		const centre = pos.length / 3;
		pos.push(s.x, s.y ?? 0, 0); uv.push(i / (m - 1), 0.5);
		for (let j = 0; j < ring; j++) {
			const a = i * row + j, b = a + 1;
			if (flip) idx.push(centre, b, a); else idx.push(centre, a, b);
		}
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}

/**
 * A swept, tapered wing slab from root to tip (positive Z side; mirror with scale.z = −1).
 * `rootLE/rootTE` and `tipLE/tipTE` are leading/trailing-edge X positions; `thick` is the slab thickness, tapering to `tipThick`.
 */
export function wingSlab(opts: { z0: number; z1: number; rootLE: number; rootTE: number; tipLE: number; tipTE: number; thick: number; tipThick: number; y?: number; dihedral?: number }): THREE.BufferGeometry {
	const { z0, z1, rootLE, rootTE, tipLE, tipTE, thick, tipThick, y = 0, dihedral = 0 } = opts;
	const yTip = y + dihedral;
	// 8 corners: root (LE, TE) top/bottom, tip (LE, TE) top/bottom. Rounded leading edge approximated with a mid-chord bulge via extra verts.
	const v = [
		[rootLE, y + thick / 2, z0], [rootTE, y + thick / 2, z0], [rootTE, y - thick / 2, z0], [rootLE, y - thick / 2, z0],
		[tipLE, yTip + tipThick / 2, z1], [tipTE, yTip + tipThick / 2, z1], [tipTE, yTip - tipThick / 2, z1], [tipLE, yTip - tipThick / 2, z1],
	];
	const idx = [
		0, 1, 5, 0, 5, 4, // top
		3, 7, 6, 3, 6, 2, // bottom
		0, 4, 7, 0, 7, 3, // leading edge
		1, 2, 6, 1, 6, 5, // trailing edge
		4, 5, 6, 4, 6, 7, // tip
		0, 3, 2, 0, 2, 1, // root
	];
	const g = new THREE.BufferGeometry();
	// Unshared vertices per face so the flat panels shade crisply.
	const pos: number[] = [], uv: number[] = [];
	for (let i = 0; i < idx.length; i++) { const p = v[idx[i]]; pos.push(p[0], p[1], p[2]); uv.push((p[0] + 4) / 8, (p[2] + 4) / 8); }
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
	g.computeVertexNormals();
	return g;
}

/** A hollow ducted-fan shell (outer wall + inner wall + lips) by revolving a profile about the Y axis. */
export function ductShell(outerR: number, innerR: number, height: number, segments = 48): THREE.BufferGeometry {
	const h = height / 2, lip = (outerR - innerR) / 2;
	const pts = [
		new THREE.Vector2(innerR, -h), new THREE.Vector2(innerR + lip * 0.2, -h - lip * 0.35), new THREE.Vector2(outerR - lip * 0.2, -h - lip * 0.35), new THREE.Vector2(outerR, -h + lip * 0.1),
		new THREE.Vector2(outerR * 1.02, 0), new THREE.Vector2(outerR, h - lip * 0.1), new THREE.Vector2(outerR - lip * 0.2, h + lip * 0.35), new THREE.Vector2(innerR + lip * 0.2, h + lip * 0.35), new THREE.Vector2(innerR, h),
		new THREE.Vector2(innerR, -h),
	];
	const g = new THREE.LatheGeometry(pts, segments);
	g.computeVertexNormals();
	return g;
}

/** Triangle count of a geometry (indexed or not). */
export const triangles = (g: THREE.BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3;
