// src/components/solar/Orrery.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, ButtonGroup, Checkbox, Flex, Text } from '@chakra-ui/react';
import { simClock } from '@/lib/astro/clock';
import { PLANETS, moonState, orbitalPeriodYears, planetConfidence, planetStates, type PlanetId, type PlanetState } from '@/lib/astro/planets';
import { useSimClock } from './useSimClock';

/** Radius on screen grows with √(distance) so Mercury and Neptune both fit. */
const scale = (au: number, R: number) => Math.sqrt(au / 31) * R;

const LIGHT_MIN_PER_AU = 8.3168;
const fmtPeriod = (y: number) => (y < 2 ? `${Math.round(y * 365.25)} d` : `${y.toFixed(y < 20 ? 2 : 1)} yr`);

export function Orrery() {
  const ref = useRef<HTMLCanvasElement>(null);
  const snap = useSimClock(1000);
  const conf = planetConfidence(snap.jd);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [focus, setFocus] = useState<PlanetId | null>(null);
  const opts = useRef({ showOrbits, showLabels, focus });
  opts.current = { showOrbits, showLabels, focus };
  const hits = useRef<{ id: PlanetId; x: number; y: number }[]>([]);
  const redraw = useRef<() => void>(() => {});
  useEffect(() => { redraw.current(); }, [showOrbits, showLabels, focus]);
  const states = useMemo(() => planetStates(snap.jd), [snap.jd]);
  const focusState: PlanetState | undefined = states?.find((s) => s.id === focus);
  const focusMeta = PLANETS.find((p) => p.id === focus);
  const earth = states?.find((s) => s.id === 'Earth');
  const dEarth = focusState && earth ? Math.hypot(focusState.x - earth.x, focusState.y - earth.y, focusState.z - earth.z) : null;

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
      ctx.setTransform(Math.min(window.devicePixelRatio || 1, 2), 0, 0, Math.min(window.devicePixelRatio || 1, 2), 0, 0);
      lastJd = jd;
      const R = size / 2 - 12;
      ctx.clearRect(0, 0, size, size);
      ctx.translate(size / 2, size / 2);
      // orbits
      ctx.lineWidth = 1;
      const o = opts.current;
      for (const p of o.showOrbits ? PLANETS : []) {
        ctx.beginPath(); ctx.arc(0, 0, scale(p.a, R), 0, 7);
        ctx.strokeStyle = p.id === o.focus ? 'rgba(255,255,255,0.7)' : p.id === 'Earth' ? 'rgba(130,190,255,0.45)' : p.id === 'Mars' ? 'rgba(240,130,90,0.45)' : 'rgba(255,255,255,0.14)';
        ctx.lineWidth = p.id === o.focus ? 2 : 1;
        ctx.stroke();
      }
      ctx.lineWidth = 1;
      hits.current = [];
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
          if (s.id === o.focus) { ctx.beginPath(); ctx.arc(x, y, 10, 0, 7); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1; }
          hits.current.push({ id: s.id, x: x + size / 2, y: y + size / 2 });
          if (o.showLabels) {
            ctx.fillStyle = 'rgba(255,255,255,0.88)';
            const label = `${s.id} · ${fmtPeriod(orbitalPeriodYears(meta.a))}`;
            if (x > size / 2 - 120) { ctx.textAlign = 'right'; ctx.fillText(label, x - 8, y); ctx.textAlign = 'left'; } else ctx.fillText(label, x + 8, y);
          }
        }
      }
      // Earth–Moon inset (distance exaggerated: the real Moon sits ~0.0026 AU from Earth).
      const moon = moonState(jd);
      if (moon && size > 420) {
        const ir = 34, ix = -size / 2 + ir + 14, iy = size / 2 - ir - 14;
        ctx.beginPath(); ctx.arc(ix, iy, ir, 0, 7); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.stroke();
        ctx.beginPath(); ctx.arc(ix, iy, 4, 0, 7); ctx.fillStyle = '#5ab0ff'; ctx.fill();
        const a = moon.eclipticLon * Math.PI / 180;
        ctx.beginPath(); ctx.arc(ix + Math.cos(a) * ir, iy - Math.sin(a) * ir, 2.5, 0, 7); ctx.fillStyle = '#eee8d4'; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Earth–Moon (not to scale)', ix + 20, iy - ir - 8); ctx.textAlign = 'left'; ctx.font = '600 12px system-ui, sans-serif';
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    redraw.current = () => { lastJd = NaN; draw(); };
    draw();
    const id = window.setInterval(draw, 100);
    return () => { window.clearInterval(id); ro.disconnect(); };
  }, []);

  return (
    <Flex direction="column" align="center" gap={3}>
      <Box w="full" maxW="760px">
        <canvas
          ref={ref} role="img" style={{ cursor: 'pointer' }}
          aria-label="Top-down map of the planets orbiting the Sun at the selected time. Distances are compressed so every planet fits. Click a planet, or use the buttons below, to focus it."
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            let best: PlanetId | null = null, bd = 18;
            for (const h of hits.current) { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h.id; } }
            setFocus(best);
          }}
        />
      </Box>
      <Flex gap={4} wrap="wrap" justify="center">
        <Checkbox isChecked={showOrbits} onChange={(e) => setShowOrbits(e.target.checked)}>Orbits</Checkbox>
        <Checkbox isChecked={showLabels} onChange={(e) => setShowLabels(e.target.checked)}>Labels and periods</Checkbox>
      </Flex>
      <ButtonGroup size="xs" variant="outline" isAttached={false} flexWrap="wrap" justifyContent="center" gap={1} aria-label="Focus a planet">
        {PLANETS.map((p) => (
          <Button key={p.id} aria-pressed={focus === p.id} variant={focus === p.id ? 'solid' : 'outline'} onClick={() => setFocus(focus === p.id ? null : p.id)}>{p.id}</Button>
        ))}
      </ButtonGroup>
      {focusState && focusMeta && (
        <Box data-testid="planet-focus" p={3} border="1px solid" borderColor="line.subtle" borderRadius="lg" bg="surface.inset" maxW="640px" w="full">
          <Text fontWeight={700}>{focusMeta.id}</Text>
          <Text fontSize="sm" color="content.secondary">
            {focusState.r.toFixed(3)} AU from the Sun · orbital period {fmtPeriod(orbitalPeriodYears(focusMeta.a))} (Kepler, a = {focusMeta.a} AU)
            {dEarth !== null && focus !== 'Earth' ? ` · ${dEarth.toFixed(3)} AU from Earth (light takes ${(dEarth * LIGHT_MIN_PER_AU).toFixed(1)} min)` : ''} · radius {focusMeta.radiusKm.toLocaleString('en-US')} km
          </Text>
        </Box>
      )}
      <Text fontSize="sm" color="content.muted" textAlign="center" maxW="640px">
        Seen from above the ecliptic. Orbits are spaced by √distance so Mercury and Neptune both fit. {conf.note}
      </Text>
    </Flex>
  );
}
