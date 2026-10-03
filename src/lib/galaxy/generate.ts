// src/lib/galaxy/generate.ts
// Procedural Milky Way. Pure and deterministic: runs in a Web Worker (or on the
// main thread as a fallback) and returns typed arrays ready for GPU upload.
//
// Every layer uses its own seeded RNG and generates stars independently, so the
// first N stars of a layer are identical whatever the total count is. Lower
// quality tiers therefore draw a random subset of exactly the same galaxy.

import {
	ARMS, ARM_PHASE_OFFSET, ArmSpec, GALAXY, IMF_MIX, OLD_MIX, ORION_SPUR, PATTERN_OMEGA,
	SPECTRAL_CLASSES, SpectralClass, SpectralMix, YOUNG_MIX, DYNAMICS, fromSun, relativeOmega,
} from './constants';
import { createRng, Rng } from './random';
import { LayerCounts } from './tiers';

export type LayerName = keyof LayerCounts;
export const LAYER_NAMES: LayerName[] = ['glow', 'old', 'dust', 'young', 'halo', 'hii'];

export interface LayerData {
	count: number;
	/** Per point: galactocentric radius, initial azimuth, height (world units). */
	cyl: Float32Array;
	/** Per point: RGB, 0–255. */
	color: Uint8Array;
	/** Per point: world-space sprite size, angular speed relative to the Sun, twinkle phase (glow: billboard flag). */
	meta: Float32Array;
}

export type GalaxyData = Record<LayerName, LayerData>;

const SEED = 0x6d11c; // Milky Way, forever the same
const TAU = Math.PI * 2;
const ARM_K = Math.tan(GALAXY.armPitch);
const SPUR_K = Math.tan(ORION_SPUR.pitch);

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

/** Blackbody colour approximation (Tanner Helland), 1,000–40,000 K. */
function kelvinToRgb(kelvin: number): [number, number, number] {
	const t = kelvin / 100;
	let r: number;
	let g: number;
	let b: number;
	if (t <= 66) {
		r = 255;
		g = 99.4708025861 * Math.log(t) - 161.1195681661;
		b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
	} else {
		r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
		g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
		b = 255;
	}
	const clamp = (v: number) => Math.max(0, Math.min(255, v));
	return [clamp(r), clamp(g), clamp(b)];
}

const CLASS_KEYS = Object.keys(SPECTRAL_CLASSES) as SpectralClass[];

function pickClass(rng: Rng, mix: SpectralMix): SpectralClass {
	let u = rng.next();
	for (const key of CLASS_KEYS) {
		u -= mix[key];
		if (u <= 0) return key;
	}
	return 'M';
}

// ---------------------------------------------------------------------------
// Layer writer
// ---------------------------------------------------------------------------

function createLayer(count: number): LayerData {
	return {
		count,
		cyl: new Float32Array(count * 3),
		color: new Uint8Array(count * 3),
		meta: new Float32Array(count * 3),
	};
}

interface Point {
	x: number; // galactocentric, plane
	y: number; // height above plane
	z: number; // galactocentric, plane
}

function writePoint(
	layer: LayerData, i: number, p: Point,
	rgb: [number, number, number], size: number, omega: number, phase: number,
) {
	const o = i * 3;
	layer.cyl[o] = Math.hypot(p.x, p.z);
	layer.cyl[o + 1] = Math.atan2(-p.z, p.x);
	layer.cyl[o + 2] = p.y;
	layer.color[o] = rgb[0];
	layer.color[o + 1] = rgb[1];
	layer.color[o + 2] = rgb[2];
	layer.meta[o] = size;
	layer.meta[o + 1] = omega;
	layer.meta[o + 2] = phase;
}

