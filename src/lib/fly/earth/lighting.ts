// src/lib/fly/earth/lighting.ts
// Everything the renderer needs to light the world consistently with the sky, computed from the same scattering model: the colour and
// strength of sunlight reaching the ground, the sky's ambient light, the haze (fog) colour and density, and an auto-exposure that mimics
// eye adaptation (a sunlit white wall at noon and a starlit field at night both land at readable display brightness).

import { SKY, skyRadiance, sunTransmittance } from './atmosphere';

export interface Lighting {
	/** Linear RGB multiplier for the sun light (transmittance) and its intensity (irradiance, arbitrary units shared with the sky). */
	sunColor: [number, number, number];
	sunIntensity: number;
	/** Ambient hemisphere light: linear RGB radiance of the sky and of the bounce from the ground. */
	skyColor: [number, number, number];
	groundColor: [number, number, number];
	/** Display-referred (tone-mapped, linear) fog colour and FogExp2 density (1/m). */
	fogColor: [number, number, number];
	fogDensity: number;
	exposure: number;
	/** 0 (day) … 1 (dark): how visible the stars should be. */
	starVisibility: number;
	sunElevation: number;
}

/** three's ACESFilmic curve (the same fit as its shader), CPU side, for display-referred colours. */
export function toneMapACES(rgb: [number, number, number], exposure: number): [number, number, number] {
	const v = rgb.map((c) => (c * exposure) / 0.6);
	const m = [
		v[0] * 0.59719 + v[1] * 0.35458 + v[2] * 0.04823,
		v[0] * 0.076 + v[1] * 0.90834 + v[2] * 0.01566,
		v[0] * 0.0284 + v[1] * 0.13383 + v[2] * 0.83777,
	].map((x) => { const a = x * (x + 0.0245786) - 0.000090537, b = x * (0.983729 * x + 0.432951) + 0.238081; return a / b; });
	const o = [
		m[0] * 1.60475 - m[1] * 0.53108 - m[2] * 0.07367,
		-m[0] * 0.10208 + m[1] * 1.10813 - m[2] * 0.00605,
		-m[0] * 0.00327 - m[1] * 0.07276 + m[2] * 1.07602,
	];
	return o.map((x) => Math.min(1, Math.max(0, x))) as [number, number, number];
}

const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** `altitude` m above the surface; `sunElevationDeg` Sun above the local horizon. */
export function lightingFor(altitude: number, sunElevationDeg: number): Lighting {
	const e = (sunElevationDeg * Math.PI) / 180;
	const up = [0, 1, 0], sun = [Math.cos(e), Math.sin(e), 0];
	const T = sunTransmittance(altitude, sunElevationDeg);
	const sinE = Math.max(0, Math.sin(e));
	const zenith = skyRadiance(altitude, [0, 1, 0], sun, up, 12, 5).rgb;
	// Sample the sky at 45° and at the horizon, perpendicular to the Sun's azimuth, for an average ambient and the haze colour.
	const mid = skyRadiance(altitude, [0, Math.SQRT1_2, -Math.SQRT1_2], sun, up, 12, 5).rgb;
	const hor = skyRadiance(altitude, [0, 0.04, -1], sun, up, 12, 5).rgb;
	const skyColor = [0, 1, 2].map((c) => 0.45 * zenith[c] + 0.4 * mid[c] + 0.15 * hor[c]) as [number, number, number];
	const bounce = 0.2 * SKY.sunIntensity * sinE / Math.PI;
	const groundColor = [0, 1, 2].map((c) => bounce * T[c]) as [number, number, number];

	// Auto-exposure: aim the average scene luminance at a fixed display level, clamped so night stays dark rather than turning to day.
	const avg = 0.6 * lum(zenith) + 0.15 * (SKY.sunIntensity * sinE * lum(T)) / Math.PI + 0.012;
	const exposure = Math.min(14, Math.max(0.25, 0.5 / avg));

	// Haze: blend of horizon and zenith colours, tone-mapped to display space (three applies fog after tone mapping).
	const haze: [number, number, number] = [0, 1, 2].map((c) => 0.55 * hor[c] + 0.45 * zenith[c]) as [number, number, number];
	const fogColor = toneMapACES(haze, exposure);
	const fogDensity = 2.6e-5 * Math.exp(-Math.max(0, altitude) / 6000);

	return {
		sunColor: T, sunIntensity: SKY.sunIntensity, skyColor, groundColor, fogColor, fogDensity, exposure,
		starVisibility: Math.min(1, Math.max(0, (-sunElevationDeg - 2) / 12)) , sunElevation: sunElevationDeg,
	};
}
