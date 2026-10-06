// src/components/solar/System3D.tsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Checkbox, Flex, HStack, Popover, PopoverBody, PopoverContent, PopoverTrigger, Text, VisuallyHidden } from '@chakra-ui/react';
import { FiChevronDown, FiHome, FiPause, FiPlay, FiSkipForward, FiSliders, FiX } from 'react-icons/fi';
import { simClock } from '@/lib/astro/clock';
import { solarBus } from '@/lib/solar/bus';
import { usePadFrames } from '@/components/input/usePad';
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
  /** Show the on-screen controls. False leaves only the scene. */
  hud?: boolean;
  /** Called when the scene cannot keep up and the overlay should fall back to the top-down view. */
  onFallback?: () => void;
}

export function System3D({ autoDescend = false, hud = true, onFallback }: System3DProps) {
  const holder = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SolarScene | null>(null);
  const labelEls = useRef<Record<string, HTMLButtonElement | null>>({});
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef(0);
  const [focus, setFocus] = useState<BodyId>('Sun');
  const [distance, setDistance] = useState(70);
  const [trueScale, setTrueScale] = useState(true);
  const [orbits, setOrbits] = useState(true);
  const [labels, setLabels] = useState(true);
  const [caption, setCaption] = useState('');
  const [descent, setDescent] = useState<{ index: number; paused: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const [outOfRange, setOutOfRange] = useState(false);
  const [captionFresh, setCaptionFresh] = useState(false);
  useEffect(() => {
    if (!caption) return;
    setCaptionFresh(true);
    const id = window.setTimeout(() => setCaptionFresh(false), 6000);
    return () => window.clearTimeout(id);
  }, [caption]);
  const descentRef = useRef<{ cancelled: boolean } | null>(null);
  const activity = useRef(0);
  const hudTop = useRef<HTMLDivElement>(null);
  const hudBottom = useRef<HTMLDivElement>(null);
  const hudRef = useRef(hud);
  hudRef.current = hud;
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
    solarBus.capture = () => scene.capture();
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
      // Keep the scene centred in the free space between the HUD's top menus and its bottom strip.
      if (frames % 15 === 0) {
        const h = el.clientHeight;
        const top = hudTop.current?.getBoundingClientRect().bottom ?? 0;
        const bottom = hudBottom.current?.getBoundingClientRect().top ?? h;
        scene.setCentreShift(hudRef.current && top > 0 ? (top + Math.min(bottom, h)) / 2 - h / 2 : 0);
      }
      const frame = scene.render(simClock().jd());
      setOutOfRange((o) => (o === (frame === null) ? o : frame === null));
      const list = frame ?? [];
      if (!readyFlag && frame && list.length) { readyFlag = true; setReady(true); }
      // Label overlap culling: the focused body first, then nearest to the camera; a label that would sit on a placed one is hidden.
      const placed: { x: number; y: number; w: number }[] = [];
      const order = [...list].sort((a, b) => (a.id === scene.displayFocus ? -1 : b.id === scene.displayFocus ? 1 : a.distanceAu - b.distanceAu));
      for (const l of order) {
        const w = l.id.length * 7 + 22;
        const hit = l.visible && placed.some((q) => Math.abs(q.x - l.x) < (q.w + w) / 2 && Math.abs(q.y - l.y) < 24);
        if (l.visible && !hit) placed.push({ x: l.x + w / 2, y: l.y, w });
        paintLabel(labelEls.current[l.id], hit ? { ...l, visible: false } : l, opts.current.labels);
      }
      if (++frames % 6 === 0) { setFocus((f) => (f === scene.displayFocus ? f : scene.displayFocus)); setDistance(scene.focusDistanceAu); }
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); if (descentRef.current) descentRef.current.cancelled = true; scene.dispose(); el.remove(); sceneRef.current = null; if (solarBus.capture) solarBus.capture = null; };
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

  // --- controller -------------------------------------------------------------------------------------------
  // Left stick orbits (like dragging), right stick Y and the triggers zoom, ▲ ▼ step through the bodies. ✕ / ○ are handled by the page.
  usePadFrames(({ pad, pressed, dt, anyInput }) => {
    const s = sceneRef.current;
    if (!s || !hud) return;
    if (anyInput) { activity.current = performance.now(); if (descent && (pad.lx || pad.ly || pad.ry || pad.l2 || pad.r2)) interruptRef.current(); }
    if (pad.lx || pad.ly) s.orbit(-pad.lx * dt * 2.4, -pad.ly * dt * 2.4);
    const z = pad.ry + pad.l2 - pad.r2;
    if (z) s.zoom(Math.exp(z * dt * 1.6));
    for (const c of pressed) {
      if (c === 'up' || c === 'down') {
        const i = BODY_IDS.indexOf(s.displayFocus);
        fly(BODY_IDS[(i + (c === 'down' ? 1 : BODY_IDS.length - 1)) % BODY_IDS.length]);
      }
    }
  });

  // --- readouts --------------------------------------------------------------------------------------
  const stop = nearestStop(focus === 'Earth' || focus === 'Moon' ? 'Earth' : 'Sun', distance);
  const earthFocus = focus === 'Earth';
  const info = `${focus} · ${describeDistance(distance, earthFocus)} · light takes ${describeLightTime(earthFocus ? Math.max(0, distance - EARTH_RADIUS_AU) : distance)} to cross it`;
  const scaleBadge = trueScale ? 'True scale: sizes and distances are real' : 'Visible scale: bodies enlarged, distances real';
  void KM_PER_AU;

  const chapter = descent ? LADDER[descent.index] : null;
  const fly = (id: BodyId) => { stopDescent(); void goTo(id, id === 'Sun' ? 0.05 : id === 'Moon' ? 0.0004 : defaultDistance(id)); };
  const glass = { bg: 'rgba(8,10,20,0.55)', border: '1px solid', borderColor: 'line.subtle', borderRadius: 'lg', backdropFilter: 'blur(8px)' } as const;
  // Captions fade after a few seconds unless a descent is running, so they never sit over the view.
  const showCaption = caption && (descent || captionFresh);
  // The scene fills the screen and the controls are small: two pop-over menus at the top, one slim strip at the bottom.
  // `hud={false}` removes all of it. The page's own toolbar (top right) and clock (bottom centre) are kept clear.
  return (
    <Box position="fixed" inset={0} zIndex={0} bg="#02030a" data-testid="system3d-root">
      <Box
        ref={holder} position="absolute" inset={0} style={{ touchAction: 'none', cursor: 'grab' }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} data-testid="system3d"
      />
      <Box position="absolute" inset={0} pointerEvents="none" overflow="hidden">
        {labels && BODY_IDS.map((id) => (
          <Box
            as="button" type="button" key={id} ref={(el: HTMLButtonElement | null) => { labelEls.current[id] = el; }}
            position="absolute" left={0} top={0} opacity={0} pointerEvents="none" fontSize="xs" fontWeight={600} color="white" px={2} h="22px" ml="8px" mt="-11px"
            borderRadius="full" bg="rgba(10,10,10,0.5)" border="1px solid" borderColor="line.subtle" whiteSpace="nowrap" willChange="transform"
            aria-label={`Fly to ${id}`} onClick={() => fly(id)}
          >{id}</Box>
        ))}
      </Box>
      {outOfRange && (
        <Flex position="absolute" inset={0} align="center" justify="center" bg="rgba(2,3,10,0.85)" px={6} textAlign="center" data-testid="system3d-out-of-range">
          <Text color="content.secondary">The planets can be placed for about ±270,000 years around today. At this date only the galaxy and the date itself are meaningful; use the clock to come back.</Text>
        </Flex>
      )}
      {!ready && !outOfRange && <Flex position="absolute" inset={0} align="center" justify="center" pointerEvents="none"><Text color="content.muted">Loading the Solar System…</Text></Flex>}

      {hud && (
        <>
          {/* Top left, under the page header: two small menus */}
          <HStack ref={hudTop} position="absolute" left={3} top={{ base: '144px', md: '104px' }} spacing={1}>
            <Popover isLazy placement="bottom-start">
              <PopoverTrigger><Button {...glass} size="xs" h="28px" rightIcon={<FiChevronDown aria-hidden="true" />} aria-label="Bodies">{focus}</Button></PopoverTrigger>
              <PopoverContent w="auto" bg="surface.raised" borderColor="line.strong" _focusVisible={{ boxShadow: 'none' }}>
                <PopoverBody p={1}>
                  <Flex direction="column" gap={0.5} role="group" aria-label="Focus a body" maxH="60dvh" overflowY="auto">
                    {BODY_IDS.map((id) => (
                      <Button key={id} size="xs" justifyContent="flex-start" variant={focus === id ? 'solid' : 'ghost'} aria-pressed={focus === id} onClick={() => fly(id)}>{id}</Button>
                    ))}
                    <Button size="xs" justifyContent="flex-start" variant="outline" onClick={() => { stopDescent(); void goTo('Sun', LADDER[0].distanceAu); }}>Reset view</Button>
                  </Flex>
                </PopoverBody>
              </PopoverContent>
            </Popover>
            <Popover isLazy placement="bottom-start">
              <PopoverTrigger><Button {...glass} size="xs" h="28px" leftIcon={<FiSliders aria-hidden="true" />}>View</Button></PopoverTrigger>
              <PopoverContent w="230px" bg="surface.raised" borderColor="line.strong" _focusVisible={{ boxShadow: 'none' }}>
                <PopoverBody>
                  <Flex direction="column" gap={1}>
                    <Checkbox size="sm" isChecked={trueScale} onChange={(e) => setTrueScale(e.target.checked)}>True scale</Checkbox>
                    <Checkbox size="sm" isChecked={orbits} onChange={(e) => setOrbits(e.target.checked)}>Orbits</Checkbox>
                    <Checkbox size="sm" isChecked={labels} onChange={(e) => setLabels(e.target.checked)}>Labels</Checkbox>
                  </Flex>
                  <Text mt={2} fontSize="2xs" color="content.muted">Positions: astronomy-engine. Orbit lines are the real ellipses, drawn from today’s date. Earth’s spin and tilt are exact for the chosen time; Mars’s axis is approximate; ring and moon detail are decorative.</Text>
                </PopoverBody>
              </PopoverContent>
            </Popover>
          </HStack>

          {/* Bottom: one slim strip */}
          <Flex ref={hudBottom} position="absolute" left={3} right={3} pl={{ base: '34px', md: 0 }} bottom={{ base: '232px', md: '200px' }} direction="column" align="center" gap={1} pointerEvents="none">
            {showCaption && <Text {...glass} px={3} py={1} fontSize="sm" textAlign="center" maxW="640px" data-testid="descent-caption">{caption}</Text>}
            {chapter && descent && (
              <HStack {...glass} px={2} py={1} spacing={1} wrap="wrap" justify="center" pointerEvents="auto" data-testid="descent-controls" role="group" aria-label="Descent controls">
                <Text fontSize="xs" color="content.secondary" mx={1}>{descent.index + 1}/{LADDER.length} · {chapter.label}</Text>
                {!reduce && (
                  <Button size="xs" variant="ghost" leftIcon={descent.paused ? <FiPlay aria-hidden="true" /> : <FiPause aria-hidden="true" />}
                    onClick={() => { const pz = !descent.paused; sceneRef.current?.setFlightPaused(pz); setDescent({ ...descent, paused: pz }); }}>
                    {descent.paused ? 'Resume descent' : 'Pause'}
                  </Button>
                )}
                {reduce && descent.index > 0 && <Button size="xs" variant="ghost" onClick={() => void runDescent(descent.index - 1)}>Back</Button>}
                {reduce && descent.index < LADDER.length - 1 && <Button size="xs" variant="ghost" onClick={() => void runDescent(descent.index + 1)}>Next</Button>}
                <Button size="xs" variant="ghost" leftIcon={<FiSkipForward aria-hidden="true" />} onClick={() => { stopDescent(); sceneRef.current?.finishFlight(); void goStop(LADDER[LADDER.length - 1]); }}>Skip</Button>
                <Button size="xs" variant="ghost" leftIcon={<FiX aria-hidden="true" />} onClick={stopDescent}>Exit descent</Button>
              </HStack>
            )}
            <Flex {...glass} px={1} py={1} gap={0.5} align="center" role="group" aria-label="Scale ladder" pointerEvents="auto" maxW="100%" overflowX="auto">
              {LADDER.map((st) => (
                <Button key={st.id} size="xs" flexShrink={0} variant={stop.id === st.id ? 'solid' : 'ghost'} aria-current={stop.id === st.id ? 'step' : undefined} aria-label={st.label} title={st.hint} onClick={() => goStop(st)}>
                  <Text as="span" display={{ base: 'none', md: 'inline' }}>{st.label}</Text><Text as="span" display={{ base: 'inline', md: 'none' }} aria-hidden="true">{st.short}</Text>
                </Button>
              ))}
              <Button size="xs" flexShrink={0} variant="ghost" colorScheme="blue" aria-label="Take me home" leftIcon={<FiHome aria-hidden="true" />} iconSpacing={{ base: 0, md: 2 }} onClick={() => void runDescent(0)}><Text as="span" display={{ base: 'none', md: 'inline' }}>Take me home</Text></Button>
            </Flex>
            <Text fontSize="2xs" color="content.secondary" textShadow="0 1px 6px #000" aria-live="off">
              <span data-testid="system3d-readout">{info}</span> · <span data-testid="scale-badge">{scaleBadge}</span>
            </Text>
          </Flex>
        </>
      )}
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
