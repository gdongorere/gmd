// src/components/solar/Orrery.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { simClock } from '@/lib/astro/clock';
import { PLANETS, planetConfidence, planetStates } from '@/lib/astro/planets';
import { useSimClock } from './useSimClock';

/** Radius on screen grows with √(distance) so Mercury and Neptune both fit. */
const scale = (au: number, R: number) => Math.sqrt(au / 31) * R;

export function Orrery() {
  const ref = useRef<HTMLCanvasElement>(null);
  const snap = useSimClock(1000);
  const conf = planetConfidence(snap.jd);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let size = 640;
    let lastJd = NaN;
    const fit = () => {
      const w = Math.min(canvas.parentElement?.clientWidth ?? 640, 760);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      size = w;
      canvas.width = w * dpr; canvas.height = w * dpr;
      canvas.style.width = `${w}px`; canvas.style.height = `${w}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lastJd = NaN; // resizing clears the bitmap, so force a repaint
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    const draw = () => {
      if (document.hidden) return;
      const jd = simClock().jd();
      if (jd === lastJd) return;
      lastJd = jd;
      const R = size / 2 - 12;
      ctx.clearRect(0, 0, size, size);
      ctx.translate(size / 2, size / 2);
      // orbits
      ctx.lineWidth = 1;
      for (const p of PLANETS) {
        ctx.beginPath(); ctx.arc(0, 0, scale(p.a, R), 0, 7);
        ctx.strokeStyle = p.id === 'Earth' ? 'rgba(130,190,255,0.45)' : p.id === 'Mars' ? 'rgba(240,130,90,0.45)' : 'rgba(255,255,255,0.14)';
        ctx.stroke();
      }
      // Sun
      const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 26);
      glow.addColorStop(0, 'rgba(255,240,180,1)'); glow.addColorStop(0.25, 'rgba(255,200,90,0.9)'); glow.addColorStop(1, 'rgba(255,160,40,0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, 26, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
      const states = planetStates(jd);
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      if (states) {
        for (const s of states) {
          const meta = PLANETS.find((p) => p.id === s.id)!;
          const ang = Math.atan2(s.y, s.x);
          const rr = scale(s.r, R);
          const x = Math.cos(ang) * rr, y = -Math.sin(ang) * rr; // ecliptic north up, counter-clockwise like the sky
          const big = s.id === 'Earth' || s.id === 'Mars';
          ctx.beginPath(); ctx.arc(x, y, big ? 5 : 3.5, 0, 7); ctx.fillStyle = meta.color; ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.88)';
          if (x > size / 2 - 70) { ctx.textAlign = 'right'; ctx.fillText(s.id, x - 8, y); ctx.textAlign = 'left'; } else ctx.fillText(s.id, x + 8, y);
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    draw();
    const id = window.setInterval(draw, 100);
    return () => { window.clearInterval(id); ro.disconnect(); };
  }, []);

  return (
    <Flex direction="column" align="center" gap={3}>
      <Box w="full" maxW="760px">
        <canvas ref={ref} role="img" aria-label="Top-down map of the planets orbiting the Sun at the selected time. Distances are compressed so every planet fits." />
      </Box>
      <Text fontSize="sm" color="content.muted" textAlign="center" maxW="640px">
        Seen from above the ecliptic. Orbits are spaced by √distance so Mercury and Neptune both fit. {conf.note}
      </Text>
    </Flex>
  );
}
