// src/components/galaxy/explore/SunUncertainty.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { galaxyBus } from '@/lib/galaxy/bus';
import { GALAXY } from '@/lib/galaxy/constants';
import { simClock } from '@/lib/astro/clock';
import { DAYS_PER_YEAR, jdFromUnixMs } from '@/lib/astro/julian';
import { SUN_GALAXY, armFanHalfAngleDeg, sunDistanceUncertaintyLy } from '@/lib/astro/galaxySun';

/** World units are 100 light-years. */
const LY = 0.01;

/**
 * Two honest-uncertainty marks on the 3D galaxy: an ellipse at the Sun sized by the published distance (±R0) and
 * height (±z0) errors, and a fan along the Sun's orbit showing how unsure the spiral-arm phase is away from today.
 */
export function SunUncertainty({ enabled }: { enabled: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!enabled || !canvas || !ctx) return;
    let raf = 0, last = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fit = () => {
      canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    window.addEventListener('resize', fit);
    const sx = GALAXY.sunRadius, sy = GALAXY.sunHeight;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < 40 || document.hidden) return;
      last = t;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const api = galaxyBus.api;
      if (!api) return;
      const nowYears = (simClock().jd() - jdFromUnixMs(Date.now())) / DAYS_PER_YEAR;
      const half = armFanHalfAngleDeg(nowYears);
      const camLy = api.cameraDistanceLy();
      if (half > 0.2) {
        // Wedge of the Sun's orbit circle, drawn as a thick translucent band.
        const pts: { x: number; y: number; visible: boolean }[] = [];
        const n = 24;
        for (let i = 0; i <= n; i++) {
          const phi = ((i / n) * 2 - 1) * (half * Math.PI) / 180;
          pts.push(api.project(sx * Math.cos(phi), sy, sx * Math.sin(phi)));
        }
        ctx.beginPath();
        pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.strokeStyle = 'rgba(127,224,255,0.55)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
      }
      if (camLy < 6000) {
        const dx = sunDistanceUncertaintyLy() * LY, dz = SUN_GALAXY.z0.plus * 3.261564 * LY;
        const c = api.project(sx, sy, 0);
        const r = api.project(sx + dx, sy, 0), u = api.project(sx, sy + dz, 0);
        if (c.visible) {
          const rx = Math.max(6, Math.hypot(r.x - c.x, r.y - c.y)), ry = Math.max(6, Math.hypot(u.x - c.x, u.y - c.y));
          ctx.beginPath(); ctx.ellipse(c.x, c.y, rx, ry, Math.atan2(r.y - c.y, r.x - c.x), 0, 7);
          ctx.strokeStyle = 'rgba(255,193,59,0.9)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  }, [enabled]);

  if (!enabled) return null;
  return <canvas ref={ref} aria-hidden="true" style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 4, pointerEvents: 'none' }} />;
}
