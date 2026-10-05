// src/components/solar/System3D.tsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Checkbox, Flex, HStack, Text, VisuallyHidden } from '@chakra-ui/react';
import { FiHome, FiPause, FiPlay, FiSkipForward, FiX } from 'react-icons/fi';
import { simClock } from '@/lib/astro/clock';
import { LADDER, describeDistance, describeLightTime, nearestStop, EARTH_RADIUS_AU, KM_PER_AU, type LadderStop } from '@/lib/solar/ladder';
import { BODY_IDS, SolarScene, webglAvailable, type BodyId, type ScreenLabel } from '@/lib/solar/scene';

/** True when the device can reasonably run the 3D scene; otherwise the top-down orrery is used. */
export function solar3dSupported(): boolean {
  if (typeof window === 'undefined' || !webglAvailable()) return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency ?? 4) >= 2 && (nav.deviceMemory ?? 4) >= 2;
}

const RATIOS = [1.75, 1, 0.75, 0.5, 0.35];
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export interface System3DProps {
  /** Start the "Take me home" descent as soon as the scene is ready. */
  autoDescend?: boolean;
  /** Called when the scene cannot keep up and the overlay should fall back to the top-down view. */
  onFallback?: () => void;
}

export function System3D({ autoDescend = false, onFallback }: System3DProps) {
  const holder = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SolarScene | null>(null);
  const labelEls = useRef<Record<string, HTMLButtonElement | null>>({});
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const [focus, setFocus] = useState<BodyId>('Sun');
  const [distance, setDistance] = useState(70);
  const [trueScale, setTrueScale] = useState(false);
  const [orbits, setOrbits] = useState(true);
  const [labels, setLabels] = useState(true);
  const [caption, setCaption] = useState('');
  const [descent, setDescent] = useState<{ index: number; paused: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const descentRef = useRef<{ cancelled: boolean } | null>(null);
  const activity = useRef(0);
  const poke = () => { activity.current = performance.now(); };
  const opts = useRef({ labels });
  opts.current = { labels };
  const reduce = reducedMotion();

  // --- scene lifecycle ----------------------------------------------------------------------
  useEffect(() => {
    // A fresh canvas per scene: a disposed WebGL context can't be reused (React StrictMode mounts twice in development).
    const host = holder.current;
    if (!host) return;
    const el = document.createElement('canvas');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Three-dimensional view of the Solar System at the selected time. Drag to orbit, scroll or pinch to zoom, and use the buttons to fly to a planet.');
    el.style.cssText = 'width:100%;height:100%;display:block;position:absolute;inset:0';
    host.prepend(el);
    let scene: SolarScene;
    try { scene = new SolarScene(el, { dprCap: 1.75 }); } catch { el.remove(); onFallback?.(); return; }
    // Software renderers (SwiftShader, llvmpipe, headless CI) start at a low pixel ratio instead of discovering they are slow the hard way.
    try {
      const gl = scene.renderer.getContext();
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
      if (/swiftshader|llvmpipe|software/i.test(name)) scene.renderer.setPixelRatio(0.5);
    } catch { /* keep the default */ }
    activity.current = performance.now();
    sceneRef.current = scene;
    void scene.loadTextures().then(() => { activity.current = performance.now(); });
    const fit = () => {
      const r = holder.current!.getBoundingClientRect();
      scene.resize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(holder.current!);
    let raf = 0, slow = 0, vslow = 0, last = performance.now(), frames = 0, readyFlag = false, fallbackCalled = false;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) { last = t; return; }
      // Draw continuously only while something changes (input, a flight, fast or reversed time); otherwise once a second.
      const clk = simClock().snapshot();
      const busy = scene.flying || t - activity.current < 1500 || (clk.playing && clk.rate !== 1);
      if (!busy && t - last < 1000) return;
      const dt = t - last; last = t;
      if (!busy) { slow = 0; vslow = 0; }
      // Governor: when frames take > 85 ms, step the pixel ratio down (1 → 0.75 → 0.5 → 0.35); still < 4 fps at the
      // lowest step for several seconds means this device can't run the scene, so the top-down map takes over.
      slow = dt > 85 ? slow + 1 : Math.max(0, slow - 1);
      if (slow >= 8) {
        slow = 0;
        const pr = scene.renderer.getPixelRatio();
        const next = RATIOS.find((r) => r < pr - 0.01);
        if (next !== undefined) { scene.renderer.setPixelRatio(next); fit(); }
      }
      vslow = dt > 250 && scene.renderer.getPixelRatio() <= RATIOS[RATIOS.length - 1] + 0.01 ? vslow + 1 : Math.max(0, vslow - 2);
      if (vslow > 20 && !fallbackCalled) { fallbackCalled = true; onFallback?.(); }
      const list = scene.render(simClock().jd());
      if (!readyFlag && list.length) { readyFlag = true; setReady(true); }
      for (const l of list) paintLabel(labelEls.current[l.id], l, opts.current.labels);
      if (++frames % 6 === 0) { setFocus((f) => (f === scene.displayFocus ? f : scene.displayFocus)); setDistance(scene.focusDistanceAu); }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); if (descentRef.current) descentRef.current.cancelled = true; scene.dispose(); el.remove(); sceneRef.current = null; };
  }, [onFallback]);

  useEffect(() => { if (sceneRef.current) sceneRef.current.trueScale = trueScale; activity.current = performance.now(); }, [trueScale]);
  useEffect(() => { if (sceneRef.current) sceneRef.current.showOrbits = orbits; activity.current = performance.now(); }, [orbits]);
  useEffect(() => { activity.current = performance.now(); }, [labels]);
  useEffect(() => simClock().subscribe(() => { activity.current = performance.now(); }), []);

  // --- navigation ----------------------------------------------------------------------------
  const goTo = useCallback(async (body: BodyId, au: number) => {
    const s = sceneRef.current;
    if (!s) return;
    await s.flyTo(body, au, reduce);
  }, [reduce]);

  const goStop = useCallback((stop: LadderStop) => { if (descentRef.current) descentRef.current.cancelled = true; setDescent(null); setCaption(stop.caption(simClock().jd())); void goTo(stop.focus, stop.distanceAu); }, [goTo]);

  const runDescent = useCallback(async (from = 0) => {
    const s = sceneRef.current;
    if (!s) return;
    if (descentRef.current) descentRef.current.cancelled = true;
    const token = { cancelled: false };
    descentRef.current = token;
    if (from === 0) { s.stopFlight(); await s.flyTo('Sun', LADDER[0].distanceAu, true); }
    for (let i = from; i < LADDER.length; i++) {
      if (token.cancelled) return;
      setDescent({ index: i, paused: false });
      setCaption(LADDER[i].caption(simClock().jd()));
      await s.flyTo(LADDER[i].focus, LADDER[i].distanceAu, reduce);
      if (reduce) return; // reduced motion: one chapter at a time, via the Next/Back buttons
    }
    if (!token.cancelled) setDescent(null);
  }, [reduce]);

  useEffect(() => { if (autoDescend && ready) void runDescent(0); }, [autoDescend, ready, runDescent]);

  const stopDescent = () => { if (descentRef.current) descentRef.current.cancelled = true; sceneRef.current?.stopFlight(); setDescent(null); };

  // --- pointer ----------------------------------------------------------------------------------
  const interrupt = () => { if (descent) { sceneRef.current?.setFlightPaused(true); setDescent((d) => (d ? { ...d, paused: true } : d)); } };
  const onDown = (e: React.PointerEvent) => {
    poke(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); interrupt(); };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    const s = sceneRef.current;
    if (!prev || !s) return;
    poke();
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) s.orbit(-(e.clientX - prev.x) * 0.006, -(e.clientY - prev.y) * 0.006);
    else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current > 0 && d > 0) s.zoom(pinch.current / d);
      pinch.current = d;
    }
  };
  const onUp = (e: React.PointerEvent) => { pointers.current.delete(e.pointerId); if (pointers.current.size < 2) pinch.current = 0; };
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); activity.current = performance.now(); interruptRef.current(); sceneRef.current?.zoom(Math.exp(e.deltaY * 0.0014)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const interruptRef = useRef(interrupt);
  interruptRef.current = interrupt;

  // --- readouts --------------------------------------------------------------------------------------
  const stop = nearestStop(focus === 'Earth' || focus === 'Moon' ? 'Earth' : 'Sun', distance);
  const earthFocus = focus === 'Earth';
  const info = `${focus} · ${describeDistance(distance, earthFocus)} · light takes ${describeLightTime(earthFocus ? Math.max(0, distance - EARTH_RADIUS_AU) : distance)} to cross it`;
  const scaleBadge = trueScale ? 'True scale: every size and distance is real' : 'Visible scale: bodies are enlarged so you can find them; distances are real';
  void KM_PER_AU;

  const chapter = descent ? LADDER[descent.index] : null;
  return (
    <Box>
      <Box
        ref={holder} position="relative" h={{ base: '56dvh', md: '58dvh' }} minH="340px" borderRadius="xl" overflow="hidden" bg="#02030a"
        border="1px solid" borderColor="line.subtle" style={{ touchAction: 'none', cursor: 'grab' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="system3d"
      >
        {labels && BODY_IDS.map((id) => (
          <Box
            as="button" type="button" key={id} ref={(el: HTMLButtonElement | null) => { labelEls.current[id] = el; }}
            position="absolute" left={0} top={0} opacity={0} pointerEvents="none" fontSize="xs" fontWeight={600} color="white" px={2} h="24px" ml="8px" mt="-12px"
            borderRadius="full" bg="rgba(10,10,10,0.6)" border="1px solid" borderColor="line.strong" whiteSpace="nowrap" willChange="transform"
            aria-label={`Fly to ${id}`} onClick={() => { stopDescent(); void goTo(id, id === 'Sun' ? 0.05 : id === 'Moon' ? 0.0004 : defaultDistance(id)); }}
          >{id}</Box>
        ))}
        {!ready && <Flex position="absolute" inset={0} align="center" justify="center"><Text color="content.muted">Loading the Solar System…</Text></Flex>}
        {caption && (
          <Box position="absolute" left={0} right={0} bottom={0} px={4} py={3} bgGradient="linear(to-t, rgba(2,3,10,0.9), rgba(2,3,10,0))" pointerEvents="none">
            <Text fontSize={{ base: 'sm', md: 'md' }} data-testid="descent-caption">{caption}</Text>
          </Box>
        )}
      </Box>

      {/* Descent controls: always visible while it runs */}
      {chapter && descent && (
        <HStack mt={3} spacing={2} wrap="wrap" data-testid="descent-controls" role="group" aria-label="Descent controls">
          <Text fontSize="sm" color="content.secondary" mr={2}>Chapter {descent.index + 1} of {LADDER.length}: {chapter.label}</Text>
          {!reduce && (
            <Button size="sm" variant="outline" leftIcon={descent.paused ? <FiPlay aria-hidden="true" /> : <FiPause aria-hidden="true" />}
              onClick={() => { const p = !descent.paused; sceneRef.current?.setFlightPaused(p); setDescent({ ...descent, paused: p }); }}>
              {descent.paused ? 'Resume descent' : 'Pause'}
            </Button>
          )}
          {reduce && descent.index > 0 && <Button size="sm" variant="outline" onClick={() => void runDescent(descent.index - 1)}>Back</Button>}
          {reduce && descent.index < LADDER.length - 1 && <Button size="sm" variant="outline" onClick={() => void runDescent(descent.index + 1)}>Next</Button>}
          <Button size="sm" variant="outline" leftIcon={<FiSkipForward aria-hidden="true" />} onClick={() => { stopDescent(); sceneRef.current?.finishFlight(); void goStop(LADDER[LADDER.length - 1]); }}>Skip</Button>
          <Button size="sm" variant="outline" leftIcon={<FiX aria-hidden="true" />} onClick={stopDescent}>Exit descent</Button>
        </HStack>
      )}

      {/* Scale ladder */}
      <Flex mt={3} gap={2} wrap="wrap" align="center" role="group" aria-label="Scale ladder">
        {LADDER.map((s) => (
          <Button key={s.id} size="sm" variant={stop.id === s.id ? 'solid' : 'outline'} aria-current={stop.id === s.id ? 'step' : undefined} title={s.hint} onClick={() => goStop(s)}>{s.label}</Button>
        ))}
        <Button size="sm" variant="solid" colorScheme="blue" leftIcon={<FiHome aria-hidden="true" />} onClick={() => void runDescent(0)}>Take me home</Button>
      </Flex>
      <Text mt={2} fontSize="sm" color="content.secondary" aria-live="off" data-testid="system3d-readout">{info}</Text>

      <Flex mt={2} gap={2} wrap="wrap" aria-label="Focus a body" role="group">
        {BODY_IDS.map((id) => (
          <Button key={id} size="xs" variant={focus === id ? 'solid' : 'outline'} aria-pressed={focus === id} onClick={() => { stopDescent(); void goTo(id, id === 'Sun' ? 0.05 : id === 'Moon' ? 0.0004 : defaultDistance(id)); }}>{id}</Button>
        ))}
        <Button size="xs" variant="outline" onClick={() => { stopDescent(); void goTo('Sun', LADDER[0].distanceAu); }}>Reset view</Button>
      </Flex>
      <Flex mt={3} gap={4} wrap="wrap">
        <Checkbox isChecked={trueScale} onChange={(e) => setTrueScale(e.target.checked)}>True scale</Checkbox>
        <Checkbox isChecked={orbits} onChange={(e) => setOrbits(e.target.checked)}>Orbits</Checkbox>
        <Checkbox isChecked={labels} onChange={(e) => setLabels(e.target.checked)}>Labels</Checkbox>
      </Flex>
      <Text mt={2} fontSize="xs" color="content.muted" data-testid="scale-badge">{scaleBadge}. Planet positions come from astronomy-engine. Earth’s spin and tilt are exact for the chosen time; Mars’s axis is approximate; ring and moon detail are decorative.</Text>
      <VisuallyHidden role="status" aria-live="polite">{caption}</VisuallyHidden>
    </Box>
  );
}

function defaultDistance(id: BodyId): number {
  const r: Record<string, number> = { Mercury: 0.004, Venus: 0.01, Earth: 0.0008, Mars: 0.005, Jupiter: 0.14, Saturn: 0.12, Uranus: 0.05, Neptune: 0.05 };
  return r[id] ?? 0.01;
}

function paintLabel(el: HTMLButtonElement | null | undefined, l: ScreenLabel, enabled: boolean) {
  if (!el) return;
  const show = enabled && l.visible;
  el.style.opacity = show ? '1' : '0';
  el.style.pointerEvents = show ? 'auto' : 'none';
  el.tabIndex = show ? 0 : -1;
  el.style.transform = `translate3d(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px, 0)`;
}
