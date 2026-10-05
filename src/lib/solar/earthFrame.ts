// src/lib/solar/earthFrame.ts
// Earth's orientation for the 3D scene, in a three.js frame whose axes are (x, y, z) = (ecliptic x, ecliptic z, −ecliptic y)
// so ecliptic north is "up". The globe is `group.rotation.x = −ε` (axial tilt) around `mesh.rotation.y = GMST`.

import { obliquityDegrees } from '../astro/earth';
import { gmstDegrees } from '../astro/time';

const D2R = Math.PI / 180;

export interface EarthOrientation { gmstRad: number; tiltRad: number }

export function earthOrientation(jdUt: number): EarthOrientation {
	return { gmstRad: gmstDegrees(jdUt) * D2R, tiltRad: -obliquityDegrees(jdUt) * D2R };
}

/** Scene-frame vector from ecliptic coordinates. */
export const eclToScene = (x: number, y: number, z: number): [number, number, number] => [x, z, -y];

/**
 * Latitude/longitude (degrees, east positive) of the point on Earth facing a direction given in ecliptic coordinates.
 * With the Sun's direction this is the sub-solar point, so it must match `subsolarPoint` — a check on the 3D orientation maths.
 */
export function surfacePointFacing(dirEcl: [number, number, number], jdUt: number): { lat: number; lon: number } {
	const eps = obliquityDegrees(jdUt) * D2R;
	const [x, y, z] = dirEcl;
	const xe = x, ye = y * Math.cos(eps) - z * Math.sin(eps), ze = y * Math.sin(eps) + z * Math.cos(eps);
	const n = Math.hypot(xe, ye, ze) || 1;
	const lat = Math.asin(ze / n) / D2R;
	let lon = (Math.atan2(ye, xe) - gmstDegrees(jdUt) * D2R) / D2R;
	lon = ((lon + 540) % 360) - 180;
	return { lat, lon };
}

/** The same point found by pushing the direction through the scene's actual rotation chain (group tilt ∘ mesh spin), inverted. */
export function surfacePointFromSceneChain(dirEcl: [number, number, number], jdUt: number): { lat: number; lon: number } {
	const { gmstRad, tiltRad } = earthOrientation(jdUt);
	let [x, y, z] = eclToScene(...dirEcl);
	// undo group.rotation.x = tilt
	{ const c = Math.cos(-tiltRad), s = Math.sin(-tiltRad); const y2 = y * c - z * s, z2 = y * s + z * c; y = y2; z = z2; }
	// undo mesh.rotation.y = gmst
	{ const c = Math.cos(-gmstRad), s = Math.sin(-gmstRad); const x2 = x * c + z * s, z2 = -x * s + z * c; x = x2; z = z2; }
	// mesh-local: y north, lon 0 on +x, east toward −z
	const lat = Math.atan2(y, Math.hypot(x, z)) / D2R;
	const lon = Math.atan2(-z, x) / D2R;
	return { lat, lon };
}
