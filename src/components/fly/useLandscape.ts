// src/components/fly/useLandscape.ts
'use client';

import { useCallback, useEffect, useState } from 'react';

/** True on devices whose primary pointer is a finger. */
export function useTouchDevice(): boolean {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    const q = window.matchMedia?.('(pointer: coarse)');
    const force = new URLSearchParams(window.location.search).get('touch') === '1';
    setTouch(force || !!q?.matches);
    const on = () => setTouch(force || !!q?.matches);
    q?.addEventListener?.('change', on);
    return () => q?.removeEventListener?.('change', on);
  }, []);
  return touch;
}

/**
 * Landscape handling for flying on a phone: reports whether the screen is currently portrait, and offers `goLandscape()`, which (from a tap,
 * as browsers require) enters fullscreen and locks the orientation where the browser allows it (Android Chrome; iOS Safari does not allow
 * locking, so there the overlay asks the player to rotate the phone).
 */
export function useLandscape(active: boolean) {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    if (!active) { setPortrait(false); return; }
    const mq = window.matchMedia('(orientation: portrait)');
    const on = () => setPortrait(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [active]);
  const goLandscape = useCallback(async () => {
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' } as FullscreenOptions); } catch { /* not allowed: fine */ }
    try { await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape'); } catch { /* iOS and desktop refuse: the overlay stays until the phone is rotated */ }
  }, []);
  return { portrait, goLandscape };
}
