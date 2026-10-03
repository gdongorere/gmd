// src/components/EnhancedStarfield.tsx
// Milky Way background. A pure-CSS galaxy paints instantly (and is the whole
// show on devices without WebGL); the WebGL galaxy is lazy-loaded on top.
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useStarfield } from '@/contexts/StarfieldContext';

const GalaxyCanvas = dynamic(() => import('@/components/galaxy/GalaxyCanvas'), { ssr: false });

const SPACE = 'rgb(10, 10, 10)';

// A tiny starry tile repeated across the screen, plus a soft barred-spiral glow.
const STATIC_STARS = [
	'radial-gradient(1px 1px at 12% 18%, rgba(255,255,255,0.9), transparent)',
	'radial-gradient(1px 1px at 72% 36%, rgba(210,225,255,0.8), transparent)',
	'radial-gradient(1.5px 1.5px at 38% 74%, rgba(255,235,200,0.85), transparent)',
	'radial-gradient(1px 1px at 88% 82%, rgba(255,255,255,0.7), transparent)',
	'radial-gradient(1px 1px at 54% 8%, rgba(255,210,170,0.75), transparent)',
].join(', ');

const GALAXY_GLOW = [
	'radial-gradient(ellipse 5% 3.5% at 50% 50%, rgba(255,240,215,0.95), rgba(255,200,140,0.4) 55%, transparent 75%)',
	'radial-gradient(ellipse 17% 6% at 50% 50%, rgba(255,190,120,0.35), transparent 70%)',
	'radial-gradient(ellipse 34% 30% at 50% 50%, rgba(150,170,255,0.13), transparent 70%)',
	'conic-gradient(from 20deg at 50% 50%, transparent 0deg, rgba(140,165,255,0.07) 40deg, transparent 90deg, rgba(255,120,170,0.05) 150deg, transparent 180deg, rgba(140,165,255,0.07) 220deg, transparent 270deg, rgba(255,120,170,0.05) 330deg, transparent 360deg)',
].join(', ');

const EnhancedStarfield: React.FC = () => {
	const { config } = useStarfield();
	const [isStatic, setIsStatic] = useState(false);
	const galaxyRef = useRef<HTMLDivElement>(null);
	const handleStatic = useCallback(() => setIsStatic(true), []);

	// Static mode: a CSS-only roll/zoom on scroll, so low-end devices still get the effect.
	useEffect(() => {
		if (!isStatic) return;
		const el = galaxyRef.current;
		if (!el) return;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let frame = 0;
		const apply = () => {
			frame = 0;
			const max = document.documentElement.scrollHeight - window.innerHeight;
			const p = max > 1 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
			const roll = reduced || !config.scrollCamera ? 0 : config.scrollRoll * p;
			el.style.transform = `rotate(${(-27 + roll).toFixed(2)}deg) scale(${(1 + p * 0.6).toFixed(3)})`;
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(apply);
		};
		apply();
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', onScroll);
			cancelAnimationFrame(frame);
		};
	}, [isStatic, config.scrollCamera, config.scrollRoll]);

	return (
		<>
			<div
				aria-hidden="true"
				style={{
					position: 'fixed',
					inset: 0,
					zIndex: 0,
					pointerEvents: 'none',
					overflow: 'hidden',
					backgroundColor: SPACE,
					backgroundImage: STATIC_STARS,
					backgroundSize: '180px 180px',
				}}
			>
				<div
					ref={galaxyRef}
					style={{
						position: 'absolute',
						left: '50%',
						top: '50%',
						width: '140vmax',
						height: '140vmax',
						marginLeft: '-70vmax',
						marginTop: '-70vmax',
						backgroundImage: GALAXY_GLOW,
						transform: 'rotate(-27deg)',
						transformOrigin: '50% 50%',
						willChange: isStatic ? 'transform' : undefined,
					}}
				/>
			</div>
			{!isStatic && <GalaxyCanvas onStatic={handleStatic} />}
		</>
	);
};

export default EnhancedStarfield;