function writeStar(layer: LayerData, i: number, p: Point, rng: Rng, mix: SpectralMix, giantChance: number, omega: number) {
	const cls = pickClass(rng, mix);
	const info = SPECTRAL_CLASSES[cls];
	const giant = (cls === 'K' || cls === 'M' || cls === 'G') && rng.next() < giantChance;
	const temp = (giant ? info.temp * 0.92 : info.temp) * (0.92 + rng.next() * 0.16);
	const size = info.size * (giant ? 2.3 : 1) * (0.7 + rng.next() * 0.6);
	writePoint(layer, i, p, kelvinToRgb(temp), size, omega, rng.next());
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

const polar = (r: number, theta: number, y: number): Point => ({ x: r * Math.cos(theta), y, z: -r * Math.sin(theta) });

/** Outer-disk warp: north at positive longitude (θ < 0), south opposite. */
function warp(r: number, theta: number): number {
	if (r <= GALAXY.warpStartRadius) return 0;
	const d = r - GALAXY.warpStartRadius;
	return -GALAXY.warpAmplitude * d * d * Math.sin(theta);
}

/** Radius from an exponential surface-density disk: p(r) ∝ r·e^(−r/h). */
function exponentialDiskRadius(rng: Rng, scale: number, rMax: number): number {
	for (;;) {
		const r = -scale * Math.log(Math.max(1e-9, rng.next() * rng.next()));
		if (r <= rMax) return r;
	}
}

function armTheta(arm: ArmSpec, r: number): number {
	return ARM_PHASE_OFFSET + arm.phase + Math.log(r / GALAXY.sagittariusRadiusAtSun) / ARM_K;
}

/** The spur passes through the Sun's position (θ = 0 at R₀), slightly inside it. */
function spurTheta(r: number): number {
	return Math.log(r / (GALAXY.sunRadius - 3)) / SPUR_K;
}

function armRadius(rng: Rng, rStart: number, rEnd: number, falloff: number): number {
	for (;;) {
		const r = rStart - falloff * Math.log(Math.max(1e-9, rng.next()));
		if (r <= rEnd) return r;
	}
}

/** Bar / boxy-peanut bulge, returned in galactocentric coordinates. */
function barPoint(rng: Rng, spread = 1): Point {
	const half = GALAXY.barHalfLength;
	let bx: number;
	let bz: number;
	let by: number;
	if (rng.next() < 0.6) {
		// Long bar: elongated triaxial Gaussian, vertically thicker towards the ends (peanut).
		do bx = rng.gaussian() * half * 0.42 * spread; while (Math.abs(bx) > half * 1.1);
		bz = rng.gaussian() * half * 0.13 * spread;
		by = rng.gaussian() * (4 + 7 * Math.abs(bx) / half) * spread;
	} else {
		// Central boxy bulge.
		bx = rng.gaussian() * GALAXY.bulgeRadius * 0.45 * spread;
		bz = rng.gaussian() * GALAXY.bulgeRadius * 0.32 * spread;
		by = rng.gaussian() * GALAXY.bulgeRadius * 0.3 * spread;
	}
	const c = Math.cos(GALAXY.barAngle);
	const s = Math.sin(GALAXY.barAngle);
	// Rotate bar-frame (bx along major axis, bz across it) to azimuth barAngle.
	const x = bx * c + bz * s;
	const planeY = bx * s - bz * c; // in-plane coordinate along θ = 90°
	return { x, y: by, z: -planeY };
}

interface Clump {
	r: number;
	theta: number;
	omega: number;
	sigma: number;
}

/**
 * OB associations / star-forming knots along the arms. Built from a fixed seed so
 * they are identical on every tier; young stars and HII regions both use them.
 */
const CLUMPS: Clump[] = (() => {
	const rng = createRng(SEED ^ 0xc1);
	const clumps: Clump[] = [];
	for (const arm of ARMS) {
		const n = Math.round(arm.weight * 420);
		for (let i = 0; i < n; i++) {
			const r = armRadius(rng, arm.rStart, arm.rEnd, 170);
			const w = arm.width * (1 + (r - arm.rStart) / 320);
			clumps.push({
				r: r + rng.gaussian() * w * 0.6,
				theta: armTheta(arm, r) + rng.gaussian() * 0.01,
				omega: arm.omega,
				sigma: 1 + rng.next() * 2.5,
			});
		}
	}
	for (let i = 0; i < 26; i++) {
		const r = rng.range(ORION_SPUR.rStart, ORION_SPUR.rEnd);
		clumps.push({ r: r + rng.gaussian() * ORION_SPUR.width * 0.5, theta: spurTheta(r), omega: ORION_SPUR.omega, sigma: 0.8 + rng.next() * 1.5 });
	}
	return clumps;
})();

function pickArm(rng: Rng, key: 'weight' | 'oldWeight'): ArmSpec {
	const total = ARMS.reduce((s, a) => s + a[key], 0);
	let u = rng.next() * total;
	for (const arm of ARMS) {
		u -= arm[key];
		if (u <= 0) return arm;
	}
	return ARMS[0];
}

/** A point scattered around an arm's centreline; `edge` shifts it towards the inner (concave) edge. */
function armPoint(rng: Rng, arm: ArmSpec, widthScale: number, falloff: number, edge = 0): { r: number; theta: number } {
	const r0 = armRadius(rng, arm.rStart, arm.rEnd, falloff);
	const w = arm.width * (1 + (r0 - arm.rStart) / 320) * widthScale;
	const r = Math.max(1, r0 + (rng.gaussian() - edge) * w);
	return { r, theta: armTheta(arm, r0) + (rng.gaussian() * w * 0.4) / r0 };
}

function spurPoint(rng: Rng, widthScale: number, edge = 0): { r: number; theta: number } {
	const r0 = rng.range(ORION_SPUR.rStart, ORION_SPUR.rEnd);
	return { r: r0 + (rng.gaussian() - edge) * ORION_SPUR.width * widthScale, theta: spurTheta(r0) };
}

// ---------------------------------------------------------------------------
// Populations
// ---------------------------------------------------------------------------

function generateOld(count: number): LayerData {
	const layer = createLayer(count);
	const rng = createRng(SEED ^ 0x01);
	for (let i = 0; i < count; i++) {
		const u = rng.next();
		if (u < 0.3) {
			// Bulge + bar: rotates rigidly with the bar pattern.
			writeStar(layer, i, barPoint(rng), rng, OLD_MIX, 0.07, PATTERN_OMEGA);
		} else if (u < 0.88) {
			// Thin disk. ~20% trace the two major arms (the old stellar arms seen in infrared).
			let r: number;
			let theta: number;
			let omega: number;
			if (rng.next() < 0.2) {
				const arm = pickArm(rng, 'oldWeight');
				({ r, theta } = armPoint(rng, arm, 1.9, 150));
				omega = arm.omega;
			} else {
				r = exponentialDiskRadius(rng, GALAXY.thinDiskScaleLength, GALAXY.diskRadius);
				// The bar sweeps the inner disk clear.
				if (r < GALAXY.barHalfLength * 0.8 && rng.next() < 0.55) r = GALAXY.barHalfLength * 0.8 + rng.next() * 40;
				theta = rng.next() * TAU;
				omega = relativeOmega(r);
			}
			const y = rng.laplace(GALAXY.thinDiskScaleHeight) + warp(r, theta);
			writeStar(layer, i, polar(r, theta, y), rng, IMF_MIX, 0.03, omega);
		} else {
			// Thick disk: older, puffier, lags the thin disk (asymmetric drift).
			const r = exponentialDiskRadius(rng, GALAXY.thickDiskScaleLength, GALAXY.diskRadius);
			const theta = rng.next() * TAU;
			const y = rng.laplace(GALAXY.thickDiskScaleHeight) + warp(r, theta);
			writeStar(layer, i, polar(r, theta, y), rng, OLD_MIX, 0.05, relativeOmega(r) * DYNAMICS.thickDiskLag);
		}
	}
	return layer;
}

function generateYoung(count: number): LayerData {
	const layer = createLayer(count);
	const rng = createRng(SEED ^ 0x02);
	for (let i = 0; i < count; i++) {
		const u = rng.next();
		let r: number;
		let theta: number;
		let omega = PATTERN_OMEGA;
		if (u < 0.42) {
			// Knotty OB associations.
			const clump = CLUMPS[Math.floor(rng.next() * CLUMPS.length)];
			r = clump.r + rng.gaussian() * clump.sigma;
			theta = clump.theta + (rng.gaussian() * clump.sigma) / clump.r;
			omega = clump.omega;
		} else if (u < 0.9) {
			({ r, theta } = armPoint(rng, pickArm(rng, 'weight'), 1, 170));
		} else if (u < 0.96) {
			({ r, theta } = spurPoint(rng, 1));
			omega = ORION_SPUR.omega;
		} else {
			// Field young stars scattered through the disk.
			r = exponentialDiskRadius(rng, GALAXY.thinDiskScaleLength, GALAXY.diskRadius);
			theta = rng.next() * TAU;
			omega = relativeOmega(r);
		}
		const y = rng.laplace(GALAXY.youngScaleHeight) + warp(r, theta);
		writeStar(layer, i, polar(r, theta, y), rng, YOUNG_MIX, 0, omega);
	}
	return layer;
}

/** Halo radius with ρ ∝ r^-3.5 → p(r) ∝ r^-1.5. */
function haloRadius(rng: Rng, rIn: number, rOut: number): number {
	const a = Math.pow(rIn, -0.5);
	const b = Math.pow(rOut, -0.5);
	return Math.pow(a - rng.next() * (a - b), -2);
}

function sphereDirection(rng: Rng): Point {
	const y = rng.next() * 2 - 1;
	const phi = rng.next() * TAU;
	const s = Math.sqrt(1 - y * y);
	return { x: s * Math.cos(phi), y, z: s * Math.sin(phi) };
}

export const GLOBULAR_CLUSTERS: Point[] = (() => {
	const rng = createRng(SEED ^ 0x9c);
	return Array.from({ length: GALAXY.globularClusterCount }, () => {
		const r = haloRadius(rng, 5, 1_200);
		const d = sphereDirection(rng);
		return { x: d.x * r, y: d.y * r * 0.85, z: d.z * r };
	});
})();

function generateHalo(count: number): LayerData {
	const layer = createLayer(count);
	const rng = createRng(SEED ^ 0x03);
	const lmc = fromSun(GALAXY.lmc.distance, GALAXY.lmc.l, GALAXY.lmc.b);
	const smc = fromSun(GALAXY.smc.distance, GALAXY.smc.l, GALAXY.smc.b);
	for (let i = 0; i < count; i++) {
		const u = rng.next();
		if (u < 0.62) {
			const r = haloRadius(rng, GALAXY.haloInnerRadius, GALAXY.haloOuterRadius);
			const d = sphereDirection(rng);
			writeStar(layer, i, { x: d.x * r, y: d.y * r * GALAXY.haloFlattening, z: d.z * r }, rng, OLD_MIX, 0.1, 0);
		} else if (u < 0.92) {
			const c = GLOBULAR_CLUSTERS[Math.floor(rng.next() * GLOBULAR_CLUSTERS.length)];
			const s = GALAXY.globularClusterRadius;
			const p = { x: c.x + rng.gaussian() * s, y: c.y + rng.gaussian() * s, z: c.z + rng.gaussian() * s };
			writeStar(layer, i, p, rng, OLD_MIX, 0.25, 0);
		} else {
			// Magellanic Clouds: star-forming dwarf galaxies, so a young mix.
			const cloud = u < 0.98 ? lmc : smc;
			const s = u < 0.98 ? GALAXY.lmc.radius : GALAXY.smc.radius;
			const p = { x: cloud.x + rng.gaussian() * s * 0.5, y: cloud.y + rng.gaussian() * s * 0.25, z: cloud.z + rng.gaussian() * s * 0.5 };
			writeStar(layer, i, p, rng, YOUNG_MIX, 0.02, 0);
		}
	}
	return layer;
}

/**
 * Unresolved starlight. meta.z is 1 for camera-facing (spheroidal bulge) sprites and
 * 0 for sprites lying flat in the disk. Sizes are for the Ultra count; sparser tiers
 * enlarge them in the shader so the haze keeps the same coverage.
 */
function generateGlow(count: number): LayerData {
	const layer = createLayer(count);
	const rng = createRng(SEED ^ 0x04);
	for (let i = 0; i < count; i++) {
		const u = rng.next();
		if (u < 0.25) {
			writePoint(layer, i, barPoint(rng, 1.1), [105, 84, 60], rng.range(18, 34), PATTERN_OMEGA, 1);
		} else if (u < 0.62) {
			const r = exponentialDiskRadius(rng, GALAXY.thinDiskScaleLength, GALAXY.diskRadius);
			const theta = rng.next() * TAU;
			const y = rng.laplace(GALAXY.thinDiskScaleHeight * 0.5) + warp(r, theta);
			writePoint(layer, i, polar(r, theta, y), [200, 180, 170], rng.range(28, 50), relativeOmega(r), 0);
		} else {
			const arm = pickArm(rng, 'weight');
			const { r, theta } = armPoint(rng, arm, 1.2, 170);
			const y = rng.laplace(GALAXY.youngScaleHeight) + warp(r, theta);
			writePoint(layer, i, polar(r, theta, y), [140, 172, 255], rng.range(18, 34), arm.omega, 0);
		}
	}
	return layer;
}

function generateDust(count: number): LayerData {
	const layer = createLayer(count);
	const rng = createRng(SEED ^ 0x05);
	// Absorption colour: blue light is absorbed most (interstellar reddening).
	const absorb: [number, number, number] = [170, 205, 255];
	for (let i = 0; i < count; i++) {
		const u = rng.next();
		const phase = rng.next();
		let r: number;
		let theta: number;
		let omega = PATTERN_OMEGA;
		let size = rng.range(9, 18);
		if (u < 0.5) {
			// Dust lanes hug the inner (concave) edge of each arm.
			({ r, theta } = armPoint(rng, pickArm(rng, 'weight'), 0.55, 170, 1.6));
		} else if (u < 0.56) {
			({ r, theta } = spurPoint(rng, 0.6, 1.4));
			omega = ORION_SPUR.omega;
		} else if (u < 0.64) {
			// Bar dust lanes: two straight lanes on the bar's leading edges.
			const half = GALAXY.barHalfLength;
			const bx = rng.range(-half * 0.95, half * 0.95);
			const bz = Math.sign(bx || 1) * (half * 0.12 + rng.gaussian() * 4);
			const c = Math.cos(GALAXY.barAngle);
			const s = Math.sin(GALAXY.barAngle);
			const x = bx * c + bz * s;
			const planeY = bx * s - bz * c;
			r = Math.hypot(x, planeY);
			theta = Math.atan2(planeY, x);
			size = rng.range(8, 14);
		} else {
			// Diffuse disk dust — makes the edge-on dust lane continuous.
			r = exponentialDiskRadius(rng, GALAXY.thinDiskScaleLength * 1.3, GALAXY.diskRadius * 0.9);
			theta = rng.next() * TAU;
			omega = relativeOmega(r);
		}
		const y = rng.laplace(GALAXY.dustScaleHeight) + warp(r, theta);
		writePoint(layer, i, polar(r, theta, y), absorb, size, omega, phase);
	}
	return layer;
}

function generateHii(count: number): LayerData {
	const layer = createLayer(count);
	const rng = createRng(SEED ^ 0x06);
	for (let i = 0; i < count; i++) {
		let r: number;
		let theta: number;
		let omega = PATTERN_OMEGA;
		if (rng.next() < 0.85) {
			const clump = CLUMPS[Math.floor(rng.next() * CLUMPS.length)];
			r = clump.r + rng.gaussian() * clump.sigma * 0.8;
			theta = clump.theta + (rng.gaussian() * clump.sigma * 0.8) / clump.r;
			omega = clump.omega;
		} else {
			({ r, theta } = armPoint(rng, pickArm(rng, 'weight'), 0.5, 170));
		}
		const y = rng.laplace(GALAXY.youngScaleHeight * 0.6) + warp(r, theta);
		const reflection = rng.next() < 0.18;
		const jitter = 0.85 + rng.next() * 0.3;
		const rgb: [number, number, number] = reflection
			? [140 * jitter, 170 * jitter, 255]
			: [255, 92 * jitter, 150 * jitter]; // Hα + Hβ blend
		writePoint(layer, i, polar(r, theta, y), rgb, rng.range(2.5, 7), omega, rng.next());
	}
	return layer;
}

export function generateGalaxy(counts: LayerCounts): GalaxyData {
	return {
		glow: generateGlow(counts.glow),
		old: generateOld(counts.old),
		dust: generateDust(counts.dust),
		young: generateYoung(counts.young),
		halo: generateHalo(counts.halo),
		hii: generateHii(counts.hii),
	};
}

export function transferablesOf(data: GalaxyData): ArrayBuffer[] {
	return LAYER_NAMES.flatMap((name) => {
		const layer = data[name];
		return [layer.cyl.buffer, layer.color.buffer, layer.meta.buffer] as ArrayBuffer[];
	});
}
