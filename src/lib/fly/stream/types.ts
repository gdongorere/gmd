/** Streaming vocabulary shared by the tracker, the budget and (later) the residency manager. See docs/fly/12. */

export type ResourceKind = 'geometry' | 'texture' | 'material' | 'target' | 'bitmap' | 'worker' | 'url' | 'other';

export type Pool = 'gpu' | 'heap' | 'tiles';

export type QualityTier = 'ultra' | 'high' | 'medium' | 'low' | 'minimal';

export type Pressure = 'ok' | 'high' | 'critical';

/** Anything the tracker can own: three.js geometries, textures, materials, render targets, ImageBitmap (close), etc. */
export interface Disposable {
	dispose?: () => void;
	close?: () => void;
	terminate?: () => void;
}
