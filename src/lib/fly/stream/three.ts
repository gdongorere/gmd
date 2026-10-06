import * as THREE from 'three';
import { ResourceTracker, geometryBytes, textureBytes } from './resource';

const TEXTURE_SLOTS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap', 'envMap', 'bumpMap'] as const;

function geoBytes(g: THREE.BufferGeometry): number {
	const pos = g.getAttribute('position');
	return pos ? geometryBytes(pos.count, g.index?.count ?? 0) : 0;
}

function texBytes(t: THREE.Texture): number {
	const img = t.image as { width?: number; height?: number } | undefined;
	return img?.width && img?.height ? textureBytes(img.width, img.height) : 0;
}

/**
 * Walk `root` and hand every geometry, material and material texture to the tracker under `owner`.
 * Safe to call repeatedly (the tracker ignores objects it already owns). Shared objects are tracked once.
 */
export function trackObject(tracker: ResourceTracker, root: THREE.Object3D, owner: string): void {
	root.traverse((o) => {
		const m = o as THREE.Mesh;
		if (m.geometry) tracker.track(m.geometry, owner, 'geometry', geoBytes(m.geometry));
		const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
		for (const mat of mats) {
			tracker.track(mat, owner, 'material');
			for (const slot of TEXTURE_SLOTS) {
				const t = (mat as unknown as Record<string, unknown>)[slot];
				if (t instanceof THREE.Texture) tracker.track(t, owner, 'texture', texBytes(t));
			}
		}
	});
}
