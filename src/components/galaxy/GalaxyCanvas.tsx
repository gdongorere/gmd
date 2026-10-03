// src/components/galaxy/GalaxyCanvas.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useStarfield, useStarfieldStats } from '@/contexts/StarfieldContext';
import { createGalaxyEngine, GalaxyEngine } from '@/lib/galaxy/engine';
import { detectDevice, qualityOverrideFromUrl } from '@/lib/galaxy/quality';
import { isTier } from '@/lib/galaxy/tiers';

interface GalaxyCanvasProps {
	/** Called when the device can't run WebGL (or ?quality=static), so the CSS fallback takes over. */
	onStatic(): void;
}

const GalaxyCanvas: React.FC<GalaxyCanvasProps> = ({ onStatic }) => {
	const { config, setIsInitialized } = useStarfield();
	const { setStats } = useStarfieldStats();
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const sunRef = useRef<HTMLDivElement>(null);
	const statsRef = useRef<HTMLPreElement>(null);
	const engineRef = useRef<GalaxyEngine | null>(null);
	const configRef = useRef(config);
	const [visible, setVisible] = useState(false);
	// Bumped after a lost WebGL context so a fresh canvas + context is created.
	const [generation, setGeneration] = useState(0);

	configRef.current = config;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const controller = new AbortController();
		let engine: GalaxyEngine | null = null;

		const override = qualityOverrideFromUrl();
		const profile = detectDevice();
		if (override === 'static' || profile.ceiling === 'static') {
			setStats({ mode: 'static', ceiling: profile.ceiling, fps: 0, stars: 0, drawCalls: 0, resolution: 1, reasons: profile.reasons });
			onStatic();
			return;
		}
		const ceiling = isTier(override) ? override : profile.ceiling;

		createGalaxyEngine({
			canvas,
			sunMarker: sunRef.current,
			statsOverlay: statsRef.current,
			config: configRef.current,
			profile: { ...profile, ceiling },
			forcedTier: isTier(override) ? override : null,
			onStats: setStats,
			onReady: () => {
				setVisible(true);
				setIsInitialized(true);
			},
			onContextLost: () => {
				setVisible(false);
				window.setTimeout(() => setGeneration((g) => g + 1), 500);
			},
			signal: controller.signal,
		})
			.then((created) => {
				if (controller.signal.aborted) {
					created.dispose();
					return;
				}
				engine = created;
				engineRef.current = created;
				created.setConfig(configRef.current);
			})
			.catch((error: unknown) => {
				console.error('Galaxy renderer failed, using static fallback', error);
				onStatic();
			});

		return () => {
			controller.abort();
			engine?.dispose();
			engineRef.current = null;
		};
	}, [generation, onStatic, setIsInitialized, setStats]);

	useEffect(() => {
		engineRef.current?.setConfig(config);
	}, [config]);

	return (
		<>
			<canvas
				key={generation}
				ref={canvasRef}
				aria-hidden="true"
				style={{
					position: 'fixed',
					inset: 0,
					width: '100%',
					height: '100%',
					zIndex: 0,
					pointerEvents: 'none',
					opacity: visible ? 1 : 0,
					transition: 'opacity 1.2s ease',
				}}
			/>
			<div
				ref={sunRef}
				aria-hidden="true"
				style={{
					position: 'fixed',
					left: 0,
					top: 0,
					zIndex: 1,
					pointerEvents: 'none',
					opacity: 0,
					transition: 'opacity 0.4s ease',
					willChange: 'transform',
				}}
			>
				<div
					style={{
						width: 14,
						height: 14,
						marginLeft: -7,
						marginTop: -7,
						borderRadius: '50%',
						border: '1.5px solid rgba(120, 220, 255, 0.9)',
						boxShadow: '0 0 8px rgba(120, 220, 255, 0.6)',
					}}
				/>
				<span
					style={{
						position: 'absolute',
						left: 12,
						top: -8,
						whiteSpace: 'nowrap',
						font: '600 11px/1 system-ui, sans-serif',
						letterSpacing: '0.04em',
						color: 'rgba(170, 230, 255, 0.95)',
						textShadow: '0 0 4px rgba(0,0,0,0.9)',
					}}
				>
					☉ You are here
				</span>
			</div>
			<pre
				ref={statsRef}
				aria-hidden="true"
				style={{
					position: 'fixed',
					top: 72,
					left: 12,
					zIndex: 60,
					display: 'none',
					margin: 0,
					padding: '6px 8px',
					borderRadius: 6,
					pointerEvents: 'none',
					background: 'rgba(0, 0, 0, 0.6)',
					color: '#9fe8ff',
					font: '11px/1.4 ui-monospace, monospace',
				}}
			/>
		</>
	);
};

export default GalaxyCanvas;
