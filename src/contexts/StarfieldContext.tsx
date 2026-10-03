// src/contexts/StarfieldContext.tsx
'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { RenderMode, Tier } from '@/lib/galaxy/tiers';

export type QualitySetting = 'auto' | Tier;
export type PresetName = 'cinematic' | 'scientific' | 'calm' | 'battery' | 'custom';

export interface GalaxyLayers {
	/** Unresolved starlight haze. */
	glow: boolean;
	/** Dark dust lanes along the arms and bar. */
	dust: boolean;
	/** Pink HII star-forming regions. */
	nebulae: boolean;
	/** Stellar halo, globular clusters and Magellanic Clouds. */
	halo: boolean;
}

export interface BlackHoleConfig {
	isEnabled: boolean;
	/** Shadow radius in CSS px at the default (face-on) camera distance. */
	size: number;
	accretionDisk: boolean;
	/** Accretion-disk swirl speed. */
	spin: number;
	/** Inner → outer accretion-disk colours. */
	colorPalette: [string, string, string];
}

export interface StarfieldConfig {
	preset: PresetName;
	/** 'auto' lets the device tiering + frame-time governor decide. */
	quality: QualitySetting;
	/** Fraction of the tier's stars to draw (0.1–1). */
	starDensity: number;
	/** Star sprite size multiplier. */
	starSize: number;
	/** Overall star brightness. */
	brightness: number;
	/** Unresolved-glow strength. */
	glowIntensity: number;
	twinkle: boolean;
	layers: GalaxyLayers;
	/** Galactic rotation on/off. */
	rotation: boolean;
	/** Real time for one solar orbit (≈ 230 Myr) on screen, in minutes. */
	orbitMinutes: number;
	/** Fly the camera between each section's view as the page scrolls. */
	scrollCamera: boolean;
	/** Ease the galaxy back while reading long content. */
	dimWhenReading: boolean;
	/** Roll budget in degrees for the longest journey (views are designed for 360). */
	scrollRoll: number;
	/** Pointer/tilt parallax strength. */
	parallax: number;
	/** Keep motion even when the operating system asks for reduced motion. */
	overrideReducedMotion: boolean;
	showSunMarker: boolean;
	/** Feature labels in Explore mode. */
	exploreLabels: boolean;
	/** Dev overlay: tier, fps, star count, draw calls. */
	showStats: boolean;
	blackHole: BlackHoleConfig;
}

export const DEFAULT_CONFIG: StarfieldConfig = {
	preset: 'cinematic',
	quality: 'auto',
	starDensity: 1,
	starSize: 1,
	brightness: 1,
	glowIntensity: 1,
	twinkle: true,
	layers: { glow: true, dust: true, nebulae: true, halo: true },
	rotation: true,
	orbitMinutes: 4,
	scrollCamera: true,
	dimWhenReading: true,
	scrollRoll: 360,
	parallax: 1,
	overrideReducedMotion: false,
	showSunMarker: false,
	exploreLabels: true,
	showStats: false,
	blackHole: {
		isEnabled: true,
		size: 26,
		accretionDisk: true,
		spin: 1,
		colorPalette: ['#FFD9A0', '#FF6B00', '#7209B7'],
	},
};

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/** Settings a preset fully controls; everything else (black hole, overlay…) is left alone. */
const GOVERNED_KEYS = [
	'quality', 'starDensity', 'brightness', 'glowIntensity', 'twinkle', 'layers', 'rotation', 'orbitMinutes',
	'scrollCamera', 'dimWhenReading', 'scrollRoll', 'parallax', 'showSunMarker',
] as const satisfies readonly (keyof StarfieldConfig)[];

type PresetValues = Partial<Pick<StarfieldConfig, (typeof GOVERNED_KEYS)[number]>>;

export interface PresetInfo {
	label: string;
	description: string;
	values: PresetValues;
}

