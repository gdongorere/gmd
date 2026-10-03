// src/components/galaxy/useGalaxyWaypoint.ts
'use client';

import { useCallback, useEffect, useId, useRef } from 'react';
import type { GalaxyViewName } from '@/lib/galaxy/camera';
import { galaxyBus } from '@/lib/galaxy/bus';

/**
 * Marks an element as a camera waypoint: while it is the section in view, the galaxy
 * settles on `view`; between sections the camera flies along a smooth path.
 * Returns a ref callback to attach to the section element.
 */
export function useGalaxyWaypoint<T extends HTMLElement = HTMLElement>(view: GalaxyViewName | undefined) {
	const id = useId();
	const elementRef = useRef<T | null>(null);
	const observerRef = useRef<ResizeObserver | null>(null);

	const measure = useCallback(() => {
		const el = elementRef.current;
		if (!el || !view) return;
		const rect = el.getBoundingClientRect();
		galaxyBus.setWaypoint({ id, view, y: rect.top + window.scrollY + rect.height / 2 });
	}, [id, view]);

	useEffect(() => {
		if (!view) return;
		measure();
		const onResize = () => measure();
		window.addEventListener('resize', onResize, { passive: true });
		window.addEventListener('load', onResize);
		// Layout above this section can change after images/fonts load.
		const observer = new ResizeObserver(onResize);
		observer.observe(document.documentElement);
		if (elementRef.current) observer.observe(elementRef.current);
		observerRef.current = observer;
		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('load', onResize);
			observer.disconnect();
			observerRef.current = null;
			galaxyBus.removeWaypoint(id);
		};
	}, [id, view, measure]);

	return useCallback(
		(node: T | null) => {
			elementRef.current = node;
			if (node) measure();
		},
		[measure],
	);
}
