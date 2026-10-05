// src/lib/galaxy/constants.ts
import { SUN_OMEGA_KMS_KPC } from '@/lib/astro/galaxySun';
// Real-world Milky Way parameters, scaled for the WebGL scene.
//
// Scene scale: 1 world unit = 100 light-years. The galactic plane is the
// XZ plane, +Y points at the north galactic pole (NGP). Azimuth θ is measured
// counter-clockwise when viewed from the NGP, with the Sun at θ = 0 (+X).

export const LY_PER_UNIT = 100;
const ly = (lightYears: number) => lightYears / LY_PER_UNIT;
const DEG = Math.PI / 180;

export const GALAXY = {
	/** Stellar disk radius — disk diameter ≈ 100,000 ly. */
	diskRadius: ly(52_000),
	/** Thin-disk radial scale length ≈ 2.6 kpc ≈ 8,500 ly. */
	thinDiskScaleLength: ly(8_500),
	/** Thin-disk scale height ≈ 300 pc ≈ 1,000 ly. */
	thinDiskScaleHeight: ly(1_000),
	/** Thick-disk scale length ≈ 2 kpc ≈ 6,500 ly. */
	thickDiskScaleLength: ly(6_500),
	/** Thick-disk scale height ≈ 900 pc ≈ 3,000 ly. */
	thickDiskScaleHeight: ly(3_000),
	/** Young (OB) star scale height ≈ 100 pc ≈ 300 ly. */
	youngScaleHeight: ly(300),
	/** Dust scale height ≈ 40 pc ≈ 130 ly — thinner than the stars, so edge-on it slices the bulge. */
	dustScaleHeight: ly(130),

	/** Long-bar half-length ≈ 5 kpc ≈ 16,300 ly. */
	barHalfLength: ly(16_300),
	/** Bar major axis is ~27° from the Sun–Galactic Centre line, near end at positive longitude. */
	barAngle: -27 * DEG,
	/** Boxy/peanut bulge ≈ 10,000 ly across. */
	bulgeRadius: ly(5_000),

	/** Spiral arm pitch angle ≈ 12°. */
	armPitch: 12 * DEG,
	/** Galactocentric radius where the Sagittarius–Carina arm crosses the Sun–GC line (≈ 7 kpc). */
	sagittariusRadiusAtSun: ly(22_800),

	/** Sun: R₀ = 8.178 kpc ≈ 26,673 ly (GRAVITY 2019), z⊙ = 20.8 pc ≈ 68 ly above the plane (Bennett & Bovy 2019). */
	sunRadius: ly(8.178 * 3_261.5638),
	sunHeight: ly(20.8 * 3.261564),

	/** Outer-disk warp: starts ≈ 10 kpc, reaches ≈ 2–3 kpc out of the plane at the disk edge. */
	warpStartRadius: ly(33_000),
	warpAmplitude: 0.0008, // world units of height per unit² beyond the warp start

	/** Stellar halo: ρ ∝ r^-3.5, traced out to ≈ 150,000 ly. */
	haloInnerRadius: ly(2_000),
	haloOuterRadius: ly(150_000),
	haloFlattening: 0.7,
	globularClusterCount: 150,
	/** Globular cluster half-mass radius ≈ 10 pc; we scatter members a little wider. */
	globularClusterRadius: ly(60),

	/** Magellanic Clouds (heliocentric distance, Galactic l/b, approximate radius). */
	lmc: { distance: ly(163_000), l: 280.5 * DEG, b: -32.9 * DEG, radius: ly(7_000) },
	smc: { distance: ly(206_000), l: 302.8 * DEG, b: -44.3 * DEG, radius: ly(3_500) },
} as const;

export const DYNAMICS = {
	/** Flat rotation curve: Θ₀ = 236 ± 7 km/s (Reid et al. 2019). */
	circularVelocity: 236,
	/** Radius over which the rotation curve rises to flat (bulge-dominated core). */
	rotationCoreRadius: ly(1_500),
	/** Bar pattern speed 39 ± 3.5 km/s/kpc (Portail et al. 2017). */
	patternSpeed: 39,
	/** Spiral-arm pattern speed ≈ 28 km/s/kpc (20–32 plausible; poorly constrained). */
	armPatternSpeed: 28,
	/** kpc per world unit, to express angular speeds in km/s/kpc. */
	kpcPerUnit: LY_PER_UNIT / 3_261.56,
	/** Thick-disk asymmetric drift: lags the thin disk by ≈ 15%. */
	thickDiskLag: 0.85,
} as const;

/** Circular speed (km/s) at galactocentric radius r (world units). */
export function circularSpeed(r: number): number {
	return DYNAMICS.circularVelocity * (1 - Math.exp(-r / DYNAMICS.rotationCoreRadius));
}

/** Angular speed at the Sun, used to normalise all other angular speeds. */
const SUN_OMEGA = circularSpeed(GALAXY.sunRadius) / GALAXY.sunRadius;

/** Angular speed at radius r, relative to the Sun's angular speed (Sun = 1). */
export function relativeOmega(r: number): number {
	const safeR = Math.max(r, 0.5);
	return circularSpeed(safeR) / safeR / SUN_OMEGA;
}