export const PRESETS: Record<Exclude<PresetName, 'custom'>, PresetInfo> = {
	cinematic: {
		label: 'Cinematic',
		description: 'Full roll, twinkle and gentle parallax. The default showpiece.',
		values: { brightness: 1.1, glowIntensity: 1.1, parallax: 1.2 },
	},
	scientific: {
		label: 'Scientific',
		description: 'No twinkle or roll, slower rotation, the Sun marked. Easier to study.',
		values: { twinkle: false, scrollRoll: 0, parallax: 0.4, orbitMinutes: 10, showSunMarker: true, dimWhenReading: false },
	},
	calm: {
		label: 'Calm',
		description: 'Minimal motion: no roll, very slow rotation, soft parallax.',
		values: { twinkle: false, scrollRoll: 0, parallax: 0.25, orbitMinutes: 15, brightness: 0.9 },
	},
	battery: {
		label: 'Battery saver',
		description: 'Low quality tier, fewer layers, no parallax or twinkle. Easy on weak devices.',
		values: {
			quality: 'low', starDensity: 0.6, twinkle: false, parallax: 0, scrollRoll: 0, orbitMinutes: 20, glowIntensity: 0.8,
			layers: { glow: false, dust: false, nebulae: false, halo: false },
		},
	},
};

export const PRESET_ORDER = Object.keys(PRESETS) as Exclude<PresetName, 'custom'>[];

// ---------------------------------------------------------------------------
// Persistence and merging
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'gmd.galaxy.settings.v1';
const SCHEMA_VERSION = 1;

/** Overlay `partial` on `base`, keeping only known keys whose types match. */
export function mergeConfig(base: StarfieldConfig, partial: unknown): StarfieldConfig {
	if (typeof partial !== 'object' || partial === null) return base;
	const source = partial as Record<string, unknown>;
	const out: Record<string, unknown> = { ...base };
	for (const key of Object.keys(base) as (keyof StarfieldConfig)[]) {
		const incoming = source[key];
		const current = base[key];
		if (incoming === undefined) continue;
		if (key === 'layers' || key === 'blackHole') {
			out[key] = mergeNested(current as unknown as Record<string, unknown>, incoming);
		} else if (typeof incoming === typeof current) {
			out[key] = incoming;
		}
	}
	if (!(['auto', 'ultra', 'high', 'medium', 'low', 'minimal'] as string[]).includes(out.quality as string)) out.quality = 'auto';
	if (!['cinematic', 'scientific', 'calm', 'battery', 'custom'].includes(out.preset as string)) out.preset = 'custom';
	return out as unknown as StarfieldConfig;
}

function mergeNested(base: Record<string, unknown>, incoming: unknown): Record<string, unknown> {
	if (typeof incoming !== 'object' || incoming === null) return base;
	const src = incoming as Record<string, unknown>;
	const out = { ...base };
	for (const k of Object.keys(base)) {
		if (src[k] === undefined) continue;
		if (Array.isArray(base[k])) {
			if (Array.isArray(src[k]) && (src[k] as unknown[]).length === (base[k] as unknown[]).length) out[k] = src[k];
		} else if (typeof src[k] === typeof base[k]) out[k] = src[k];
	}
	return out;
}

