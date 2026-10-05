// src/components/solar/EarthView.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Box, SimpleGrid, Text } from '@chakra-ui/react';
import { GlobeCanvas } from './GlobeCanvas';
import { useSimClock } from './useSimClock';
import { subsolarPoint, obliquityDegrees, sunPosition } from '@/lib/astro/earth';
import { gmstDegrees } from '@/lib/astro/time';
import { climateAt, iceCover, iceEdgeLatitudes } from '@/lib/astro/climate';
import { moonState } from '@/lib/astro/planets';
import { calendarFromJd } from '@/lib/astro/julian';
import { smoothstep } from '@/lib/astro/render';
import type { Sampler } from '@/lib/astro/render';

const MW = 1440, MH = 720;

/** Bilinear land coverage (0–1) from the mask at a latitude/longitude. */
function landCoverage(m: Uint8Array, lat: number, lon: number): number {
  const fx = Math.min(MW - 1.001, Math.max(0, (lon + 180) * (MW / 360) - 0.5));
  const fy = Math.min(MH - 1.001, Math.max(0, (90 - lat) * (MH / 180) - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
  const a = m[y0 * MW + x0], b = m[y0 * MW + x0 + 1], c = m[(y0 + 1) * MW + x0], d = m[(y0 + 1) * MW + x0 + 1];
  return ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty) / 255;
}

/** Rasterises Natural Earth land polygons into an equirectangular mask. */
function useLandMask() {
  const [mask, setMask] = useState<Uint8Array | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const rings: [number, number][][] = await (await fetch('/solar/land.json')).json();
        const c = document.createElement('canvas');
        c.width = MW; c.height = MH;
        const g = c.getContext('2d');
        if (!g) return;
        g.fillStyle = '#fff';
        for (const ring of rings) {
          for (const shift of [-360, 0, 360]) {
            g.beginPath();
            ring.forEach(([lon, lat], i) => { const x = (lon + shift + 180) * (MW / 360), y = (90 - lat) * (MH / 180); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
            g.closePath();
            g.fill();
          }
        }
        const px = g.getImageData(0, 0, MW, MH).data;
        const m = new Uint8Array(MW * MH);
        for (let i = 0; i < m.length; i++) m[i] = px[i * 4 + 3];
        if (alive) setMask(m);
      } catch { /* the globe still draws, as ocean */ }
    })();
    return () => { alive = false; };
  }, []);
  return mask;
}

/** Smooth latitude palette: rainforest → desert belt → temperate green → tundra → polar. Schematic, not land cover. */
const PALETTE: [number, number, number, number][] = [
  [0, 46, 104, 56], [10, 62, 114, 60], [20, 148, 136, 92], [30, 164, 142, 94], [42, 100, 126, 72], [55, 70, 112, 64], [65, 128, 140, 118], [78, 172, 176, 170],
];
function landColour(a: number): [number, number, number] {
  for (let i = 1; i < PALETTE.length; i++) {
    if (a <= PALETTE[i][0]) {
      const t = (a - PALETTE[i - 1][0]) / (PALETTE[i][0] - PALETTE[i - 1][0]);
      return [0, 1, 2].map((k) => PALETTE[i - 1][k + 1] + (PALETTE[i][k + 1] - PALETTE[i - 1][k + 1]) * t) as [number, number, number];
    }
  }
  const l = PALETTE[PALETTE.length - 1];
  return [l[1], l[2], l[3]];
}

const hours = (deg: number) => { const h = deg / 15; return `${Math.floor(h)}h ${String(Math.floor((h % 1) * 60)).padStart(2, '0')}m`; };

