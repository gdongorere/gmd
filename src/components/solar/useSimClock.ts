// src/components/solar/useSimClock.ts
'use client';

import { useEffect, useState } from 'react';
import { simClock, type ClockSnapshot } from '@/lib/astro/clock';

/** Re-renders at `intervalMs` (and instantly on any clock command) with the current simulated time. */
export function useSimClock(intervalMs = 250): ClockSnapshot {
  const clock = simClock();
  const [snap, setSnap] = useState<ClockSnapshot>(() => clock.snapshot());
  useEffect(() => {
    const update = () => setSnap((prev) => {
      const next = clock.snapshot();
      return prev.jd === next.jd && prev.rate === next.rate && prev.playing === next.playing && prev.live === next.live ? prev : next;
    });
    update();
    const id = window.setInterval(update, intervalMs);
    const off = clock.subscribe(update);
    return () => { window.clearInterval(id); off(); };
  }, [clock, intervalMs]);
  return snap;
}

/** Viewer's IANA time zone and a longitude estimate (15° per hour of UTC offset) for local mean solar time. */
export function useViewerZone() {
  const [zone, setZone] = useState({ name: 'UTC', longitude: 0 });
  useEffect(() => {
    try {
      const name = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      setZone({ name, longitude: -new Date().getTimezoneOffset() / 4 });
    } catch { /* keep UTC */ }
  }, []);
  return zone;
}
