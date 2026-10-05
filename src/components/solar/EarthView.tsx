// src/components/solar/EarthView.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Box, Checkbox, Flex, SimpleGrid, Text } from '@chakra-ui/react';
import { GlobeCanvas } from './GlobeCanvas';
import { useSimClock } from './useSimClock';
import { subsolarPoint, obliquityDegrees, sunPosition, sunModel, equationOfTimeMinutes, nutation, solarElevation } from '@/lib/astro/earth';
import { gmstDegrees } from '@/lib/astro/time';
import { climateAt, iceCover, iceEdgeLatitudes, kaBpFromJd } from '@/lib/astro/climate';
import { eclipseNear, moonState, yearEvents } from '@/lib/astro/planets';
import { MoonDisc } from './MoonDisc';
import { calendarFromJd, jdFromDecimalYear } from '@/lib/astro/julian';
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
  const [mask, setMask] = useState<{ land: Uint8Array; widened: Uint8Array | null } | null>(null);
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
        // A uniformly widened coastline (≈ 100–130 km) as a stand-in for the exposed shelf. No bathymetry dataset
        // is available offline, so this is a schematic: real shelves range from almost none to over 1,000 km wide.
        const c2 = document.createElement('canvas');
        c2.width = MW; c2.height = MH;
        const g2 = c2.getContext('2d');
        let widened: Uint8Array | null = null;
        if (g2) {
          g2.filter = 'blur(3px)';
          g2.drawImage(c, 0, 0);
          const px2 = g2.getImageData(0, 0, MW, MH).data;
          widened = new Uint8Array(MW * MH);
          for (let i = 0; i < widened.length; i++) widened[i] = px2[i * 4 + 3] > 12 ? 255 : 0;
        }
        if (alive) setMask({ land: m, widened });
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
/** Scratch result reused across calls: this runs per land pixel, so it must not allocate. */
const LAND_RGB: [number, number, number] = [0, 0, 0];
function landColour(a: number): [number, number, number] {
  for (let i = 1; i < PALETTE.length; i++) {
    if (a <= PALETTE[i][0]) {
      const p0 = PALETTE[i - 1], p1 = PALETTE[i];
      const t = (a - p0[0]) / (p1[0] - p0[0]);
      LAND_RGB[0] = p0[1] + (p1[1] - p0[1]) * t;
      LAND_RGB[1] = p0[2] + (p1[2] - p0[2]) * t;
      LAND_RGB[2] = p0[3] + (p1[3] - p0[3]) * t;
      return LAND_RGB;
    }
  }
  const l = PALETTE[PALETTE.length - 1];
  LAND_RGB[0] = l[1]; LAND_RGB[1] = l[2]; LAND_RGB[2] = l[3];
  return LAND_RGB;
}

/** Equation of time as ±Mm SSs, rounding whole seconds first so it never reads 60s. */
const fmtEot = (m: number) => { const t = Math.round(Math.abs(m) * 60); return `${m >= 0 ? '+' : '−'}${Math.floor(t / 60)}m ${String(t % 60).padStart(2, '0')}s`; };
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');
const hours = (deg: number) => { const h = deg / 15; return `${Math.floor(h)}h ${String(Math.floor((h % 1) * 60)).padStart(2, '0')}m`; };

