// src/components/galaxy/explore/ExploreMode.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import NextLink from 'next/link';
import {
  Box, Button, Flex, HStack, IconButton, Kbd, Menu, MenuButton, MenuItem, MenuList, Modal, ModalBody, ModalCloseButton, ModalContent,
  ModalHeader, ModalOverlay, SimpleGrid, Text, Tooltip, useToast, VisuallyHidden,
} from '@chakra-ui/react';
import { FiArrowLeft, FiCamera, FiCompass, FiHelpCircle, FiLink, FiPlayCircle, FiSun, FiTag } from 'react-icons/fi';
import GalaxyControls from '@/components/galaxy/GalaxyControls';
import { ExploreLabels } from './ExploreLabels';
import { InfoCard, TourCard } from './ExploreCards';
import { MiniMap, ScaleBar, useEngineReadout } from './ExploreHud';
import { TimePanel } from '@/components/solar/TimePanel';
import { simClock } from '@/lib/astro/clock';
import { GALAXY } from '@/lib/galaxy/constants';

const SolarView = dynamic(() => import('@/components/solar/SolarView'), { ssr: false });
import { useStarfield } from '@/contexts/StarfieldContext';
import { galaxyBus } from '@/lib/galaxy/bus';
import { clonePose, VIEWS, type CameraPose } from '@/lib/galaxy/camera';
import { decodeView, encodeView, orbit, pan, zoom } from '@/lib/galaxy/explore';
import { FEATURES, FLY_TO_ORDER, TOUR, featureById, featurePose, type Feature } from '@/lib/galaxy/features';

const KEYS_HELP: [string, string][] = [
  ['Drag', 'Orbit the galaxy'],
  ['Shift + drag / right-drag / two fingers', 'Pan'],
  ['Scroll / pinch / + −', 'Zoom'],
  ['← → ↑ ↓  or  W A S D', 'Orbit with the keyboard'],
  ['1 – 8', 'Fly to a place (Sgr A*, bar, Perseus, Orion Spur, Sun, cluster, LMC, SMC)'],
  ['Space', 'Pause or resume time'],
  ['L', 'Toggle labels'],
  ['O', 'Zoom into the Sun and Solar System, or back out'],
  ['T', 'Start or end the guided tour'],
  ['G', 'Galaxy settings'],
  ['?', 'This help'],
  ['Esc', 'Close a card or the tour'],
];

const isTyping = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName));
};
const isInteractive = (el: EventTarget | null) => !!(el as HTMLElement | null)?.closest?.('button, a, [role="menuitem"], [role="radio"]');

