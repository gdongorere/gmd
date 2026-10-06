// src/components/fly/FlyApp.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Hangar from './Hangar';
import FlightArena from './FlightArena';

/** /fly shows the hangar (inspect the ship) or the flight arena (fly it in first or third person). `?mode=arena` opens the arena directly. */
export default function FlyApp() {
  const [mode, setMode] = useState<'hangar' | 'arena'>('hangar');
  useEffect(() => { if (new URLSearchParams(window.location.search).get('mode') === 'arena') setMode('arena'); }, []);
  const go = (m: 'hangar' | 'arena') => { setMode(m); try { const u = new URL(window.location.href); if (m === 'arena') u.searchParams.set('mode', 'arena'); else u.searchParams.delete('mode'); window.history.replaceState(null, '', u); } catch { /* ignore */ } };
  return mode === 'arena' ? <FlightArena onBack={() => go('hangar')} /> : <Hangar onFly={() => go('arena')} />;
}