export function EarthView() {
  const mask = useLandMask();
  const snap = useSimClock(500);
  const sp = subsolarPoint(snap.jd);
  const climate = useMemo(() => climateAt(snap.jd), [snap.jd]);
  const moon = moonState(snap.jd);
  const c = calendarFromJd(snap.jd);
  const eclipseKey = Math.round(snap.jd * 96); // 15-minute buckets: the search is not free
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const eclipse = useMemo(() => eclipseNear(snap.jd), [eclipseKey]);
  const events = useMemo(() => yearEvents(c.year), [c.year]);
  const eot = equationOfTimeMinutes(snap.jd);
  const nut = nutation(snap.jd);
  const model = sunModel(snap.jd);
  const [shelf, setShelf] = useState(false);
  const maskRef = useRef(mask);
  maskRef.current = mask;
  const shelfRef = useRef(shelf);
  shelfRef.current = shelf;

  const sampler = (jd: number): Sampler => {
    const f = climateAt(jd).iceFraction;
    const edge = iceEdgeLatitudes(kaBpFromJd(jd));
    const m = maskRef.current;
    return (lat, lon, light, out) => {
      const day = smoothstep(-0.12, 0.2, light);
      const lit = Math.max(0, light);
      let r: number, g: number, b: number;
      let cov = m ? landCoverage(m.land, lat, lon) : 0;
      // Schematic exposed shelf: widened coastline, faded in as sea level falls.
      const shelfAmt = shelfRef.current && m?.widened ? Math.min(1, f * 1.2) : 0;
      let shelfCov = 0;
      if (shelfAmt > 0 && m?.widened && cov < 0.99) {
        shelfCov = landCoverage(m.widened, lat, lon) * shelfAmt * (1 - cov);
        cov += shelfCov;
      }
      // Ocean colour
      let or = 14 + 22 * lit, og = 54 + 52 * lit, ob = 112 + 62 * lit;
      const glint = Math.pow(lit, 24) * 60 * (1 - cov);
      or += glint; og += glint; ob += glint;
      if (Math.abs(lat) > 80 - f * 14) { or += (225 - or) * 0.8; og += (232 - og) * 0.8; ob += (240 - ob) * 0.8; }
      if (cov > 0.004) {
        const [lr0, lg0, lb0] = landColour(Math.abs(lat));
        let lr = lr0, lg = lg0, lb = lb0;
        if (shelfCov > 0) { const k = shelfCov / cov; lr += (178 - lr) * k; lg += (160 - lg) * k; lb += (112 - lb) * k; }
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
        version={(mask ? 1 : 0) + (shelf ? 2 : 0)}
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
          <Fact label="Equation of time" value={fmtEot(eot)} />
          <Fact label="Nutation (Δψ, Δε)" value={`${(nut.dPsi * 3600).toFixed(1)}″, ${(nut.dEps * 3600).toFixed(1)}″`} />
          <Fact label="Sun height at Greenwich" value={`${solarElevation(snap.jd, 51.4769, 0).toFixed(1)}° (no refraction)`} />
        </SimpleGrid>
        <Text fontSize="xs" color="content.muted" mt={2}>
          Sun position: {model === 'engine' ? 'astronomy-engine VSOP87, apparent place with nutation (1800–2200).' : 'low-precision Meeus series; accuracy degrades with distance from today.'}
        </Text>
        {moon && (
          <Flex mt={4} gap={4} align="center" p={3} border="1px solid" borderColor="line.subtle" borderRadius="lg" bg="surface.inset">
            <MoonDisc cycle={moon.cycle} />
            <Box>
              <Text fontWeight={600}>{moon.phaseName}</Text>
              <Text fontSize="sm" color="content.secondary">{(moon.illumination * 100).toFixed(0)}% lit · {Math.round(moon.distanceKm).toLocaleString('en-US')} km away</Text>
              {eclipse && (
                <Badge colorScheme={eclipse.type === 'solar' ? 'orange' : 'red'} mt={1} data-testid="eclipse-flag">
                  {eclipse.kind[0].toUpperCase() + eclipse.kind.slice(1)} {eclipse.type} eclipse {Math.abs(eclipse.hoursFromPeak) < 1 ? 'now' : eclipse.hoursFromPeak > 0 ? `in ${Math.round(eclipse.hoursFromPeak)} h` : `${Math.round(-eclipse.hoursFromPeak)} h ago`}
                </Badge>
              )}
            </Box>
          </Flex>
        )}
        {events && (
          <Box mt={4} p={3} border="1px solid" borderColor="line.subtle" borderRadius="lg" bg="surface.inset" data-testid="year-events">
            <Text fontWeight={600} mb={1}>{c.year}: seasons and orbit (UTC)</Text>
            <SimpleGrid columns={2} spacing={1} fontSize="sm">
              <Text>March equinox</Text><Text>{stamp(events.marchEquinox)}</Text>
              <Text>June solstice</Text><Text>{stamp(events.juneSolstice)}</Text>
              <Text>September equinox</Text><Text>{stamp(events.septEquinox)}</Text>
              <Text>December solstice</Text><Text>{stamp(events.decSolstice)}</Text>
              <Text>Perihelion</Text><Text>{events.perihelion !== null && events.perihelionAu !== null ? `${stamp(events.perihelion)} · ${events.perihelionAu.toFixed(4)} AU` : 'falls in a neighbouring year'}</Text>
              <Text>Aphelion</Text><Text>{events.aphelion !== null && events.aphelionAu !== null ? `${stamp(events.aphelion)} · ${events.aphelionAu.toFixed(4)} AU` : 'falls in a neighbouring year'}</Text>
            </SimpleGrid>
          </Box>
        )}
        {climate.applicable && (
          <Box mt={4} p={3} border="1px solid" borderColor="line.subtle" borderRadius="lg" bg="surface.inset">
            <Badge colorScheme="purple" mb={1}>Ice age · schematic</Badge>
            <Text fontWeight={600}>{climate.label}</Text>
            <Text fontSize="sm" color="content.secondary">
              About {Math.round(climate.kaBp * 1000).toLocaleString('en-US')} years before 1950 · sea level {climate.seaLevel >= 0 ? '+' : '−'}{Math.abs(Math.round(climate.seaLevel))} m · ice {Math.round(climate.iceFraction * 100)}% of its maximum.
            </Text>
            <Text fontSize="xs" color="content.muted" mt={1}>Ice edges are drawn from a sea-level curve, not mapped. Coastlines are today’s unless you switch on the schematic shelf below.</Text>
            <Checkbox mt={2} size="sm" isChecked={shelf} onChange={(e) => setShelf(e.target.checked)}>Show exposed shelf (schematic)</Checkbox>
            {shelf && <Text fontSize="xs" color="content.muted">Every coastline is widened by the same ≈ 100–130 km. That is an illustration, not bathymetry: the real shelf is far wider off Siberia and Southeast Asia and almost absent off the Pacific coast of the Americas.</Text>}
          </Box>
        )}
        <Milankovitch year={c.year} />
        {Math.abs(c.year) > 10000 ? <Text fontSize="sm" color="content.muted" mt={3}>Beyond ±10,000 years Earth’s tilt is held at its edge value and the orbit is not evolved, so the tilt and Sun distance above are approximate.</Text> : null}
      </Box>
    </SimpleGrid>
  );
}

export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="xs" color="content.muted" textTransform="uppercase" letterSpacing="0.06em">{label}</Text>
      <Text fontWeight={600}>{value}</Text>
    </Box>
  );
}

