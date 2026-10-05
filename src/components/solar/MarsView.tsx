// src/components/solar/MarsView.tsx
'use client';

import React from 'react';
import { Badge, Box, Button, HStack, SimpleGrid, Text } from '@chakra-ui/react';
import { GlobeCanvas } from './GlobeCanvas';
import { Fact } from './EarthView';
import { useSimClock } from './useSimClock';
import { DATED_STORMS, dustLevel, isDustSeason, marsConfidence, marsSeason, marsYearAt, nearestStorm, stormAt } from '@/lib/astro/mars';
import { localSolarTime, marsOrientation } from '@/lib/astro/globe';
import { MARS_LABELS, marsDarkness, northCapEdge, southCapEdge } from '@/lib/astro/marsMap';
import { simClock } from '@/lib/astro/clock';
import { calendarFromJd, formatDateHuman } from '@/lib/astro/julian';
import { smoothstep } from '@/lib/astro/render';
import type { Sampler } from '@/lib/astro/render';

const clockHM = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;

export function MarsView() {
  const snap = useSimClock(500);
  const m = marsOrientation(snap.jd);
  const storm = stormAt(snap.jd);
  const dust = dustLevel(snap.jd);
  const conf = marsConfidence(snap.jd);
  const prev = nearestStorm(snap.jd, -1);
  const next = nearestStorm(snap.jd, 1);
  const go = (jd: number) => { simClock().setJd(jd); simClock().setPlaying(true); simClock().setRate(1); };

  const sampler = (jd: number): Sampler => {
    const ori = marsOrientation(jd);
    const dustNow = dustLevel(jd);
    const nEdge = northCapEdge(ori.ls), sEdge = southCapEdge(ori.ls);
    return (lat, lon, light, out) => {
      const day = smoothstep(-0.04, 0.12, light);
      const lit = Math.max(0, light);
      const d = marsDarkness(lat, lon);
      let r = 188, g = 108, b = 66;
      if (d > 0) { r += (86 - r) * 0.6 * d; g += (54 - g) * 0.6 * d; b += (42 - b) * 0.6 * d; }
      else { r += (222 - r) * -d * 0.55; g += (160 - g) * -d * 0.55; b += (112 - b) * -d * 0.55; }
      // Dust veils the surface: haze colour in, contrast out.
      const haze = dustNow * 0.88;
      r += (214 - r) * haze; g += (166 - g) * haze; b += (118 - b) * haze;
      const cap = Math.max(smoothstep(nEdge - 1, nEdge + 1, lat), smoothstep(sEdge + 1, sEdge - 1, lat));
      if (cap > 0) { const k = cap * (1 - haze * 0.5); r += (244 - r) * k; g += (240 - g) * k; b += (238 - b) * k; }
      const shade = 0.03 + 0.97 * day * (0.3 + 0.7 * lit);
      out[0] = r * shade; out[1] = g * shade * 0.97; out[2] = b * shade * 0.95;
    };
  };

  return (
    <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6} alignItems="center">
      <GlobeCanvas
        ariaLabel={`Mars at the selected time: solar longitude ${m.ls.toFixed(1)} degrees, ${marsSeason(m.ls)}. ${storm ? `${storm.label} is under way.` : 'No catalogued global dust storm.'} Drag to rotate.`}
        subsolar={(jd) => marsOrientation(jd).subsolar}
        sampler={sampler}
        overlay={(ctx, proj, _jd, size) => {
          const cx = size / 2, R = size / 2;
          ctx.font = '600 11px system-ui, sans-serif';
          ctx.textBaseline = 'middle';
          for (const l of MARS_LABELS) {
            const p = proj.toScreen(l.lat, l.lon);
            if (p.depth < 0.3) continue;
            const x = cx + p.u * R, y = cx - p.v * R;
            ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
            const w = ctx.measureText(l.name).width;
            if (x + 6 + w > size - 4) { ctx.textAlign = 'right'; ctx.fillText(l.name, x - 6, y); ctx.textAlign = 'left'; } else ctx.fillText(l.name, x + 6, y);
            ctx.shadowBlur = 0;
          }
          const grad = ctx.createRadialGradient(cx, cx, R * 0.96, cx, cx, R);
          grad.addColorStop(0, 'rgba(230,170,110,0)'); grad.addColorStop(1, 'rgba(230,170,110,0.28)');
          ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(cx, cx, R, 0, 7); ctx.fill();
        }}
      />
      <Box>
        <HStack spacing={3} mb={1}>
          <Text fontFamily="heading" fontSize="2xl" fontWeight={700}>Mars</Text>
          {storm ? <Badge colorScheme="orange">Dust storm</Badge> : isDustSeason(m.ls) ? <Badge colorScheme="yellow">Dust-storm season</Badge> : <Badge>Clear season</Badge>}
        </HStack>
        <Text color="content.secondary" mb={3}>
          Jump to a real storm, then run time forward and watch the surface disappear. The surface is a schematic: well-known bright and dark regions placed by hand, not a photograph. Storm onsets (Mars Year and Ls) are recalled from the literature and not yet independently verified.
        </Text>
        <SimpleGrid columns={2} spacing={3}>
          <Fact label="Season (Ls)" value={`${m.ls.toFixed(1)}° · ${marsSeason(m.ls)}`} />
          <Fact label="Mars Year" value={`MY ${marsYearAt(snap.jd)}`} />
          <Fact label="Time at 0° (MTC)" value={clockHM(m.mtc)} />
          <Fact label="Dust opacity" value={`${Math.round(dust * 100)}%`} />
          <Fact label="Local time at Gale Crater" value={clockHM(localSolarTime(137.4, m.subsolar.lon))} />
          <Fact label="Local time at Jezero" value={clockHM(localSolarTime(77.5, m.subsolar.lon))} />
        </SimpleGrid>
        {storm && (
          <Box mt={4} p={3} border="1px solid" borderColor="orange.400" borderRadius="lg" bg="surface.inset">
            <Text fontWeight={700}>{storm.label}</Text>
            <Text fontSize="sm" color="content.secondary">{storm.summary}</Text>
            <Text fontSize="xs" color="content.muted" mt={1}>Observed by {storm.observer}. Onset {formatDateHuman(calendarFromJd(storm.startJd))} (Mars Year {storm.marsYear}, Ls {storm.onsetLs}°).</Text>
          </Box>
        )}
        <HStack mt={4} spacing={2} wrap="wrap">
          <Button size="sm" variant="outline" isDisabled={!prev} onClick={() => prev && go(prev.startJd)}>← Previous storm{prev ? ` (${calendarFromJd(prev.startJd).year})` : ''}</Button>
          <Button size="sm" variant="outline" isDisabled={!next} onClick={() => next && go(next.startJd)}>Next storm{next ? ` (${calendarFromJd(next.startJd).year})` : ''} →</Button>
        </HStack>
        <Text fontSize="xs" color="content.muted" mt={3}>
          {conf === 'documented' ? `Storms shown are the ${DATED_STORMS.length} global storms observed by spacecraft since 1971.` : conf === 'seasonal-model' ? 'Season is modelled; real storms cannot be predicted (about one Mars year in three has a global one).' : 'Outside 1874–2100 the Mars season drifts; no storms can be known.'}
        </Text>
      </Box>
    </SimpleGrid>
  );
}