export function EarthView() {
  const mask = useLandMask();
  const snap = useSimClock(500);
  const sp = subsolarPoint(snap.jd);
  const climate = useMemo(() => climateAt(snap.jd), [snap.jd]);
  const moon = moonState(snap.jd);
  const c = calendarFromJd(snap.jd);
  const maskRef = useRef(mask);
  maskRef.current = mask;

  const sampler = (jd: number): Sampler => {
    const f = climateAt(jd).iceFraction;
    const edge = iceEdgeLatitudes(jd2ka(jd));
    const m = maskRef.current;
    return (lat, lon, light, out) => {
      const day = smoothstep(-0.12, 0.2, light);
      const lit = Math.max(0, light);
      let r: number, g: number, b: number;
      const cov = m ? landCoverage(m, lat, lon) : 0;
      // Ocean colour
      let or = 14 + 22 * lit, og = 54 + 52 * lit, ob = 112 + 62 * lit;
      const glint = Math.pow(lit, 24) * 60 * (1 - cov);
      or += glint; og += glint; ob += glint;
      if (Math.abs(lat) > 80 - f * 14) { or += (225 - or) * 0.8; og += (232 - og) * 0.8; ob += (240 - ob) * 0.8; }
      if (cov > 0.004) {
        const a = Math.abs(lat);
        const [lr0, lg0, lb0] = landColour(Math.abs(lat));
        let lr = lr0, lg = lg0, lb = lb0;
        const ice = iceCover(lat, lon, f, edge);
        if (ice > 0) { lr += (240 - lr) * ice; lg += (244 - lg) * ice; lb += (250 - lb) * ice; }
        r = or + (lr - or) * cov; g = og + (lg - og) * cov; b = ob + (lb - ob) * cov;
      } else { r = or; g = og; b = ob; }
      const shade = 0.05 + 0.95 * day * (0.35 + 0.65 * lit);
      out[0] = r * shade + (1 - day) * 2; out[1] = g * shade + (1 - day) * 4; out[2] = b * shade + (1 - day) * 10;
      // warm twilight band
      const tw = smoothstep(-0.12, 0, light) * (1 - smoothstep(0, 0.12, light));
      out[0] += tw * 40; out[1] += tw * 14;
    };
  };

  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="center">
      <GlobeCanvas
        ariaLabel={`Earth as it appears from space at the selected time, with the Sun overhead at ${sp.latitude.toFixed(1)}° latitude, ${sp.longitude.toFixed(1)}° longitude. Drag to rotate.`}
        subsolar={(jd) => { const s = subsolarPoint(jd); return { lat: s.latitude, lon: s.longitude }; }}
        sampler={sampler}
        version={mask ? 1 : 0}
        overlay={(ctx, proj, jd, size) => {
          const s = subsolarPoint(jd);
          const p = proj.toScreen(s.latitude, s.longitude);
          const cx = size / 2, R = size / 2;
          if (p.depth > 0) {
            ctx.beginPath(); ctx.arc(cx + p.u * R, cx - p.v * R, 6, 0, 7); ctx.fillStyle = '#fff3b0'; ctx.fill();
            ctx.strokeStyle = 'rgba(255,200,60,0.9)'; ctx.lineWidth = 2; ctx.stroke();
          }
          const grad = ctx.createRadialGradient(cx, cx, R * 0.97, cx, cx, R * 1.0);
          grad.addColorStop(0, 'rgba(120,180,255,0)'); grad.addColorStop(1, 'rgba(120,180,255,0.35)');
          ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cx, R, 0, 7); ctx.fill();
        }}
      />
      <Box>
        <Text fontFamily="heading" fontSize="2xl" fontWeight={700}>Earth</Text>
        <Text color="content.secondary" mb={3}>Drag to turn the globe. The yellow dot is where the Sun is straight overhead right now.</Text>
        <SimpleGrid columns={2} spacing={3}>
          <Fact label="Sun overhead" value={`${Math.abs(sp.latitude).toFixed(2)}°${sp.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(sp.longitude).toFixed(2)}°${sp.longitude >= 0 ? 'E' : 'W'}`} />
          <Fact label="Axial tilt" value={`${obliquityDegrees(snap.jd).toFixed(3)}°`} />
          <Fact label="Sidereal time (Greenwich)" value={hours(gmstDegrees(snap.jd))} />
          <Fact label="Sun’s distance" value={`${sunPosition(snap.jd).distanceAu.toFixed(4)} AU`} />
          {moon && <Fact label="Moon" value={`${moon.phaseName}, ${(moon.illumination * 100).toFixed(0)}% lit`} />}
          {moon && <Fact label="Moon distance" value={`${Math.round(moon.distanceKm).toLocaleString('en-US')} km`} />}
        </SimpleGrid>
        {climate.applicable && (
          <Box mt={4} p={3} border="1px solid" borderColor="line.subtle" borderRadius="lg" bg="surface.inset">
            <Badge colorScheme="purple" mb={1}>Ice age · schematic</Badge>
            <Text fontWeight={600}>{climate.label}</Text>
            <Text fontSize="sm" color="content.secondary">
              About {Math.round(climate.kaBp * 1000).toLocaleString('en-US')} years before 1950 · sea level {climate.seaLevel >= 0 ? '+' : '−'}{Math.abs(Math.round(climate.seaLevel))} m · ice {Math.round(climate.iceFraction * 100)}% of its maximum.
            </Text>
            <Text fontSize="xs" color="content.muted" mt={1}>Ice edges are drawn from a sea-level curve, not mapped. Coastlines are today’s: exposed continental shelf is not drawn.</Text>
          </Box>
        )}
        {c.year < -271000 || c.year > 271000 ? <Text fontSize="sm" color="content.muted" mt={3}>Earth’s orientation is not modelled this far from today.</Text> : null}
      </Box>
    </SimpleGrid>
  );
}

const jd2ka = (jd: number) => (2000 - (2000 + (jd - 2451545) / 365.25)) / 1000 + 0.05;

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="xs" color="content.muted" textTransform="uppercase" letterSpacing="0.06em">{label}</Text>
      <Text fontWeight={600}>{value}</Text>
    </Box>
  );
}
