// src/components/fly/FlyApp.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Button, Flex, Text } from '@chakra-ui/react';
import Hangar from './Hangar';
import FlightArena from './FlightArena';
import EarthFlight from './EarthFlight';
import { useLandscape, useTouchDevice } from './useLandscape';

type Mode = 'hangar' | 'arena' | 'earth';

/**
 * /fly shows the hangar (inspect the ship), the test arena, or the real Earth (`?mode=earth`, optionally `&place=` or `&lat=&lon=`).
 * The whole page is a landscape, fullscreen experience: on phones the first tap enters fullscreen and locks landscape (where the browser
 * allows it), a portrait screen shows a "turn your phone" cover, and everywhere there is a fullscreen button (and the F key).
 */
export default function FlyApp() {
  const [mode, setMode] = useState<Mode>('hangar');
  const [full, setFull] = useState(false);
  const isTouch = useTouchDevice();
  const { portrait, goLandscape } = useLandscape(isTouch);

  useEffect(() => { const m = new URLSearchParams(window.location.search).get('mode'); if (m === 'arena' || m === 'earth') setMode(m); }, []);

  const toggleFull = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' } as FullscreenOptions); if (isTouch) await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {}); }
    } catch { /* the browser refused (iOS Safari on iPhone has no page fullscreen): nothing to do */ }
  }, [isTouch]);

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || (t && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName))) return;
      if (e.key === 'f' || e.key === 'F') void toggleFull();
    };
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('fullscreenchange', on); window.removeEventListener('keydown', key); };
  }, [toggleFull]);

  // On a phone, the first touch anywhere is the gesture the browser needs to allow fullscreen + orientation lock.
  useEffect(() => {
    if (!isTouch) return;
    const once = () => { void goLandscape(); };
    window.addEventListener('pointerdown', once, { once: true });
    return () => window.removeEventListener('pointerdown', once);
  }, [isTouch, goLandscape]);

  const go = (m: Mode) => { setMode(m); void (isTouch ? goLandscape() : Promise.resolve()); try { const u = new URL(window.location.href); if (m === 'hangar') { u.search = ''; } else u.searchParams.set('mode', m); window.history.replaceState(null, '', u); } catch { /* ignore */ } };

  return (
    <>
      {mode === 'earth' ? <EarthFlight onBack={() => go('hangar')} /> : mode === 'arena' ? <FlightArena onBack={() => go('hangar')} /> : <Hangar onFly={() => go('arena')} onEarth={() => go('earth')} />}
      <Button
        position="fixed" zIndex={30} size="sm" variant="glass" onClick={toggleFull} aria-pressed={full} aria-label={full ? 'Exit fullscreen' : 'Enter fullscreen'} data-testid="fullscreen-button"
        bottom={isTouch ? '10px' : '12px'} left={isTouch ? '50%' : undefined} right={isTouch ? undefined : '12px'} transform={isTouch ? 'translateX(-50%)' : undefined}
      >{full ? 'Exit fullscreen' : 'Fullscreen'}{isTouch ? '' : ' (F)'}</Button>
      {isTouch && portrait && (
        <Flex position="fixed" inset={0} zIndex={2000} bg="rgba(8,10,20,0.97)" direction="column" align="center" justify="center" gap={4} px={8} textAlign="center" data-testid="rotate-overlay">
          <Text fontSize="4xl" aria-hidden="true">⟳</Text>
          <Text fontWeight={700}>Turn your phone sideways to fly</Text>
          <Text fontSize="sm" color="content.secondary">Flying is a landscape, fullscreen experience.</Text>
          <Button colorScheme="orange" onClick={() => void toggleFull()} data-testid="go-landscape">Go landscape (fullscreen)</Button>
        </Flex>
      )}
    </>
  );
}
