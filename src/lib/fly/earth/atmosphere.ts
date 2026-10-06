// src/lib/fly/earth/atmosphere.ts
// U.S. Standard Atmosphere 1976 (0–86 km geopotential, seven layers) with a smooth exponential extension to 150 km, plus the optical
// constants the sky shader uses. Measured physical model, not an artistic one: sea-level 288.15 K, 101 325 Pa, 1.225 kg/m³.

const G0 = 9.80665, R_AIR = 287.05287, GAMMA = 1.4, R_E = 6356766; // R_E: the 1976 geopotential radius

interface Layer { h: number; T: number; L: number; P: number }

// Base geopotential height (m), base temperature (K), lapse rate (K/m), base pressure (Pa) — built once from the layer definitions.
const defs: [number, number, number][] = [[0, 288.15, -0.0065], [11000, 216.65, 0], [20000, 216.65, 0.001], [32000, 228.65, 0.0028], [47000, 270.65, 0], [51000, 270.65, -0.0028], [71000, 214.65, -0.002]];
const layers: Layer[] = [];
{
	let P = 101325;
	defs.forEach(([h, T, L], i) => {
		if (i > 0) {
			const p = layers[i - 1];
			const dh = h - p.h;
			P = p.L === 0 ? p.P * Math.exp((-G0 * dh) / (R_AIR * p.T)) : p.P * Math.pow((p.T + p.L * dh) / p.T, -G0 / (R_AIR * p.L));
		}
		layers.push({ h, T, L, P });
	});
}
const TOP = 86000;

const geopotential = (z: number) => (R_E * z) / (R_E + z);

export interface AirState { temperature: number; pressure: number; density: number; speedOfSound: number }

/** Atmosphere at geometric altitude z (m above mean sea level). Negative altitudes (Dead Sea, Death Valley) use the first layer. */
export function airAt(z: number): AirState {
	const zc = Math.min(Math.max(z, -5000), 150000);
	const hz = geopotential(zc);
	let T: number, P: number;
	if (hz <= TOP) {
		let i = layers.length - 1;
		while (i > 0 && hz < layers[i].h) i--;
		const l = layers[i], dh = hz - l.h;
		T = l.T + l.L * dh;
		P = l.L === 0 ? l.P * Math.exp((-G0 * dh) / (R_AIR * l.T)) : l.P * Math.pow(T / l.T, -G0 / (R_AIR * l.L));
	} else {
		// Above 86 km: continue with the 86 km temperature and a scale height of RT/g (a documented simplification, density is negligible for flight).
		const top = layers[layers.length - 1];
		const T86 = top.T + top.L * (TOP - top.h);
		const P86 = top.P * Math.pow(T86 / top.T, -G0 / (R_AIR * top.L));
		T = T86;
		P = P86 * Math.exp((-G0 * (hz - TOP)) / (R_AIR * T86));
	}
	// Above 150 km the thermosphere thins with a ~45 km scale height (400 km ≈ 8e-12 kg/m³, the right order for the ISS altitude).
	const fade = z > 150000 ? Math.exp(-(z - 150000) / 45000) : 1;
	P *= fade;
	return { temperature: T, pressure: P, density: P / (R_AIR * T), speedOfSound: Math.sqrt(GAMMA * R_AIR * T) };
}

export const densityAt = (z: number) => airAt(z).density;

/** Dynamic pressure q = ½ρv² (Pa). */
export const dynamicPressure = (z: number, v: number) => 0.5 * densityAt(z) * v * v;

export const mach = (z: number, v: number) => v / airAt(z).speedOfSound;

/** Optical constants for single-scattering sky (Rayleigh and Mie), per metre at sea level, at the RGB wavelengths 680/550/440 nm. */
export const SKY = {
	rayleigh: [5.802e-6, 13.558e-6, 33.1e-6] as const,
	mie: 3.996e-6,
	mieAnisotropy: 0.76,
	/** Scale heights (m). */
	hRayleigh: 8000,
	hMie: 1200,
	/** Top of the scattering shell above the surface (m). */
	top: 100_000,
	/** Solar illuminance scale used by the shader (arbitrary exposure unit; tone-mapped). */
	sunIntensity: 22,
};

// ---------------------------------------------------------------------------------------------------------------------------------
// Single-scattering sky (Rayleigh + Mie), the CPU twin of the sky shader. It feeds the fog colour, the ambient light and the colour of the
// sunlight reaching the ground, so the lighting of the terrain matches the sky overhead. Spherical planet (R = 6 371 km), exponential
// density profiles, no multiple scattering (the shadowed sky is therefore a little too dark, a documented simplification), no ozone.

const R_PLANET = 6371000;
const R_ATMO = R_PLANET + 80000;

export interface Radiance { rgb: [number, number, number]; transmittance: [number, number, number]; hitsPlanet: boolean }

function raySphere(o: number[], d: number[], r: number): [number, number] | null {
	const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
	const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - r * r;
	const disc = b * b - c;
	if (disc < 0) return null;
	const s = Math.sqrt(disc);
	return [-b - s, -b + s];
}

