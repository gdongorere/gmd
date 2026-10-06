// src/components/input/usePad.ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { padHub, type PadFrame, type PadSummary } from '@/lib/input/hub';

/** Calls `onFrame` every animation frame while a gamepad is connected. The callback may change between renders without resubscribing. */
export function usePadFrames(onFrame: (f: PadFrame) => void, enabled = true) {
  const ref = useRef(onFrame);
  ref.current = onFrame;
  useEffect(() => {
    if (!enabled) return;
    return padHub.subscribe((f) => ref.current(f));
  }, [enabled]);
}

/** The connected pad (or null), updating when one connects, disconnects or is re-mapped. */
export function usePadStatus(): PadSummary | null {
  const [s, setS] = useState<PadSummary | null>(null);
  useEffect(() => padHub.onStatus(setS), []);
  return s;
}
