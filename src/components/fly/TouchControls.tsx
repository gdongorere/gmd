// src/components/fly/TouchControls.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Flex, Text } from '@chakra-ui/react';
import type { FlightInput } from '@/lib/fly/sim/flight';

const RADIUS = 52; // px of stick travel

/** A virtual stick: reports x, y in −1…1 (y positive = down the screen) while a pointer is held on it, and 0 when released. */
function Stick({ label, onChange, testId }: { label: string; onChange: (x: number, y: number) => void; testId: string }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const id = useRef<number | null>(null);
  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS; }
    setKnob({ x: dx, y: dy });
    const dead = (v: number) => (Math.abs(v) < 0.08 ? 0 : v);
    onChange(dead(dx / RADIUS), dead(dy / RADIUS));
  };
  const end = () => { id.current = null; setKnob({ x: 0, y: 0 }); onChange(0, 0); };
  return (
    <Box
      ref={base} role="group" aria-label={label} data-testid={testId}
      position="relative" w="140px" h="140px" borderRadius="full" bg="rgba(8,10,20,0.35)" border="2px solid rgba(255,255,255,0.28)" style={{ touchAction: 'none', userSelect: 'none' }}
      onPointerDown={(e) => { if (id.current !== null) return; id.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); update(e); }}
      onPointerMove={(e) => { if (e.pointerId === id.current) update(e); }}
      onPointerUp={(e) => { if (e.pointerId === id.current) end(); }}
      onPointerCancel={(e) => { if (e.pointerId === id.current) end(); }}
    >
      <Box position="absolute" left="50%" top="50%" w="56px" h="56px" borderRadius="full" bg="rgba(255,255,255,0.55)" border="2px solid rgba(255,255,255,0.8)" pointerEvents="none" style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
      <Text position="absolute" bottom="-18px" left={0} right={0} textAlign="center" fontSize="10px" color="rgba(255,255,255,0.7)" pointerEvents="none">{label}</Text>
    </Box>
  );
}

/** A button that is "on" only while pressed. */
function Hold({ label, onChange, testId, children }: { label: string; onChange: (on: boolean) => void; testId: string; children: React.ReactNode }) {
  return (
    <Button
      aria-label={label} data-testid={testId} w="68px" h="68px" borderRadius="full" bg="rgba(8,10,20,0.45)" border="2px solid rgba(255,255,255,0.35)" color="white" fontSize="24px"
      style={{ touchAction: 'none', userSelect: 'none' }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onChange(true); }}
      onPointerUp={() => onChange(false)} onPointerCancel={() => onChange(false)} onContextMenu={(e) => e.preventDefault()}
    >{children}</Button>
  );
}

export interface TouchActions { gear: () => void; view: () => void; respawn: () => void }

/**
 * On-screen flight controls for touch devices: left stick = thrust (up/down) and strafe, right stick = yaw and pitch, a climb/descend pair,
 * roll buttons, and small action buttons. Writes straight into `input` (a ref the flight loop reads every frame).
 */
export default function TouchControls({ input, actions }: { input: React.MutableRefObject<FlightInput>; actions: () => TouchActions | null }) {
  const set = (patch: Partial<FlightInput>) => { Object.assign(input.current, patch); };
  const up = useRef(false), down = useRef(false), rl = useRef(false), rr = useRef(false);
  const collective = () => set({ collective: (up.current ? 1 : 0) - (down.current ? 1 : 0) });
  const roll = () => set({ roll: (rr.current ? 1 : 0) - (rl.current ? 1 : 0) });
  useEffect(() => () => { Object.assign(input.current, { collective: 0, forward: 0, strafe: 0, yaw: 0, pitch: 0, roll: 0 }); }, [input]);
  return (
    <Box position="absolute" inset={0} pointerEvents="none" data-testid="touch-controls">
      <Flex position="absolute" left="max(16px, env(safe-area-inset-left))" bottom="max(34px, env(safe-area-inset-bottom))" pointerEvents="auto"><Stick label="Thrust · strafe" testId="stick-left" onChange={(x, y) => set({ strafe: x, forward: -y })} /></Flex>
      <Flex position="absolute" right="max(16px, env(safe-area-inset-right))" bottom="max(34px, env(safe-area-inset-bottom))" pointerEvents="auto"><Stick label="Turn · pitch" testId="stick-right" onChange={(x, y) => set({ yaw: x, pitch: y })} /></Flex>
      <Flex position="absolute" right="max(172px, calc(env(safe-area-inset-right) + 172px))" bottom="max(34px, env(safe-area-inset-bottom))" direction="column" gap={2} pointerEvents="auto">
        <Hold label="Climb" testId="btn-climb" onChange={(on) => { up.current = on; collective(); }}>▲</Hold>
        <Hold label="Descend" testId="btn-descend" onChange={(on) => { down.current = on; collective(); }}>▼</Hold>
      </Flex>
      <Flex position="absolute" left="max(172px, calc(env(safe-area-inset-left) + 172px))" bottom="max(34px, env(safe-area-inset-bottom))" direction="column" gap={2} pointerEvents="auto">
        <Hold label="Roll right" testId="btn-roll-right" onChange={(on) => { rr.current = on; roll(); }}>↻</Hold>
        <Hold label="Roll left" testId="btn-roll-left" onChange={(on) => { rl.current = on; roll(); }}>↺</Hold>
      </Flex>
      <Flex position="absolute" top="max(12px, env(safe-area-inset-top))" right="max(12px, env(safe-area-inset-right))" gap={2} pointerEvents="auto">
        <Button size="sm" variant="glass" onClick={() => actions()?.view()} data-testid="btn-view">View</Button>
        <Button size="sm" variant="glass" onClick={() => actions()?.gear()} data-testid="btn-gear">Gear</Button>
        <Button size="sm" variant="glass" onClick={() => actions()?.respawn()} data-testid="btn-respawn">Reset</Button>
      </Flex>
    </Box>
  );
}
