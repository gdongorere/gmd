// src/components/galaxy/explore/ExploreLabels.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { Box } from '@chakra-ui/react';
import { galaxyBus } from '@/lib/galaxy/bus';
import { FEATURES, type Feature } from '@/lib/galaxy/features';

interface Rect { x: number; y: number; w: number; h: number }
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * DOM labels anchored to 3D positions. Positions are written straight to element styles
 * from a throttled rAF loop (no React re-renders), and overlapping labels are dropped
 * in priority order so the screen never fills with text.
 */
export function ExploreLabels({
  enabled, selectedId, onSelect,
}: { enabled: boolean; selectedId: string | null; onSelect: (feature: Feature) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let last = 0;
    const widths: Record<string, number> = {};
    const ordered = [...FEATURES].sort((a, b) => a.priority - b.priority);

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 33) return;
      last = t;
      const api = galaxyBus.api;
      if (!api) return;
      const camUnits = api.cameraDistanceLy() / 100;
      const placed: Rect[] = [];
      for (const f of ordered) {
        const el = refs.current[f.id];
        if (!el) continue;
        const p = api.project(f.position[0], f.position[1], f.position[2]);
        let show = p.visible;
        if (f.priority === 2 && camUnits > 750) show = false;
        if (f.priority === 3 && camUnits > 420) show = false;
        if (show) {
          const w = (widths[f.id] ??= el.offsetWidth || 120);
          const rect = { x: p.x - 8, y: p.y - 14, w: w + 8, h: 28 };
          if (f.id !== selectedId && placed.some((r) => overlaps(r, rect))) show = false;
          else placed.push(rect);
        }
        el.style.opacity = show ? '1' : '0';
        el.style.pointerEvents = show ? 'auto' : 'none';
        el.tabIndex = show ? 0 : -1;
        el.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled, selectedId]);

  if (!enabled) return null;
  return (
    <Box position="fixed" inset={0} zIndex={5} pointerEvents="none" overflow="hidden" aria-label="Galaxy features" role="group">
      {FEATURES.map((f) => (
        <Box
          as="button"
          key={f.id}
          ref={(el: HTMLButtonElement | null) => { refs.current[f.id] = el; }}
          type="button"
          position="absolute"
          left={0}
          top={0}
          opacity={0}
          pointerEvents="none"
          display="flex"
          alignItems="center"
          gap={2}
          pl="2px"
          pr={2}
          h="28px"
          ml="-6px"
          mt="-14px"
          borderRadius="full"
          bg={selectedId === f.id ? 'accent.solid' : 'rgba(10,10,10,0.72)'}
          border="1px solid"
          borderColor={selectedId === f.id ? 'accent.fg' : 'line.strong'}
          color="white"
          fontSize="xs"
          fontWeight={600}
          whiteSpace="nowrap"
          backdropFilter="blur(6px)"
          transition="opacity 160ms, background-color 160ms"
          willChange="transform"
          aria-label={`${f.label} — show details and fly there`}
          onClick={() => onSelect(f)}
          _hover={{ borderColor: 'accent.fg' }}
        >
          <Box as="span" aria-hidden="true" boxSize="10px" borderRadius="full" bg={f.kind === 'centre' ? 'orange.300' : f.kind === 'home' ? 'cyan.300' : f.kind === 'satellite' ? 'purple.300' : 'whiteAlpha.900'} boxShadow="0 0 8px currentColor" />
          {f.label}
        </Box>
      ))}
    </Box>
  );
}
