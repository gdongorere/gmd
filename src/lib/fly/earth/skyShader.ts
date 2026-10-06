// src/lib/fly/earth/skyShader.ts
// The sky as a shader on a camera-centred sphere: single-scattering Rayleigh + Mie through an exponential atmosphere (the GLSL twin of
// atmosphere.ts `skyRadiance`), the Sun's disc, procedural stars that turn with the sidereal time, and a polar/ocean planet surface for the
// few places terrain tiles do not cover (beyond 85° latitude). Terrain drawn afterwards covers it. Works from the ground to orbit.

import * as THREE from 'three';
import { SKY } from './atmosphere';

const vertex = /* glsl */ `
varying vec3 vDir;
void main() {
	vDir = position;
	vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	gl_Position = p.xyww; // at the far plane
}`;

const fragment = /* glsl */ `
precision highp float;
uniform vec3 uCamUp;
uniform float uAlt;
uniform vec3 uSun;
uniform mat3 uToInertial;
uniform mat3 uToEcef;
uniform float uStars;
uniform float uSunI;
varying vec3 vDir;

const float Rp = 6371000.0;
const float Ra = 6451000.0;
const vec3 betaR = vec3(${SKY.rayleigh[0]}, ${SKY.rayleigh[1]}, ${SKY.rayleigh[2]});
const float betaM = ${SKY.mie};
const float HR = ${SKY.hRayleigh}.0;
const float HM = ${SKY.hMie}.0;
const float G = ${SKY.mieAnisotropy};

vec2 raySphere(vec3 o, vec3 d, float r) {
	float b = dot(o, d);
	float c = dot(o, o) - r * r;
	float disc = b * b - c;
	if (disc < 0.0) return vec2(1e20, -1e20);
	float s = sqrt(disc);
	return vec2(-b - s, -b + s);
}

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }

vec3 stars(vec3 d) {
	// Static in the inertial frame: a hashed grid on the sphere with a gaussian point and a colour from the hash.
	vec3 p = d * 220.0;
	vec3 id = floor(p);
	vec3 f = fract(p) - 0.5;
	float h = hash(id);
	float h2 = hash(id + 7.7);
	vec3 off = (vec3(hash(id + 1.3), hash(id + 2.9), hash(id + 4.1)) - 0.5) * 0.7;
	float dist = length(f - off);
	float bright = step(0.965, h) * (0.4 + 1.6 * h2 * h2);
	float star = bright * exp(-dist * dist * 900.0);
	vec3 tint = mix(vec3(1.0, 0.8, 0.65), vec3(0.7, 0.8, 1.0), hash(id + 3.3));
	return star * tint;
}

void main() {
	vec3 dir = normalize(vDir);
	vec3 pos = uCamUp * (Rp + max(uAlt, 1.0));
	vec2 atm = raySphere(pos, dir, Ra);
	vec3 col = vec3(0.0);
	vec3 trans = vec3(1.0);
	bool hits = false;
	if (atm.y > 0.0) {
		float t0 = max(atm.x, 0.0);
		float t1 = atm.y;
		vec2 pl = raySphere(pos, dir, Rp);
		hits = pl.x > 0.0 && pl.x < pl.y;
		if (hits) t1 = min(t1, pl.x);
		const int N = 16;
		const int NL = 6;
		float ds = (t1 - t0) / float(N);
		float optR = 0.0, optM = 0.0;
		vec3 sumR = vec3(0.0), sumM = vec3(0.0);
		for (int i = 0; i < N; i++) {
			float t = t0 + (float(i) + 0.5) * ds;
			vec3 p = pos + dir * t;
			float h = length(p) - Rp;
			float dR = exp(-h / HR) * ds, dM = exp(-h / HM) * ds;
			optR += dR; optM += dM;
			vec2 pe = raySphere(p, uSun, Rp);
			if (pe.x > 0.0 && pe.x < pe.y) continue;
			vec2 la = raySphere(p, uSun, Ra);
			float lds = la.y / float(NL);
			float lR = 0.0, lM = 0.0;
			for (int j = 0; j < NL; j++) {
				float lt = (float(j) + 0.5) * lds;
				float lh = length(p + uSun * lt) - Rp;
				lR += exp(-lh / HR) * lds; lM += exp(-lh / HM) * lds;
			}
			vec3 att = exp(-(betaR * (optR + lR) + betaM * 1.11 * (optM + lM)));
			sumR += dR * att; sumM += dM * att;
		}
		float mu = dot(dir, uSun);
		float phaseR = 3.0 / (16.0 * 3.14159265) * (1.0 + mu * mu);
		float phaseM = 3.0 / (8.0 * 3.14159265) * ((1.0 - G * G) * (1.0 + mu * mu)) / ((2.0 + G * G) * pow(1.0 + G * G - 2.0 * G * mu, 1.5));
		col = uSunI * (sumR * betaR * phaseR + sumM * betaM * phaseM);
		trans = exp(-(betaR * optR + betaM * 1.11 * optM));
		if (hits) {
			// Bare planet (no terrain tile here): ocean blue, white ice beyond ~80° latitude.
			vec3 hp = pos + dir * pl.x;
			vec3 n = normalize(hp);
			vec3 e = uToEcef * n;
			float lat = abs(asin(clamp(e.z, -1.0, 1.0)));
			vec3 albedo = mix(vec3(0.02, 0.07, 0.14), vec3(0.8, 0.85, 0.9), smoothstep(1.38, 1.48, lat));
			float cosS = max(dot(n, uSun), 0.0);
			col += albedo * uSunI * cosS * trans / 3.14159265 * 0.9;
		}
	} else if (!hits) {
		// outside the atmosphere looking past the planet: black
	}
	// Sun disc and stars where the sky is open.
	if (!hits) {
		float mu = dot(dir, uSun);
		float disc = smoothstep(0.999980, 0.999992, mu); // the Sun's angular radius is 0.00465 rad (cos = 0.9999892)
		col += disc * uSunI * 40.0 * trans;
		vec3 st = stars(normalize(uToInertial * dir));
		float vis = max(uStars, clamp((uAlt - 60000.0) / 60000.0, 0.0, 1.0)); // dark sky, or above the thick air
		col += st * vis * trans * 0.9;
	}
	gl_FragColor = vec4(col, 1.0);
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`;

export interface SkyUniforms {
	uCamUp: { value: THREE.Vector3 };
	uAlt: { value: number };
	uSun: { value: THREE.Vector3 };
	uToInertial: { value: THREE.Matrix3 };
	uToEcef: { value: THREE.Matrix3 };
	uStars: { value: number };
	uSunI: { value: number };
}

export function createSky(): { mesh: THREE.Mesh; uniforms: SkyUniforms; dispose: () => void } {
	const uniforms: SkyUniforms = {
		uCamUp: { value: new THREE.Vector3(0, 1, 0) }, uAlt: { value: 10 }, uSun: { value: new THREE.Vector3(1, 1, 0).normalize() },
		uToInertial: { value: new THREE.Matrix3() }, uToEcef: { value: new THREE.Matrix3() }, uStars: { value: 0 }, uSunI: { value: SKY.sunIntensity },
	};
	const geo = new THREE.SphereGeometry(10, 48, 24);
	const mat = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: uniforms as unknown as Record<string, THREE.IUniform>, side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: true, fog: false });
	const mesh = new THREE.Mesh(geo, mat);
	mesh.frustumCulled = false; mesh.renderOrder = -1000;
	return { mesh, uniforms, dispose: () => { geo.dispose(); mat.dispose(); } };
}
