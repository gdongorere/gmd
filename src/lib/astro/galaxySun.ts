// src/lib/astro/galaxySun.ts
// Where the Sun is in the Milky Way, with the published value and its uncertainty for each number.
//
// NOTE FOR REVIEWERS: these constants were entered from memory of the cited papers and have not
// been cross-checked against the originals in this environment. Each carries its source so it can
// be verified (and `CONSTANT_SOURCES` is shown in the UI's "verify" card).

export const LY_PER_KPC = 3261.5638;
export const LY_PER_PC = 3.261564;
/** 1 kpc / (km/s) expressed in Myr. */
export const MYR_PER_KPC_PER_KMS = 977.792;

export interface SourcedValue {
	value: number;
	plus: number;
	minus: number;
	unit: string;
	source: string;
}

export const SUN_GALAXY = {
	/** Distance to Sgr A* (GRAVITY Collaboration 2019, A&A 625, L10): 8.178 ± 0.013 (stat) ± 0.022 (sys) kpc. */
	R0: { value: 8.178, plus: 0.026, minus: 0.026, unit: 'kpc', source: 'GRAVITY Collaboration 2019, A&A 625, L10' },
	/** Height above the plane (Bennett & Bovy 2019, MNRAS 482, 1417): 20.8 ± 0.3 pc. */
	z0: { value: 20.8, plus: 0.3, minus: 0.3, unit: 'pc', source: 'Bennett & Bovy 2019, MNRAS 482, 1417' },
	/** Proper motion of Sgr A* in galactic longitude, Reid & Brunthaler (2004): 6.379 ± 0.026 mas/yr.
	 *  (Their 2020 re-analysis, ApJ 892, 39, gives a slightly larger, tighter value that is not used here.) */
	omegaMasPerYr: { value: 6.379, plus: 0.026, minus: 0.026, unit: 'mas/yr', source: 'Reid & Brunthaler 2004, ApJ 616, 872' },
	/** Circular speed at the Sun (Reid et al. 2019 maser parallaxes): 236 ± 7 km/s. */
	theta0: { value: 236, plus: 7, minus: 7, unit: 'km/s', source: 'Reid et al. 2019, ApJ 885, 131' },
	/** Solar peculiar motion w.r.t. the local standard of rest (Schönrich, Binney & Dehnen 2010). */
	peculiar: { U: 11.1, V: 12.24, W: 7.25, source: 'Schönrich, Binney & Dehnen 2010, MNRAS 403, 1829' },
	/** Bar pattern speed (Portail et al. 2017): 39.0 ± 3.5 km/s/kpc. */
	barPattern: { value: 39, plus: 3.5, minus: 3.5, unit: 'km/s/kpc', source: 'Portail et al. 2017, MNRAS 465, 1621' },
	/** Spiral pattern speed: poorly constrained, ~20–30 km/s/kpc; 28 is a mid value (Gerhard 2011; Dias et al. 2019). */
	armPattern: { value: 28, plus: 4, minus: 8, unit: 'km/s/kpc', source: 'Gerhard 2011; Dias et al. 2019 (range 20–32)' },
	/** Bar angle to the Sun–GC line (Wegg, Gerhard & Portail 2015): ≈ 27 ± 2°. */
	barAngle: { value: 27, plus: 2, minus: 2, unit: '°', source: 'Wegg, Gerhard & Portail 2015, MNRAS 450, 4050' },
	/** Vertical oscillation period through the plane ≈ 80–90 Myr (harmonic approximation). */
	verticalPeriodMyr: { value: 84, plus: 8, minus: 8, unit: 'Myr', source: 'Binney & Tremaine 2008; Bahcall & Bahcall 1985' },
} as const;

/** True only once every constant above has been checked against its original paper. */
export const CONSTANTS_VERIFIED = false;
export const CONSTANTS_PROVENANCE_NOTE =
	'Values are recalled from the cited papers and were not re-checked against the originals; treat them as unverified until confirmed.';

export const CONSTANT_SOURCES = Object.entries(SUN_GALAXY).map(([key, v]) => ({ key, ...v }));

const KMS_PER_MASYR_PER_KPC = 4.740470446;

/** Sun's angular speed about the Galactic centre (km/s/kpc), from Sgr A*'s reflex proper motion. */
export const SUN_OMEGA_KMS_KPC = SUN_GALAXY.omegaMasPerYr.value * KMS_PER_MASYR_PER_KPC;
/** Total tangential speed of the Sun about Sgr A* (km/s). ≈ 247. */
export const SUN_TOTAL_SPEED = SUN_OMEGA_KMS_KPC * SUN_GALAXY.R0.value;
/** One lap of the Galaxy, Myr (≈ 203 Myr; 200–230 depending on R0, Θ0 — the old "230" is a rounded legacy figure). */
export const SUN_ORBIT_MYR = (2 * Math.PI * MYR_PER_KPC_PER_KMS) / SUN_OMEGA_KMS_KPC;

export const sunDistanceLy = () => SUN_GALAXY.R0.value * LY_PER_KPC;
export const sunDistanceUncertaintyLy = () => SUN_GALAXY.R0.plus * LY_PER_KPC;
export const sunHeightLy = () => SUN_GALAXY.z0.value * LY_PER_PC;

/**
 * Galactic longitude advance (degrees) of the Sun's orbit over `years` of simulated time,
 * measured against the (slower) spiral pattern: how far the arms have drifted relative to the Sun.
 */
export function armDriftDegrees(years: number): number {
	const rel = SUN_OMEGA_KMS_KPC - SUN_GALAXY.armPattern.value; // km/s/kpc
	return ((rel / MYR_PER_KPC_PER_KMS) * (years / 1e6)) * (180 / Math.PI);
}

/** Height above the plane (pc) at `yearsFromNow`, harmonic oscillator through today's z0 and W. */
export function sunHeightPc(yearsFromNow: number): number {
	const w = 2 * Math.PI / SUN_GALAXY.verticalPeriodMyr.value; // rad/Myr
	const w0 = SUN_GALAXY.peculiar.W * 1.0227; // km/s → pc/Myr
	const z0 = SUN_GALAXY.z0.value;
	const A = Math.hypot(z0, w0 / w);
	const phase = Math.atan2(z0 * w, w0);
	return A * Math.sin(phase + w * (yearsFromNow / 1e6));
}

/** One-line statement of how well the Sun's place on the map is known. */
export function sunPositionStatement(): string {
	const r = sunDistanceLy();
	return `${Math.round(r).toLocaleString('en-US')} ± ${Math.round(sunDistanceUncertaintyLy()).toLocaleString('en-US')} ly from Sgr A* (GRAVITY 2019), ${sunHeightLy().toFixed(0)} ± ${(SUN_GALAXY.z0.plus * LY_PER_PC).toFixed(1)} ly north of the plane.`;
}
