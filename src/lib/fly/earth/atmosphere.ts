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