export default function ExploreMode() {
  const { config } = useStarfield();
  const toast = useToast();
  const readout = useEngineReadout();
  const [selected, setSelected] = useState<Feature | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [labels, setLabels] = useState(true);
  const [help, setHelp] = useState(false);
  const [solar, setSolar] = useState(false);
  const [announce, setAnnounce] = useState('');
  const target = useRef<CameraPose>(clonePose(VIEWS.tilted));
  const surface = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number } | null>(null);
  const labelsOn = labels && config.exploreLabels && !solar;

  // Take over the camera while this page is open.
  useEffect(() => {
    const shared = decodeView(new URLSearchParams(window.location.search).get('v'));
    target.current = shared ?? { ...VIEWS.tilted, roll: 0 };
    const t = Number(new URLSearchParams(window.location.search).get('t'));
    if (Number.isFinite(t) && t > 0) simClock().setJd(t);
    else simClock().now(); // boot at the real current time
    galaxyBus.setExplore({ active: true, target: target.current, timeScale: 1, galacticYears: () => simClock().yearsSinceJ2000() });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      galaxyBus.setExplore(null);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const flyTo = useCallback((pose: CameraPose) => {
    Object.assign(target.current, pose, { roll: 0 });
  }, []);

  const showFeature = useCallback((feature: Feature) => {
    setTourStep(null);
    setSelected(feature);
    flyTo(featurePose(feature));
    setAnnounce(`Flying to ${feature.label}. ${feature.summary}`);
  }, [flyTo]);

  const goTour = useCallback((index: number) => {
    const step = TOUR[index];
    setSelected(null);
    setTourStep(index);
    flyTo(step.pose);
    setAnnounce(`Tour step ${index + 1} of ${TOUR.length}: ${step.title}. ${step.body}`);
  }, [flyTo]);

  const startTour = useCallback(() => goTour(0), [goTour]);
  const endTour = useCallback(() => { setTourStep(null); setAnnounce('Tour ended'); }, []);

  // --- Pointer input: orbit, pan, pinch -------------------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    surface.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      if (e.shiftKey || e.buttons === 2) pan(target.current, dx, dy, window.innerHeight);
      else orbit(target.current, -dx * 0.0055, -dy * 0.0055);
    } else if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist > 0) zoom(target.current, gesture.current.dist / dist);
      gesture.current.dist = dist;
      pan(target.current, dx / 2, dy / 2, window.innerHeight);
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
  };

  // Wheel needs a non-passive listener so the page doesn't scroll or zoom the browser.
  useEffect(() => {
    const el = surface.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = target.current;
      // Zooming further in while already at the closest range over the Sun steps down into the Solar System.
      const nearSun = Math.hypot(p.targetX - GALAXY.sunRadius, p.targetY - GALAXY.sunHeight, p.targetZ) < 12;
      if (e.deltaY < 0 && nearSun && Math.exp(p.logDistance) < 36) { setSolar(true); return; }
      zoom(p, Math.exp(e.deltaY * 0.0012));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // --- Keyboard ----------------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || help) return;
      const k = e.key;
      const lower = k.toLowerCase();
      const step = e.shiftKey ? 0.16 : 0.07;
      if (k === 'ArrowLeft' || lower === 'a') orbit(target.current, step, 0);
      else if (k === 'ArrowRight' || lower === 'd') orbit(target.current, -step, 0);
      else if (k === 'ArrowUp' || lower === 'w') orbit(target.current, 0, -step);
      else if (k === 'ArrowDown' || lower === 's') orbit(target.current, 0, step);
      else if (k === '+' || k === '=') zoom(target.current, 0.85);
      else if (k === '-' || k === '_') zoom(target.current, 1.18);
      else if (k === ' ' && !isInteractive(e.target)) simClock().setPlaying(!simClock().playing);
      else if (lower === 'l') setLabels((v) => !v);
      else if (lower === 'o') setSolar((v) => !v);
      else if (lower === 't') {
        if (tourStep === null) startTour();
        else endTour();
      }
      else if (k === '?') setHelp(true);
      else if (k === 'Escape') { if (solar) setSolar(false); else setSelected(null); if (tourStep !== null) endTour(); }
      else if (/^[1-8]$/.test(k)) {
        const f = featureById(FLY_TO_ORDER[Number(k) - 1]);
        if (f) showFeature(f);
      } else if (tourStep !== null && k === 'Enter' && !isInteractive(e.target)) goTour(Math.min(TOUR.length - 1, tourStep + 1));
      else return;
      if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [help, solar, tourStep, startTour, endTour, showFeature, goTour]);

  // --- Share and save ---------------------------------------------------------------------
  const share = async () => {
    const pose = galaxyBus.api?.pose() ?? target.current;
    const snap = simClock().snapshot();
    const url = `${window.location.origin}/stars?v=${encodeView(pose)}${snap.live ? '' : `&t=${snap.jd.toFixed(5)}`}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'Anyone who opens it will see this exact view.', status: 'success', duration: 4000 });
    } catch {
      toast({ title: 'Couldn’t copy automatically', description: url, status: 'info', duration: 9000, isClosable: true });
    }
  };
  const saveImage = async () => {
    const blob = await galaxyBus.api?.capture();
    if (!blob) {
      toast({ title: 'Couldn’t capture the image', status: 'warning', duration: 4000 });
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'milky-way.png';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const toolButton = (label: string, icon: React.ReactElement, onClick: () => void, pressed?: boolean) => (
    <Tooltip label={label} placement="bottom" openDelay={300}>
      <IconButton aria-label={label} aria-pressed={pressed} icon={icon} variant="glass" boxSize="44px" bg={pressed ? 'accent.subtle' : undefined} onClick={onClick} />
    </Tooltip>
  );

  const tourStepData = tourStep !== null ? TOUR[tourStep] : null;
  const dist = useMemo(() => readout.distLy, [readout.distLy]);

  return (
    <>
      {/* Gesture surface sits above the galaxy and below all controls. */}
      <Box
        ref={surface}
        position="fixed"
        inset={0}
        zIndex={1}
        sx={{ touchAction: 'none', cursor: 'grab', '&:active': { cursor: 'grabbing' } }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
        aria-hidden="true"
      />

      <ExploreLabels enabled={labelsOn} selectedId={selected?.id ?? null} onSelect={showFeature} />

      {/* Top bar */}
      <Flex position="fixed" top={3} left={3} right={3} zIndex={40} justify="space-between" align="flex-start" gap={3} pointerEvents="none">
        <HStack pointerEvents="auto" spacing={2}>
          <Button as={NextLink} href="/" variant="glass" leftIcon={<FiArrowLeft aria-hidden="true" />} h="44px" display={{ base: 'none', md: 'inline-flex' }}>Back to site</Button>
          <IconButton as={NextLink} href="/" aria-label="Back to site" icon={<FiArrowLeft />} variant="glass" boxSize="44px" display={{ base: 'inline-flex', md: 'none' }} />
          <Text display={{ base: 'none', md: 'block' }} fontFamily="heading" fontWeight={700} fontSize="lg" textShadow="0 2px 8px #000">Explore the Milky Way</Text>
        </HStack>
        <Flex direction="column" align="flex-end" gap={3} pointerEvents="auto">
          <HStack spacing={2} wrap="wrap" justify="flex-end" maxW={{ base: '236px', md: 'none' }}>
            <Menu placement="bottom-end">
              <Tooltip label="Fly to a place" placement="bottom" openDelay={300}>
                <MenuButton as={IconButton} aria-label="Fly to a place" icon={<FiCompass />} variant="glass" boxSize="44px" />
              </Tooltip>
              <MenuList bg="surface.raised" borderColor="line.strong" maxH="60dvh" overflowY="auto">
                {FEATURES.map((f) => (
                  <MenuItem key={f.id} bg="transparent" _hover={{ bg: 'surface.inset' }} _focus={{ bg: 'surface.inset' }} onClick={() => showFeature(f)}>{f.label}</MenuItem>
                ))}
              </MenuList>
            </Menu>
            {toolButton(solar ? 'Back to the galaxy' : 'Zoom into the Sun and Solar System (O)', <FiSun />, () => setSolar((v) => !v), solar)}
            {toolButton(labelsOn ? 'Hide labels (L)' : 'Show labels (L)', <FiTag />, () => setLabels((v) => !v), labelsOn)}
            {toolButton(tourStep === null ? 'Start guided tour (T)' : 'End guided tour (T)', <FiPlayCircle />, () => (tourStep === null ? startTour() : endTour()), tourStep !== null)}
            {toolButton('Copy link to this view', <FiLink />, share)}
            {toolButton('Save image', <FiCamera />, saveImage)}
            {toolButton('Help and shortcuts (?)', <FiHelpCircle />, () => setHelp(true))}
          </HStack>
          <Box display={{ base: 'none', md: solar ? 'none' : 'block' }}><MiniMap pose={readout.pose} /></Box>
        </Flex>
      </Flex>

      {/* Cards */}
      {selected && tourStep === null && !solar && <InfoCard feature={selected} onClose={() => setSelected(null)} onFlyHere={() => flyTo(featurePose(selected))} action={selected.id === 'sun' ? { label: 'Zoom into the Sun', onClick: () => setSolar(true) } : undefined} />}
      {solar && <SolarView onClose={() => setSolar(false)} />}
      {tourStepData && tourStep !== null && (
        <TourCard step={tourStepData} index={tourStep} total={TOUR.length} onPrev={() => goTour(Math.max(0, tourStep - 1))} onNext={() => goTour(tourStep + 1)} onEnd={endTour} />
      )}

      {/* Bottom HUD */}
      <Flex
        position="fixed"
        bottom={{ base: 'calc(12px + env(safe-area-inset-bottom))', md: 5 }}
        left={3}
        right={{ base: 3, md: '90px' }}
        zIndex={30}
        justify="center"
        align="flex-end"
        gap={{ base: 4, md: 8 }}
        pointerEvents="none"
      >
        <Box display={{ base: 'none', md: solar ? 'none' : 'block' }} pointerEvents="auto" bg="surface.glass" border="1px solid" borderColor="line.subtle" borderRadius="xl" px={4} py={2} backdropFilter="blur(10px)">
          <ScaleBar distLy={dist} />
        </Box>
        <Box pointerEvents="auto" bg="surface.glass" border="1px solid" borderColor="line.subtle" borderRadius="xl" px={4} py={2} backdropFilter="blur(10px)">
          <TimePanel />
        </Box>
      </Flex>

      <GalaxyControls raised />

      <VisuallyHidden role="status" aria-live="polite">{announce}</VisuallyHidden>

      <Modal isOpen={help} onClose={() => setHelp(false)} size="lg" isCentered>
        <ModalOverlay />
        <ModalContent mx={3}>
          <ModalHeader>Controls</ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            <SimpleGrid columns={1} spacing={3}>
              {KEYS_HELP.map(([keys, what]) => (
                <Flex key={keys} justify="space-between" gap={4} align="center">
                  <Text color="content.secondary">{what}</Text>
                  <Kbd flexShrink={0} maxW="55%" whiteSpace="normal" textAlign="right">{keys}</Kbd>
                </Flex>
              ))}
              <Text fontSize="sm" color="content.muted" mt={2}>The clock starts at the real current time. Use the clock button to jump to any date, or run time forwards and backwards from real time up to 10 million years per second. One lap of the Sun around the galaxy takes about 203 million years.</Text>
            </SimpleGrid>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
