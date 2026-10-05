// src/components/galaxy/explore/ExploreHud.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text } from '@chakra-ui/react';
import { ARMS, ARM_PHASE_OFFSET, GALAXY } from '@/lib/galaxy/constants';
import { cameraPosition, niceScale } from '@/lib/galaxy/explore';
import type { CameraPose } from '@/lib/galaxy/camera';
import { galaxyBus } from '@/lib/galaxy/bus';

/** Polls the engine a few times a second for the readouts that change continuously. */
export function useEngineReadout() {
  const [state, setState] = useState<{ myr: number; distLy: number; pose: CameraPose | null }>({ myr: 0, distLy: 1e5, pose: null });
  useEffect(() => {
    const id = window.setInterval(() => {
      const api = galaxyBus.api;
      if (api) setState({ myr: api.elapsedMyr(), distLy: api.cameraDistanceLy(), pose: api.pose() });
    }, 250);
    return () => window.clearInterval(id);
  }, []);
  return state;
}

// --- Scale bar ----------------------------------------------------------------

export function ScaleBar({ distLy }: { distLy: number }) {
  const [h, setH] = useState(800);
  useEffect(() => {
    const update = () => setH(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  // Vertical field of view is 50°, so the visible height at the target is 2·d·tan(25°).
  const pxPerLy = h / (2 * distLy * Math.tan((25 * Math.PI) / 180));
  const { ly, px } = niceScale(pxPerLy, 140);
  return (
    <Box aria-label={`Scale: ${ly.toLocaleString()} light-years`} role="img">
      <Box h="8px" w={`${px}px`} borderX="2px solid" borderBottom="2px solid" borderColor="whiteAlpha.800" />
      <Text fontSize="xs" color="content.secondary" mt={0.5}>{ly.toLocaleString()} ly</Text>
    </Box>
  );
}

// --- Mini-map -----------------------------------------------------------------

const S = 54 / GALAXY.diskRadius;
// Same convention as the face-on view: the Sun sits at the bottom, galactic rotation is clockwise.
const toSvg = (x: number, z: number): [number, number] => [-z * S, x * S];

const ARM_PATHS = ARMS.map((arm) => {
  const k = Math.tan(GALAXY.armPitch);
  const pts: string[] = [];
  for (let r = arm.rStart; r <= arm.rEnd; r += 8) {
    const theta = ARM_PHASE_OFFSET + arm.phase + Math.log(r / GALAXY.sagittariusRadiusAtSun) / k;
    const [px, py] = toSvg(r * Math.cos(theta), -r * Math.sin(theta));
    pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  return { name: arm.name, d: `M${pts.join(' L')}`, major: arm.oldWeight > 0 };
});

export function MiniMap({ pose }: { pose: CameraPose | null }) {
  const bar = useMemo(() => {
    const half = GALAXY.barHalfLength;
    const a = GALAXY.barAngle;
    const [x1, y1] = toSvg(half * Math.cos(a), -half * Math.sin(a));
    const [x2, y2] = toSvg(-half * Math.cos(a), half * Math.sin(a));
    return { x1, y1, x2, y2 };
  }, []);
  const [sunX, sunY] = toSvg(GALAXY.sunRadius, 0);

  let cam: { x: number; y: number; tx: number; ty: number } | null = null;
  if (pose) {
    const [cx, , cz] = cameraPosition(pose);
    let [x, y] = toSvg(cx, cz);
    const r = Math.hypot(x, y);
    if (r > 56) { x = (x / r) * 56; y = (y / r) * 56; }
    const [tx, ty] = toSvg(pose.targetX, pose.targetZ);
    cam = { x, y, tx, ty };
  }

  return (
    <Box
      role="img"
      aria-label="Mini-map of the galaxy from above with your camera position"
      bg="surface.glass"
      border="1px solid"
      borderColor="line.subtle"
      borderRadius="full"
      backdropFilter="blur(10px)"
      boxSize="132px"
      overflow="hidden"
    >
      <svg viewBox="-62 -62 124 124" width="100%" height="100%">
        <circle r={54} fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.18)" />
        {ARM_PATHS.map((arm) => (
          <path key={arm.name} d={arm.d} fill="none" stroke={arm.major ? 'rgba(150,180,255,0.75)' : 'rgba(150,180,255,0.4)'} strokeWidth={arm.major ? 2 : 1.2} />
        ))}
        <line x1={bar.x1} y1={bar.y1} x2={bar.x2} y2={bar.y2} stroke="rgba(255,200,140,0.9)" strokeWidth={3.5} strokeLinecap="round" />
        <circle r={2.2} fill="#FFB27A" />
        <circle cx={sunX} cy={sunY} r={2.4} fill="#7FE0FF" />
        {cam && (
          <>
            <line x1={cam.x} y1={cam.y} x2={cam.tx} y2={cam.ty} stroke="rgba(255,122,69,0.9)" strokeWidth={1} strokeDasharray="2 2" />
            <circle cx={cam.x} cy={cam.y} r={3.4} fill="#FF7A45" stroke="#fff" strokeWidth={0.8} />
          </>
        )}
      </svg>
    </Box>
  );
}