/** Bar pattern speed relative to the Sun's angular speed. */
export const PATTERN_OMEGA = DYNAMICS.patternSpeed / SUN_OMEGA_KMS_KPC;
/** Spiral-arm pattern speed relative to the Sun's angular speed. */
export const ARM_PATTERN_OMEGA = DYNAMICS.armPatternSpeed / SUN_OMEGA_KMS_KPC;

/**
 * Spiral arms as logarithmic spirals θ(r) = phase + ln(r / sagittariusRadiusAtSun) / tan(pitch).
 * Phases are spaced by π/2, anchored so the arms cross the Sun–GC line at the
 * observed radii: Norma ≈ 3.6 kpc, Scutum–Centaurus ≈ 5 kpc, Sagittarius ≈ 7 kpc,
 * Perseus ≈ 9.8 kpc, Outer (Norma's continuation) ≈ 13.6 kpc. Perseus and
 * Scutum–Centaurus — the two major arms — start at opposite ends of the bar.
 */
export interface ArmSpec {
	name: string;
	phase: number;
	rStart: number;
	rEnd: number;
	weight: number; // share of young stars
	oldWeight: number; // share of old-disk arm enhancement (major arms only)
	width: number; // Gaussian σ across the arm at the arm start (world units)
	omega: number; // relative angular speed
}

export const ARMS: ArmSpec[] = [
	{ name: 'Scutum–Centaurus', phase: Math.PI, rStart: ly(15_000), rEnd: ly(50_000), weight: 0.27, oldWeight: 0.5, width: ly(1_100), omega: ARM_PATTERN_OMEGA },
	{ name: 'Perseus', phase: 0, rStart: ly(15_000), rEnd: ly(50_000), weight: 0.27, oldWeight: 0.5, width: ly(1_100), omega: ARM_PATTERN_OMEGA },
	{ name: 'Sagittarius–Carina', phase: Math.PI / 2, rStart: ly(11_000), rEnd: ly(42_000), weight: 0.17, oldWeight: 0, width: ly(900), omega: ARM_PATTERN_OMEGA },
	{ name: 'Norma–Outer', phase: -Math.PI / 2, rStart: ly(11_000), rEnd: ly(50_000), weight: 0.17, oldWeight: 0, width: ly(900), omega: ARM_PATTERN_OMEGA },
];

/**
 * The Orion Spur (Local Arm): a short, lower-pitch segment between Sagittarius and
 * Perseus that contains the Sun. It's modelled as co-moving with the Sun rather than
 * as part of the density-wave pattern, so the Sun stays inside it.
 */
export const ORION_SPUR = {
	name: 'Orion Spur',
	rStart: ly(23_500),
	rEnd: ly(29_500),
	pitch: 10 * DEG,
	width: ly(500),
	weight: 0.06,
	omega: 1,
};

/**
 * Global phase offset: puts Sagittarius (relative phase π/2) at θ = 0, the Sun's
 * azimuth, at r = sagittariusRadiusAtSun. With pitch 12° this lands Scutum–Centaurus's
 * inner end at θ ≈ -23°, right at the near end of the bar (-27°).
 */
export const ARM_PHASE_OFFSET = -Math.PI / 2;

/** Main-sequence spectral classes: effective temperature, relative sprite size (∝ visual flux). */
export const SPECTRAL_CLASSES = {
	O: { temp: 35_000, size: 2.6 },
	B: { temp: 18_000, size: 2.0 },
	A: { temp: 9_000, size: 1.5 },
	F: { temp: 6_800, size: 1.2 },
	G: { temp: 5_700, size: 1.0 },
	K: { temp: 4_500, size: 0.85 },
	M: { temp: 3_200, size: 0.7 },
} as const;

export type SpectralClass = keyof typeof SPECTRAL_CLASSES;
export type SpectralMix = Record<SpectralClass, number>;

/** Present-day mass function: share of stars by class in the thin disk. */
export const IMF_MIX: SpectralMix = { O: 0.0000003, B: 0.0013, A: 0.006, F: 0.03, G: 0.076, K: 0.121, M: 0.7657 };
/**
 * Spiral-arm young population, weighted by visibility: O/B stars are rare but
 * outshine thousands of M dwarfs, which is why arms look blue in photographs.
 */
export const YOUNG_MIX: SpectralMix = { O: 0.004, B: 0.06, A: 0.1, F: 0.12, G: 0.14, K: 0.2, M: 0.376 };
/** Old populations (bulge, thick disk, halo): no surviving O/B/A main-sequence stars. */
export const OLD_MIX: SpectralMix = { O: 0, B: 0, A: 0, F: 0.04, G: 0.11, K: 0.42, M: 0.43 };

/** Camera reference distance — the black hole size slider is in px at this distance. */
export const CAMERA_REFERENCE_DISTANCE = ly(105_000);
export const CAMERA_FOV = 50;

/** Heliocentric (distance, galactic longitude l, latitude b) → scene coordinates (galactocentric). */
export function fromSun(distance: number, l: number, b: number): { x: number; y: number; z: number } {
	return {
		x: GALAXY.sunRadius - distance * Math.cos(b) * Math.cos(l),
		y: GALAXY.sunHeight + distance * Math.sin(b),
		z: distance * Math.cos(b) * Math.sin(l),
	};
}
