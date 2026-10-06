// src/components/fly/FlyApp.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Hangar from './Hangar';
import FlightArena from './FlightArena';
import EarthFlight from './EarthFlight';

type Mode = 'hangar' | 'arena' | 'earth';

/** /fly shows the hangar (inspect the ship), the test arena, or the real Earth (`?mode=earth`, optionally `&place=` or `&lat=&lon=`). */
export default function FlyApp() {
  const [mode, setMode] = useState<Mode>('hangar');
  useEffect(() => { const m = new URLSearchParams(window.location.search).get('mode'); if (m === 'arena' || m === 'earth') setMode(m); }, []);
  const go = (m: Mode) => { setMode(m); try { const u = new URL(window.location.href); if (m === 'hangar') { u.search = ''; } else u.searchParams.set('mode', m); window.history.replaceState(null, '', u); } catch { /* ignore */ } };
  if (mode === 'earth') return <EarthFlight onBack={() => go('hangar')} />;
  if (mode === 'arena') return <FlightArena onBack={() => go('hangar')} />;
  return <Hangar onFly={() => go('arena')} onEarth={() => go('earth')} />;
}
