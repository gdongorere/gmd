// src/components/solar/GlobeCanvas.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { Box } from '@chakra-ui/react';
import { simClock } from '@/lib/astro/clock';
import { makeProjector, type GlobeProjector, type SubSolar } from '@/lib/astro/globe';
import { renderGlobe, type Sampler } from '@/lib/astro/render';

export interface GlobeCanvasProps {
  ariaLabel: string;
  /** Sub-solar point for the body at this Julian Date. */
  subsolar: (jd: number) => SubSolar;
  /** Builds the per-pixel colour function for this Julian Date. */
  sampler: (jd: number) => Sampler;
  /** Optional annotations drawn on top (markers, atmosphere). `size` is the canvas edge in px. */
  overlay?: (ctx: CanvasRenderingContext2D, proj: GlobeProjector, jd: number, size: number) => void;
  /** Bumps when something other than time changed and a redraw is needed. */
  version?: number;
  size?: number;
}

/** A lit sphere you can drag to rotate; redraws only when time, view or inputs change. */
export function GlobeCanvas({ ariaLabel, subsolar, sampler, overlay, version = 0, size = 360 }: GlobeCanvasProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef({ az: 58, el: 16 });
  const dirty = useRef(true);
  const last = useRef({ jd: NaN, version: -1 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const props = useRef({ subsolar, sampler, overlay, version });
  props.current = { subsolar, sampler, overlay, version };

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const img = ctx.createImageData(size, size);
    const tick = () => {
      if (document.hidden) return;
      const jd = simClock().jd();
      const p = props.current;
      if (!dirty.current && jd === last.current.jd && p.version === last.current.version) return;
      dirty.current = false;
      last.current = { jd, version: p.version };
      const proj = makeProjector(p.subsolar(jd), view.current.az, view.current.el);
      ctx.clearRect(0, 0, size, size);
      renderGlobe(img, proj, p.sampler(jd));
      ctx.putImageData(img, 0, 0);
      p.overlay?.(ctx, proj, jd, size);
    };
    tick();
    const id = window.setInterval(tick, 66);
    return () => window.clearInterval(id);
  }, [size]);

  const onDown = (e: React.PointerEvent) => { canvas.current?.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    view.current.az -= (e.clientX - drag.current.x) * 0.45;
    view.current.el = Math.max(-80, Math.min(80, view.current.el + (e.clientY - drag.current.y) * 0.35));
    drag.current = { x: e.clientX, y: e.clientY };
    dirty.current = true;
  };
  const onUp = () => { drag.current = null; };
  const onKey = (e: React.KeyboardEvent) => {
    const v = view.current;
    if (e.key === 'ArrowLeft') v.az += 8; else if (e.key === 'ArrowRight') v.az -= 8;
    else if (e.key === 'ArrowUp') v.el = Math.min(80, v.el + 6); else if (e.key === 'ArrowDown') v.el = Math.max(-80, v.el - 6);
    else return;
    e.preventDefault();
    dirty.current = true;
  };

  return (
    <Box w="full" maxW="clamp(280px, calc(100dvh - 400px), 520px)" mx="auto">
      <canvas
        ref={canvas}
        width={size}
        height={size}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        style={{ width: '100%', height: 'auto', aspectRatio: '1', touchAction: 'none', cursor: 'grab', display: 'block', outlineOffset: 4 }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
      />
    </Box>
  );
}
