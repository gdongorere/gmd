// src/lib/galaxy/shaders.ts
// All motion (differential rotation, twinkle, size attenuation) happens here on
// the GPU, so the CPU never rewrites a vertex buffer after upload.

export const POINT_VERTEX = /* glsl */ `
uniform float uTime;        // Sun's orbital phase (radians); the scene co-rotates with the Sun
uniform float uClock;       // wall-clock seconds, for twinkle
uniform float uPixelScale;  // device px per world unit at distance 1
uniform float uSizeMul;
uniform float uMinPx;
uniform float uMaxPx;
uniform float uIntensity;
uniform float uTwinkle;
uniform vec2 uNearFade;     // fade out sprites this close to the camera

// \`position\` (declared by three.js) carries cylindrical coords: radius, initial azimuth, height.
attribute vec3 aColor;      // normalised RGB
attribute vec3 aMeta;       // world size, angular speed relative to the Sun, twinkle phase

varying vec3 vColor;

void main() {
	// Stars orbit clockwise seen from the north galactic pole (θ decreasing).
	float theta = position.y - (aMeta.y - 1.0) * uTime;
	vec3 p = vec3(position.x * cos(theta), position.z, -position.x * sin(theta));
	vec4 mv = modelViewMatrix * vec4(p, 1.0);
	float dist = -mv.z;

	float px = aMeta.x * uSizeMul * uPixelScale / max(dist, 0.001);
	float a = uIntensity;
	// Sub-pixel sprites: hold the size and dim instead, conserving flux and avoiding shimmer.
	if (px < uMinPx) {
		a *= (px * px) / (uMinPx * uMinPx);
		px = uMinPx;
	}
	px = min(px, uMaxPx);
	a *= smoothstep(uNearFade.x, uNearFade.y, dist);
	a *= 1.0 + uTwinkle * sin(uClock * (0.7 + aMeta.z * 2.3) + aMeta.z * 40.0);

	vColor = aColor * a;
	gl_PointSize = px;
	gl_Position = projectionMatrix * mv;

	// Cull invisible or behind-camera points before they cost any fill rate.
	if (a < 0.002 || dist <= 0.0) {
		gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
		gl_PointSize = 0.0;
	}
}
`;

/** PROFILE 0 = star (tight core + faint halo), 1 = soft nebula, 2 = dust absorber. */
export const POINT_FRAGMENT = /* glsl */ `
varying vec3 vColor;

void main() {
	vec2 c = gl_PointCoord * 2.0 - 1.0;
	float d2 = dot(c, c);
	if (d2 > 1.0) discard;
#if PROFILE == 0
	float f = exp(-d2 * 9.0) + 0.08 * (1.0 - d2);
#elif PROFILE == 1
	float k = 1.0 - d2;
	float f = k * k * k;
#else
	float f = 0.0;
#endif
#if PROFILE == 2
	// Dust: alpha-blend towards a dark, reddened absorber (blue light is lost first).
	float k = 1.0 - d2;
	gl_FragColor = vec4(0.035, 0.022, 0.014, min(0.6, vColor.b * k * k * k));
#else
	gl_FragColor = vec4(vColor * f, 1.0);
#endif
}
`;

/**
 * Unresolved starlight as instanced quads. Disk/arm glow lies flat in the galactic
 * plane (so it thins to a line edge-on, like the real disk); bulge glow faces the camera.
 */
export const GLOW_VERTEX = /* glsl */ `
uniform float uTime;
uniform float uIntensity;
uniform float uSizeMul;
uniform vec2 uNearFade;

attribute vec3 iCyl;    // radius, initial azimuth, height
attribute vec3 iColor;  // normalised RGB
attribute vec3 iMeta;   // world size, angular speed relative to the Sun, billboard flag

varying vec3 vColor;
varying vec2 vUv;

void main() {
	float theta = iCyl.y - (iMeta.y - 1.0) * uTime;
	vec3 centre = vec3(iCyl.x * cos(theta), iCyl.z, -iCyl.x * sin(theta));
	float size = iMeta.x * uSizeMul;
	vec4 mvCentre = modelViewMatrix * vec4(centre, 1.0);
	vec4 mv;
	if (iMeta.z > 0.5) {
		mv = mvCentre;
		mv.xy += position.xy * size;
	} else {
		mv = modelViewMatrix * vec4(centre + vec3(position.x * size, 0.0, position.y * size), 1.0);
	}
	vUv = position.xy;
	vColor = iColor * uIntensity * smoothstep(uNearFade.x, uNearFade.y, -mvCentre.z);
	gl_Position = projectionMatrix * mv;
}
`;

export const GLOW_FRAGMENT = /* glsl */ `
varying vec3 vColor;
varying vec2 vUv;

void main() {
	float d2 = dot(vUv, vUv);
	if (d2 > 1.0) discard;
	float k = 1.0 - d2;
	gl_FragColor = vec4(vColor * k * k, 1.0);
}
`;

export const BLACK_HOLE_VERTEX = /* glsl */ `
uniform float uRadius;
uniform float uRefDistance;
varying vec2 vUv;

void main() {
	vUv = position.xy;
	// Camera-facing billboard at the Galactic Centre. Up close it grows with the
	// square root of proximity rather than linearly, so it never swallows the bulge.
	vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
	float closeness = sqrt(clamp(-mv.z / uRefDistance, 0.05, 1.0));
	mv.xy += position.xy * uRadius * closeness;
	gl_Position = projectionMatrix * mv;
}
`;

/**
 * Sgr A*: event-horizon shadow, photon ring and a Doppler-beamed accretion disk.
 * Output is premultiplied: rgb is added light, alpha blacks out what's behind the horizon.
 */
export const BLACK_HOLE_FRAGMENT = /* glsl */ `
uniform float uClock;
uniform float uSpin;
uniform float uDisk;
uniform float uFade;
uniform vec3 uInner;
uniform vec3 uMid;
uniform vec3 uOuter;
varying vec2 vUv;

void main() {
	float r = length(vUv) * 3.0; // quad half-size = 3 shadow radii
	if (r > 3.0) discard;
	float ang = atan(vUv.y, vUv.x);

	float swirl = ang + uClock * uSpin * 1.6 - 2.4 * log(max(r, 0.01));
	float streaks = 0.65 + 0.35 * sin(swirl * 5.0) * sin(swirl * 3.0 + 1.7);
	float disk = smoothstep(1.03, 1.25, r) * exp(-(r - 1.25) * 1.5) * streaks;
	float doppler = 1.0 + 0.6 * cos(ang - 0.6);
	vec3 col = mix(uInner, uMid, smoothstep(1.2, 2.0, r));
	col = mix(col, uOuter, smoothstep(1.9, 2.9, r));
	vec3 light = col * disk * doppler * uDisk;

	float ring = exp(-pow((r - 1.04) / 0.035, 2.0));
	light += vec3(1.0, 0.93, 0.82) * ring * 1.3;
	light *= smoothstep(3.0, 2.3, r);

	float horizon = 1.0 - smoothstep(0.96, 1.0, r);
	gl_FragColor = vec4(light * uFade, horizon * uFade);
}
`;
