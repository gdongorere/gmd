// src/contexts/StarfieldContext.tsx
'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { RenderMode, Tier } from '@/lib/galaxy/tiers';

export type QualitySetting = 'auto' | Tier;

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
	/** Fly the camera through the keyframes as the page scrolls. */
	scrollCamera: boolean;
	/** Degrees of camera roll over the full scroll. */
	scrollRoll: number;
	/** Pointer/tilt parallax strength. */
	parallax: number;
	showSunMarker: boolean;
	/** Dev overlay: tier, fps, star count, draw calls. */
	showStats: boolean;
	blackHole: BlackHoleConfig;
}

export const DEFAULT_CONFIG: StarfieldConfig = {
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
	scrollRoll: 360,
	parallax: 1,
	showSunMarker: false,
	showStats: false,
	blackHole: {
		isEnabled: true,
		size: 26,
		accretionDisk: true,
		spin: 1,
		colorPalette: ['#FFD9A0', '#FF6B00', '#7209B7'],
	},
};

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

interface StarfieldContextType {
	config: StarfieldConfig;
	updateConfig: <K extends keyof StarfieldConfig>(key: K, value: StarfieldConfig[K]) => void;
	updateLayer: <K extends keyof GalaxyLayers>(key: K, value: GalaxyLayers[K]) => void;
	updateBlackHoleConfig: <K extends keyof BlackHoleConfig>(key: K, value: BlackHoleConfig[K]) => void;
	resetConfig: () => void;
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
	if (!context) {
		throw new Error('useStarfield must be used within a StarfieldProvider');
	}
	return context;
};

export const useStarfieldStats = () => {
	const context = useContext(StarfieldStatsContext);
	if (!context) {
		throw new Error('useStarfieldStats must be used within a StarfieldProvider');
	}
	return context;
};

interface StarfieldProviderProps {
	children: React.ReactNode;
}

export const StarfieldProvider: React.FC<StarfieldProviderProps> = ({ children }) => {
	const [config, setConfig] = useState<StarfieldConfig>(DEFAULT_CONFIG);
	const [isInitialized, setIsInitialized] = useState(false);
	const [stats, setStats] = useState<StarfieldStats>(INITIAL_STATS);

	const updateConfig = useCallback(<K extends keyof StarfieldConfig>(key: K, value: StarfieldConfig[K]) => {
		setConfig((prev) => ({ ...prev, [key]: value }));
	}, []);

	const updateLayer = useCallback(<K extends keyof GalaxyLayers>(key: K, value: GalaxyLayers[K]) => {
		setConfig((prev) => ({ ...prev, layers: { ...prev.layers, [key]: value } }));
	}, []);

	const updateBlackHoleConfig = useCallback(<K extends keyof BlackHoleConfig>(key: K, value: BlackHoleConfig[K]) => {
		setConfig((prev) => ({ ...prev, blackHole: { ...prev.blackHole, [key]: value } }));
	}, []);

	const resetConfig = useCallback(() => setConfig(DEFAULT_CONFIG), []);

	const value = useMemo(
		() => ({ config, updateConfig, updateLayer, updateBlackHoleConfig, resetConfig, isInitialized, setIsInitialized }),
		[config, updateConfig, updateLayer, updateBlackHoleConfig, resetConfig, isInitialized],
	);
	const statsValue = useMemo(() => ({ stats, setStats }), [stats]);

	return (
		<StarfieldContext.Provider value={value}>
			<StarfieldStatsContext.Provider value={statsValue}>{children}</StarfieldStatsContext.Provider>
		</StarfieldContext.Provider>
	);
};