function loadSaved(): StarfieldConfig | null {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as { version?: number; config?: unknown };
		if (parsed.version !== SCHEMA_VERSION) return null;
		return mergeConfig(DEFAULT_CONFIG, parsed.config);
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Live stats
// ---------------------------------------------------------------------------

/** Live renderer status, published about once a second. */
export interface StarfieldStats {
	mode: RenderMode | 'loading';
	ceiling: RenderMode | 'loading';
	fps: number;
	stars: number;
	drawCalls: number;
	resolution: number;
	reasons: string[];
}

const INITIAL_STATS: StarfieldStats = {
	mode: 'loading',
	ceiling: 'loading',
	fps: 0,
	stars: 0,
	drawCalls: 0,
	resolution: 1,
	reasons: [],
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface StarfieldContextType {
	config: StarfieldConfig;
	updateConfig: <K extends keyof StarfieldConfig>(key: K, value: StarfieldConfig[K]) => void;
	updateLayer: <K extends keyof GalaxyLayers>(key: K, value: GalaxyLayers[K]) => void;
	updateBlackHoleConfig: <K extends keyof BlackHoleConfig>(key: K, value: BlackHoleConfig[K]) => void;
	applyPreset: (name: Exclude<PresetName, 'custom'>) => void;
	/** Restore the given settings to their defaults. */
	resetKeys: (keys: (keyof StarfieldConfig)[]) => void;
	resetConfig: () => void;
	/** Put back whatever the last reset replaced. */
	undoReset: () => void;
	canUndo: boolean;
	isInitialized: boolean;
	setIsInitialized: (value: boolean) => void;
}

interface StarfieldStatsContextType {
	stats: StarfieldStats;
	setStats: (stats: StarfieldStats) => void;
}

const StarfieldContext = createContext<StarfieldContextType | undefined>(undefined);
// Separate context so per-second stats only re-render the controls, not the renderer.
const StarfieldStatsContext = createContext<StarfieldStatsContextType | undefined>(undefined);

export const useStarfield = () => {
	const context = useContext(StarfieldContext);
	if (!context) throw new Error('useStarfield must be used within a StarfieldProvider');
	return context;
};

export const useStarfieldStats = () => {
	const context = useContext(StarfieldStatsContext);
	if (!context) throw new Error('useStarfieldStats must be used within a StarfieldProvider');
	return context;
};

export const StarfieldProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [config, setConfig] = useState<StarfieldConfig>(DEFAULT_CONFIG);
	const [isInitialized, setIsInitialized] = useState(false);
	const [stats, setStats] = useState<StarfieldStats>(INITIAL_STATS);
	const [canUndo, setCanUndo] = useState(false);
	const undoRef = useRef<StarfieldConfig | null>(null);
	const loaded = useRef(false);
	const configRef = useRef(config);
	configRef.current = config;

	// Restore saved settings after mount (never during SSR, so there is no hydration mismatch).
	useEffect(() => {
		const saved = loadSaved();
		if (saved) setConfig(saved);
		loaded.current = true;
	}, []);

	// Save changes, debounced.
	useEffect(() => {
		if (!loaded.current) return;
		const id = window.setTimeout(() => {
			try {
				window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, config }));
			} catch {
				/* storage unavailable — settings just won't persist */
			}
		}, 300);
		return () => window.clearTimeout(id);
	}, [config]);

	const updateConfig = useCallback(<K extends keyof StarfieldConfig>(key: K, value: StarfieldConfig[K]) => {
		setConfig((prev) => ({ ...prev, [key]: value, preset: key === 'preset' ? (value as PresetName) : 'custom' }));
	}, []);

	const updateLayer = useCallback(<K extends keyof GalaxyLayers>(key: K, value: GalaxyLayers[K]) => {
		setConfig((prev) => ({ ...prev, preset: 'custom', layers: { ...prev.layers, [key]: value } }));
	}, []);

	const updateBlackHoleConfig = useCallback(<K extends keyof BlackHoleConfig>(key: K, value: BlackHoleConfig[K]) => {
		setConfig((prev) => ({ ...prev, blackHole: { ...prev.blackHole, [key]: value } }));
	}, []);

	const applyPreset = useCallback((name: Exclude<PresetName, 'custom'>) => {
		setConfig((prev) => {
			const governed = Object.fromEntries(GOVERNED_KEYS.map((k) => [k, DEFAULT_CONFIG[k]]));
			const values = PRESETS[name].values;
			return {
				...prev,
				...governed,
				...values,
				layers: { ...DEFAULT_CONFIG.layers, ...values.layers },
				preset: name,
			};
		});
	}, []);

	const resetKeys = useCallback((keys: (keyof StarfieldConfig)[]) => {
		const prev = configRef.current;
		undoRef.current = prev;
		setCanUndo(true);
		const next = { ...prev, preset: 'custom' as PresetName };
		for (const key of keys) (next as Record<string, unknown>)[key] = DEFAULT_CONFIG[key];
		setConfig(next);
	}, []);

	const resetConfig = useCallback(() => {
		undoRef.current = configRef.current;
		setCanUndo(true);
		setConfig(DEFAULT_CONFIG);
	}, []);

	const undoReset = useCallback(() => {
		if (!undoRef.current) return;
		setConfig(undoRef.current);
		undoRef.current = null;
		setCanUndo(false);
	}, []);

	const value = useMemo(
		() => ({
			config, updateConfig, updateLayer, updateBlackHoleConfig, applyPreset, resetKeys, resetConfig, undoReset, canUndo,
			isInitialized, setIsInitialized,
		}),
		[config, updateConfig, updateLayer, updateBlackHoleConfig, applyPreset, resetKeys, resetConfig, undoReset, canUndo, isInitialized],
	);
	const statsValue = useMemo(() => ({ stats, setStats }), [stats]);

	return (
		<StarfieldContext.Provider value={value}>
			<StarfieldStatsContext.Provider value={statsValue}>{children}</StarfieldStatsContext.Provider>
		</StarfieldContext.Provider>
	);
};