/** Axial tilt over ±10,000 years from the Laskar (1986) polynomial: the 41,000-year pacemaker of the ice ages. */
function Milankovitch({ year }: { year: number }) {
  const W = 320, H = 90, pad = 8;
  const span = 10000;
  const pts: string[] = [];
  const lo = 22.4, hi = 24.6;
  for (let y = -span; y <= span; y += 250) {
    const e = obliquityDegrees(jdFromDecimalYear(2000 + y));
    pts.push(`${(pad + ((y + span) / (2 * span)) * (W - 2 * pad)).toFixed(1)},${(H - pad - ((e - lo) / (hi - lo)) * (H - 2 * pad)).toFixed(1)}`);
  }
  const rel = Math.max(-span, Math.min(span, year - 2000));
  const nowX = pad + ((rel + span) / (2 * span)) * (W - 2 * pad);
  return (
    <Box mt={4} p={3} border="1px solid" borderColor="line.subtle" borderRadius="lg" bg="surface.inset" data-testid="milankovitch">
      <Text fontWeight={600} mb={1}>Earth’s tilt, ±10,000 years</Text>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Earth's axial tilt from 8000 BCE to 12000 CE, now ${obliquityDegrees(jdFromDecimalYear(year)).toFixed(2)} degrees. It peaks near 24.2 degrees around 8000 BCE and falls toward 22.6 degrees by 12000 CE.`}>
        <polyline points={pts.join(' ')} fill="none" stroke="#7fe0ff" strokeWidth={2} />
        <line x1={nowX} y1={4} x2={nowX} y2={H - 4} stroke="#ffc13b" strokeDasharray="3 3" />
        <text x={pad} y={H - 1} fill="#cfd8ff" fontSize="9">22.4°</text>
        <text x={pad} y={10} fill="#cfd8ff" fontSize="9">24.6°</text>
      </svg>
      <Text fontSize="xs" color="content.muted">
        In this window the tilt falls from about 24.2° (8000 BCE) to 22.6° (12000 CE), part of a 41,000-year cycle, changing how strongly the seasons bite at high latitudes, which is what paces the ice ages. The polynomial is only valid for ±10,000 years, so the 800,000-year ice-age curve above is not drawn from it. Orbital eccentricity and the precession of the seasons also matter; they are not shown because no checked series for them is available offline.
      </Text>
    </Box>
  );
}