/**
 * Radiance seen along `dir` from a point at `altitude` above the surface, with `up` the local vertical and `sun` the unit direction to the Sun
 * (all in the same frame). Units are arbitrary but consistent with the shader (tone-mapped on screen).
 */
export function skyRadiance(altitude: number, dir: number[], sun: number[], up: number[], steps = 16, lightSteps = 6): Radiance {
	const pos = [up[0] * (R_PLANET + Math.max(altitude, 1)), up[1] * (R_PLANET + Math.max(altitude, 1)), up[2] * (R_PLANET + Math.max(altitude, 1))];
	const atm = raySphere(pos, dir, R_ATMO);
	if (!atm || atm[1] < 0) return { rgb: [0, 0, 0], transmittance: [1, 1, 1], hitsPlanet: false };
	const t0 = Math.max(atm[0], 0);
	let t1 = atm[1];
	const pl = raySphere(pos, dir, R_PLANET);
	const hits = !!pl && pl[0] > 0;
	if (hits) t1 = Math.min(t1, pl![0]);
	const ds = (t1 - t0) / steps;
	const bR = SKY.rayleigh, bM = SKY.mie * 1.11;
	let optR = 0, optM = 0;
	const sumR = [0, 0, 0], sumM = [0, 0, 0];
	for (let i = 0; i < steps; i++) {
		const t = t0 + (i + 0.5) * ds;
		const p = [pos[0] + dir[0] * t, pos[1] + dir[1] * t, pos[2] + dir[2] * t];
		const h = Math.hypot(p[0], p[1], p[2]) - R_PLANET;
		const dR = Math.exp(-h / SKY.hRayleigh) * ds, dM = Math.exp(-h / SKY.hMie) * ds;
		optR += dR; optM += dM;
		// light ray to the top of the atmosphere; skip if the planet blocks the Sun from this point
		const pe = raySphere(p, sun, R_PLANET);
		if (pe && pe[0] > 0) continue;
		const la = raySphere(p, sun, R_ATMO);
		if (!la) continue;
		const lds = la[1] / lightSteps;
		let lR = 0, lM = 0;
		for (let j = 0; j < lightSteps; j++) {
			const lt = (j + 0.5) * lds;
			const lh = Math.hypot(p[0] + sun[0] * lt, p[1] + sun[1] * lt, p[2] + sun[2] * lt) - R_PLANET;
			lR += Math.exp(-lh / SKY.hRayleigh) * lds; lM += Math.exp(-lh / SKY.hMie) * lds;
		}
		for (let c = 0; c < 3; c++) {
			const att = Math.exp(-(bR[c] * (optR + lR) + bM * (optM + lM)));
			sumR[c] += dR * att; sumM[c] += dM * att;
		}
	}
	const mu = dir[0] * sun[0] + dir[1] * sun[1] + dir[2] * sun[2];
	const phaseR = (3 / (16 * Math.PI)) * (1 + mu * mu);
	const g = SKY.mieAnisotropy;
	const phaseM = ((3 / (8 * Math.PI)) * ((1 - g * g) * (1 + mu * mu))) / ((2 + g * g) * Math.pow(1 + g * g - 2 * g * mu, 1.5));
	const rgb: [number, number, number] = [0, 1, 2].map((c) => SKY.sunIntensity * (sumR[c] * bR[c] * phaseR + sumM[c] * SKY.mie * phaseM)) as [number, number, number];
	const transmittance: [number, number, number] = [0, 1, 2].map((c) => Math.exp(-(bR[c] * optR + bM * optM))) as [number, number, number];
	return { rgb, transmittance, hitsPlanet: hits };
}

/** Fraction of the Sun's light reaching a point at `altitude` when the Sun is at `elevationDeg` above the horizon, per RGB channel. */
export function sunTransmittance(altitude: number, elevationDeg: number): [number, number, number] {
	const e = (elevationDeg * Math.PI) / 180;
	const up = [0, 1, 0], sun = [Math.cos(e), Math.sin(e), 0];
	const pos = [0, R_PLANET + Math.max(altitude, 1), 0];
	const pe = raySphere(pos, sun, R_PLANET);
	if (pe && pe[0] > 0) return [0, 0, 0];
	const la = raySphere(pos, sun, R_ATMO);
	if (!la) return [1, 1, 1];
	const N = 24, ds = la[1] / N;
	let oR = 0, oM = 0;
	for (let i = 0; i < N; i++) { const t = (i + 0.5) * ds; const h = Math.hypot(pos[0] + sun[0] * t, pos[1] + sun[1] * t, pos[2] + sun[2] * t) - R_PLANET; oR += Math.exp(-h / SKY.hRayleigh) * ds; oM += Math.exp(-h / SKY.hMie) * ds; }
	void up;
	return [0, 1, 2].map((c) => Math.exp(-(SKY.rayleigh[c] * oR + SKY.mie * 1.11 * oM))) as [number, number, number];
}
