// src/components/solar/SunInGalaxy.tsx
'use client';

import React from 'react';
import { Box, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { Fact } from './EarthView';
import { useSimClock } from './useSimClock';
import {
  CONSTANT_SOURCES, CONSTANTS_PROVENANCE_NOTE, SUN_GALAXY, SUN_ORBIT_MYR, SUN_TOTAL_SPEED, sunDistanceLy, sunDistanceUncertaintyLy, sunHeightLy, sunHeightPc,
} from '@/lib/astro/galaxySun';
import { DAYS_PER_YEAR, J2000 } from '@/lib/astro/julian';

const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

export function SunInGalaxy() {
  const snap = useSimClock(1000);
  const years = (snap.jd - J2000) / DAYS_PER_YEAR;
  const lapsSinceJ2000 = years / (SUN_ORBIT_MYR * 1e6);
  const zNow = sunHeightPc(years - (Date.now() / 86400000 + 2440587.5 - J2000) / DAYS_PER_YEAR); // relative to today's z0

  // Diagram A: Sgr A* → Sun to scale along the line of sight.
  const W = 640, x0 = 56, x1 = W - 56;
  const barPx = Math.max(6, ((2 * sunDistanceUncertaintyLy()) / sunDistanceLy()) * (x1 - x0));

  // Diagram B: height above the plane across ±150 Myr.
  const pts: string[] = [];
  const H = 160;
  for (let t = -150; t <= 150; t += 2) {
    const z = sunHeightPc(t * 1e6);
    pts.push(`${(40 + ((t + 150) / 300) * (W - 80)).toFixed(1)},${(H / 2 - z * 0.55).toFixed(1)}`);
  }
  const nowX = 40 + (150 / 300) * (W - 80);

  return (
    <Stack spacing={6}>
      <Box>
        <Text fontFamily="heading" fontSize="2xl" fontWeight={700}>The Sun in the Milky Way</Text>
        <Text color="content.secondary">
          {fmt(sunDistanceLy())} ± {fmt(sunDistanceUncertaintyLy())} light-years from the black hole Sagittarius A*, about {sunHeightLy().toFixed(0)} light-years north of the galactic plane,
          moving at about {SUN_TOTAL_SPEED.toFixed(0)} km/s around a {SUN_ORBIT_MYR.toFixed(0)}-million-year lap.
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4}>
        <Fact label="Distance to Sgr A*" value={`${fmt(sunDistanceLy())} ly`} />
        <Fact label="Height above plane" value={`${sunHeightLy().toFixed(0)} ly`} />
        <Fact label="Orbital speed" value={`${SUN_TOTAL_SPEED.toFixed(0)} km/s`} />
        <Fact label="Laps since the Sun formed" value={(lapsSinceJ2000 + 4.6e9 / (SUN_ORBIT_MYR * 1e6)).toFixed(2)} />
      </SimpleGrid>

      <Box>
        <Text fontWeight={600} mb={1}>To scale: Sagittarius A* to the Sun</Text>
        <svg viewBox={`0 0 ${W} 120`} width="100%" role="img" aria-label={`Sagittarius A star on the left and the Sun on the right, ${fmt(sunDistanceLy())} light-years apart.`}>
          <line x1={x0} y1={60} x2={x1} y2={60} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
          <circle cx={x0} cy={60} r={9} fill="#111" stroke="#ffb27a" strokeWidth={2} />
          <circle cx={x1} cy={60} r={5} fill="#fff3b0" stroke="#ffc13b" strokeWidth={2} />
          <rect x={x1 - barPx / 2} y={74} width={barPx} height={6} fill="#7fe0ff" rx={2} />
          <text x={x0} y={92} textAnchor="middle" fill="#fff" fontSize="12">Sgr A*</text>
          <text x={x1} y={92} textAnchor="middle" fill="#fff" fontSize="12">Sun</text>
          <text x={(x0 + x1) / 2} y={50} textAnchor="middle" fill="#cfd8ff" fontSize="13">{fmt(sunDistanceLy())} ly</text>
          <text x={x1 + 40} y={108} textAnchor="end" fill="#7fe0ff" fontSize="11">±{fmt(sunDistanceUncertaintyLy())} ly (bar widened to be visible)</text>
        </svg>
      </Box>

      <Box>
        <Text fontWeight={600} mb={1}>Bobbing through the disk</Text>
        <Text fontSize="sm" color="content.secondary" mb={1}>The Sun crosses the galactic plane every ~{(SUN_GALAXY.verticalPeriodMyr.value / 2).toFixed(0)} million years. Now: {sunHeightPc(0).toFixed(1)} pc above it, rising.</Text>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Height of the Sun above the galactic plane from 150 million years ago to 150 million years from now.">
          <line x1={40} y1={H / 2} x2={W - 40} y2={H / 2} stroke="rgba(255,255,255,0.35)" />
          <polyline points={pts.join(' ')} fill="none" stroke="#7fe0ff" strokeWidth={2} />
          <line x1={nowX} y1={10} x2={nowX} y2={H - 10} stroke="#ffc13b" strokeDasharray="3 3" />
          <text x={nowX + 6} y={20} fill="#ffc13b" fontSize="11">today</text>
          <text x={40} y={H - 6} fill="#cfd8ff" fontSize="11">−150 Myr</text>
          <text x={W - 40} y={H - 6} textAnchor="end" fill="#cfd8ff" fontSize="11">+150 Myr</text>
          <text x={44} y={14} fill="#cfd8ff" fontSize="11">north</text>
        </svg>
        <Text fontSize="xs" color="content.muted">Simple harmonic approximation fitted to today’s height and vertical speed; the amplitude (~100 pc) depends on the local disk density.</Text>
      </Box>

      <Box>
        <Text fontWeight={600} mb={2}>Where these numbers come from</Text>
        <Stack spacing={2} as="ul" listStyleType="none" m={0} p={0}>
          {CONSTANT_SOURCES.filter((s) => 'value' in s).map((s) => {
            const v = s as unknown as { key: string; value: number; plus: number; minus: number; unit: string; source: string };
            return (
              <Box as="li" key={v.key} fontSize="sm">
                <Text as="span" fontWeight={600}>{LABELS[v.key] ?? v.key}: </Text>
                {v.value} {v.plus === v.minus ? `± ${v.plus}` : `+${v.plus}/−${v.minus}`} {v.unit}
                <Text as="span" color="content.muted"> — {v.source}</Text>
              </Box>
            );
          })}
          <Box as="li" fontSize="sm">
            <Text as="span" fontWeight={600}>Solar motion (U, V, W): </Text>
            {SUN_GALAXY.peculiar.U}, {SUN_GALAXY.peculiar.V}, {SUN_GALAXY.peculiar.W} km/s
            <Text as="span" color="content.muted"> — {SUN_GALAXY.peculiar.source}</Text>
          </Box>
        </Stack>
        <Text fontSize="xs" color="content.muted" mt={3}>{CONSTANTS_PROVENANCE_NOTE}</Text>
        <Text fontSize="xs" color="content.muted" mt={2}>
          Lap time and speed follow from Sgr A*’s reflex proper motion ({SUN_GALAXY.omegaMasPerYr.value} mas/yr). Older papers give 220–230 km/s and 225–250 Myr; the newer, more precise values are used here.
        </Text>
      </Box>
      <span hidden>{zNow}</span>
    </Stack>
  );
}

const LABELS: Record<string, string> = {
  R0: 'Distance to Sgr A*', z0: 'Height above the plane', omegaMasPerYr: 'Sgr A* proper motion', theta0: 'Circular speed at the Sun',
  barPattern: 'Bar pattern speed', armPattern: 'Spiral pattern speed', barAngle: 'Bar angle', verticalPeriodMyr: 'Vertical oscillation period',
};
