// src/components/galaxy/GalaxyControls.tsx
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel, Badge, Box, Button, CloseButton, Drawer, DrawerBody,
  DrawerContent, DrawerOverlay, Flex, FormControl, FormLabel, Heading, HStack, IconButton, Popover, PopoverArrow, PopoverBody,
  PopoverContent, PopoverTrigger, Select, Slider, SliderFilledTrack, SliderThumb, SliderTrack, Stack, Switch, Text, Tooltip, useBreakpointValue,
  useToast,
} from '@chakra-ui/react';
import { GiGalaxy } from 'react-icons/gi';
import { FiInfo, FiRotateCcw, FiTrendingUp, FiX } from 'react-icons/fi';
import {
  PRESETS, PRESET_ORDER, useStarfield, useStarfieldStats, type QualitySetting, type StarfieldConfig,
} from '@/contexts/StarfieldContext';
import { isTier } from '@/lib/galaxy/tiers';

const COACH_KEY = 'gmd.galaxy.coach.v1';

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function SliderRow({
  id, label, value, min, max, step, format, valueText, onChange,
}: {
  id: string; label: string; value: number; min: number; max: number; step: number;
  format: (v: number) => string; valueText?: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <FormControl>
      <Flex justify="space-between" mb={1} gap={3}>
        <FormLabel htmlFor={id} mb={0}>{label}</FormLabel>
        <Text fontSize="sm" color="content.secondary" aria-hidden="true">{format(value)}</Text>
      </Flex>
      <Slider
        id={id}
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        getAriaValueText={(v) => (valueText ?? format)(v)}
        focusThumbOnChange={false}
      >
        <SliderTrack bg="whiteAlpha.300"><SliderFilledTrack bg="accent.fg" /></SliderTrack>
        <SliderThumb boxSize={5} />
      </Slider>
    </FormControl>
  );
}

function SwitchRow({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <FormControl display="flex" alignItems="center" justifyContent="space-between" gap={4}>
      <Box>
        <FormLabel htmlFor={id} mb={0}>{label}</FormLabel>
        {hint && <Text fontSize="xs" color="content.muted">{hint}</Text>}
      </Box>
      <Switch id={id} isChecked={checked} onChange={(e) => onChange(e.target.checked)} colorScheme="orange" size="lg" flexShrink={0} />
    </FormControl>
  );
}

function SectionReset({ onClick }: { onClick: () => void }) {
  return (
    <Button size="xs" variant="ghost" leftIcon={<FiRotateCcw aria-hidden="true" />} onClick={onClick} alignSelf="flex-start">
      Reset this section
    </Button>
  );
}

const QUALITY_OPTIONS: { value: QualitySetting; label: string }[] = [
  { value: 'auto', label: 'Auto — adapts to this device' },
  { value: 'ultra', label: 'Ultra · ~250k stars' },
  { value: 'high', label: 'High · ~150k stars' },
  { value: 'medium', label: 'Medium · ~85k stars' },
  { value: 'low', label: 'Low · ~37k stars, 30 fps' },
  { value: 'minimal', label: 'Minimal · ~13k stars, 30 fps' },
];

const x2 = (v: number) => `${v.toFixed(2)}×`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

function ControlsPanel({ onClose }: { onClose: () => void }) {
  const { config, updateConfig, updateLayer, updateBlackHoleConfig, applyPreset, resetKeys, resetConfig, undoReset } = useStarfield();
  const { stats } = useStarfieldStats();
  const toast = useToast();
  const [benchmarking, setBenchmarking] = useState(false);
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const configRef = useRef(config);
  configRef.current = config;

  const live = stats.mode !== 'loading' && stats.mode !== 'static';
  const below = live && isTier(stats.mode) && isTier(stats.ceiling) && stats.mode !== stats.ceiling;
  const canTryHigher = live && config.quality === 'auto' && isTier(stats.ceiling) && stats.mode !== stats.ceiling && !benchmarking;

  const reset = (keys: (keyof StarfieldConfig)[] | 'all', label: string) => {
    if (keys === 'all') resetConfig();
    else resetKeys(keys);
    toast({
      title: `${label} reset`,
      status: 'info',
      duration: 6000,
      isClosable: true,
      position: 'bottom',
      render: ({ onClose: close }) => (
        <HStack bg="surface.raised" border="1px solid" borderColor="line.strong" borderRadius="lg" px={4} py={3} spacing={4} boxShadow="lg">
          <Text>{label} reset to defaults</Text>
          <Button size="sm" variant="outline" onClick={() => { undoReset(); close(); }}>Undo</Button>
        </HStack>
      ),
    });
  };

  // Try the device's top tier for five seconds; keep it only if it holds its frame rate.
  const tryHigher = () => {
    const target = statsRef.current.ceiling;
    if (!isTier(target)) return;
    setBenchmarking(true);
    updateConfig('quality', target);
    toast({ title: `Testing ${target} quality for 5 seconds…`, status: 'info', duration: 5000 });
    window.setTimeout(() => {
      const fps = statsRef.current.fps;
      const wanted = target === 'ultra' || target === 'high' || target === 'medium' ? 52 : 26;
      if (fps >= wanted) {
        updateConfig('quality', 'auto');
        toast({ title: `${target} quality holds ${fps} fps`, description: 'Auto mode may now step up on its own.', status: 'success', duration: 5000 });
      } else {
        updateConfig('quality', 'auto');
        toast({ title: `${target} only reached ${fps} fps`, description: 'Staying on Auto.', status: 'warning', duration: 5000 });
      }
      setBenchmarking(false);
    }, 5000);
  };

  return (
    <Stack spacing={5} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      {/* Status */}
      <Box>
        <HStack spacing={2} flexWrap="wrap">
          {live ? (
            <>
              <Badge colorScheme="purple">Tier: {stats.mode}</Badge>
              <Badge colorScheme="gray">Max: {stats.ceiling}</Badge>
              <Badge colorScheme={stats.fps >= 50 ? 'green' : stats.fps >= 25 ? 'yellow' : 'red'}>{stats.fps} fps</Badge>
              {stats.resolution < 1 && <Badge colorScheme="orange">Res {Math.round(stats.resolution * 100)}%</Badge>}
            </>
          ) : (
            <Badge>{stats.mode === 'static' ? 'Lightweight mode (no WebGL)' : 'Starting…'}</Badge>
          )}
          <Popover placement="bottom-start">
            <PopoverTrigger>
              <Button size="xs" variant="ghost" leftIcon={<FiInfo aria-hidden="true" />}>Why?</Button>
            </PopoverTrigger>
            <PopoverContent bg="surface.raised" borderColor="line.strong">
              <PopoverArrow bg="surface.raised" />
              <PopoverBody>
                <Text fontSize="sm" mb={stats.reasons.length ? 2 : 0}>
                  {stats.reasons.length ? 'This device is capped because of:' : below ? 'The tier was lowered live to keep the frame rate smooth.' : 'Nothing is limiting this device.'}
                </Text>
                {stats.reasons.map((r) => (<Text key={r} fontSize="sm" color="content.secondary">• {r}</Text>))}
              </PopoverBody>
            </PopoverContent>
          </Popover>
        </HStack>
        {canTryHigher && (
          <Button mt={2} size="sm" variant="outline" leftIcon={<FiTrendingUp aria-hidden="true" />} onClick={tryHigher}>
            Try higher quality
          </Button>
        )}
      </Box>

      {/* Presets */}
      <Box role="radiogroup" aria-label="Preset">
        <Text fontSize="sm" fontWeight={600} mb={2}>Preset {config.preset === 'custom' && <Badge ml={2} colorScheme="orange">Custom</Badge>}</Text>
        <Flex wrap="wrap" gap={2}>
          {PRESET_ORDER.map((name) => {
            const on = config.preset === name;
            return (
              <Tooltip key={name} label={PRESETS[name].description} placement="top" openDelay={300}>
                <Button
                  role="radio"
                  aria-checked={on}
                  size="sm"
                  variant="outline"
                  flex="1 1 calc(50% - 8px)"
                  bg={on ? 'accent.subtle' : 'transparent'}
                  borderColor={on ? 'accent.fg' : 'line.strong'}
                  color={on ? 'accent.fg' : 'content.primary'}
                  onClick={() => applyPreset(name)}
                >
                  {PRESETS[name].label}
                </Button>
              </Tooltip>
            );
          })}
        </Flex>
        {config.preset !== 'custom' && <Text fontSize="xs" color="content.muted" mt={2}>{PRESETS[config.preset].description}</Text>}
      </Box>

      {/* Essentials */}
      <Stack spacing={4}>
        <FormControl>
          <FormLabel htmlFor="gx-quality">Quality</FormLabel>
          <Select id="gx-quality" size="sm" value={config.quality} onChange={(e) => updateConfig('quality', e.target.value as QualitySetting)}>
            {QUALITY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
        </FormControl>
        <SliderRow id="gx-brightness" label="Brightness" value={config.brightness} min={0.3} max={2} step={0.05} format={x2} onChange={(v) => updateConfig('brightness', v)} />
        <SwitchRow id="gx-rotation" label="Galactic rotation" checked={config.rotation} onChange={(v) => updateConfig('rotation', v)} />
        <SwitchRow id="gx-scroll" label="Fly the camera as you scroll" hint="Each section has its own view of the galaxy." checked={config.scrollCamera} onChange={(v) => updateConfig('scrollCamera', v)} />
        <SwitchRow id="gx-dim" label="Dim while reading" hint="Eases the galaxy back when you stop scrolling." checked={config.dimWhenReading} onChange={(v) => updateConfig('dimWhenReading', v)} />
      </Stack>

      {/* Advanced */}
      <Accordion allowToggle>
        <AccordionItem border="none">
          <AccordionButton px={0} py={2}>
            <Heading as="h3" size="sm" flex={1} textAlign="left" fontFamily="body">Advanced</Heading>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel px={0} pb={2}>
            <Accordion allowMultiple>
              <AccordionItem borderColor="line.subtle">
                <AccordionButton px={0}><Text flex={1} textAlign="left" fontWeight={600}>Stars</Text><AccordionIcon /></AccordionButton>
                <AccordionPanel px={0}>
                  <Stack spacing={4}>
                    <SliderRow id="gx-density" label="Star density" value={config.starDensity} min={0.1} max={1} step={0.05} format={pct} onChange={(v) => updateConfig('starDensity', v)} />
                    <SliderRow id="gx-size" label="Star size" value={config.starSize} min={0.5} max={2.5} step={0.05} format={x2} onChange={(v) => updateConfig('starSize', v)} />
                    <SwitchRow id="gx-twinkle" label="Twinkle" hint="Off automatically on Low and Minimal tiers." checked={config.twinkle} onChange={(v) => updateConfig('twinkle', v)} />
                    <SectionReset onClick={() => reset(['starDensity', 'starSize', 'twinkle'], 'Stars')} />
                  </Stack>
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem borderColor="line.subtle">
                <AccordionButton px={0}><Text flex={1} textAlign="left" fontWeight={600}>Layers</Text><AccordionIcon /></AccordionButton>
                <AccordionPanel px={0}>
                  <Stack spacing={4}>
                    <SliderRow id="gx-glow" label="Core and disk glow" value={config.glowIntensity} min={0} max={2} step={0.05} format={x2} onChange={(v) => updateConfig('glowIntensity', v)} />
                    <SwitchRow id="gx-l-glow" label="Unresolved starlight" checked={config.layers.glow} onChange={(v) => updateLayer('glow', v)} />
                    <SwitchRow id="gx-l-dust" label="Dust lanes" hint="Not drawn on the Minimal tier." checked={config.layers.dust} onChange={(v) => updateLayer('dust', v)} />
                    <SwitchRow id="gx-l-neb" label="Star-forming nebulae" checked={config.layers.nebulae} onChange={(v) => updateLayer('nebulae', v)} />
                    <SwitchRow id="gx-l-halo" label="Halo, globular clusters, Magellanic Clouds" checked={config.layers.halo} onChange={(v) => updateLayer('halo', v)} />
                    <SectionReset onClick={() => reset(['glowIntensity', 'layers'], 'Layers')} />
                  </Stack>
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem borderColor="line.subtle">
                <AccordionButton px={0}><Text flex={1} textAlign="left" fontWeight={600}>Motion</Text><AccordionIcon /></AccordionButton>
                <AccordionPanel px={0}>
                  <Stack spacing={4}>
                    <SliderRow id="gx-orbit" label="One solar orbit takes" value={config.orbitMinutes} min={1} max={30} step={0.5} format={(v) => `${v} min`} valueText={(v) => `${v} minutes per orbit of the Sun, about 230 million years`} onChange={(v) => updateConfig('orbitMinutes', v)} />
                    <SliderRow id="gx-roll" label="Scroll roll" value={config.scrollRoll} min={0} max={720} step={15} format={(v) => `${v}°`} valueText={(v) => `${v} degrees`} onChange={(v) => updateConfig('scrollRoll', v)} />
                    <SliderRow id="gx-parallax" label="3D parallax" value={config.parallax} min={0} max={2} step={0.05} format={x2} onChange={(v) => updateConfig('parallax', v)} />
                    <SwitchRow id="gx-override" label="Keep motion with reduced-motion on" hint="Your device asks for less motion. Turn this on to override that for the galaxy only." checked={config.overrideReducedMotion} onChange={(v) => updateConfig('overrideReducedMotion', v)} />
                    <SectionReset onClick={() => reset(['orbitMinutes', 'scrollRoll', 'parallax', 'overrideReducedMotion'], 'Motion')} />
                  </Stack>
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem borderColor="line.subtle">
                <AccordionButton px={0}><Text flex={1} textAlign="left" fontWeight={600}>Sagittarius A*</Text><AccordionIcon /></AccordionButton>
                <AccordionPanel px={0}>
                  <Stack spacing={4}>
                    <SwitchRow id="gx-bh" label="Show black hole" checked={config.blackHole.isEnabled} onChange={(v) => updateBlackHoleConfig('isEnabled', v)} />
                    <SliderRow id="gx-bh-size" label="Size" value={config.blackHole.size} min={4} max={120} step={1} format={(v) => `${v}px`} valueText={(v) => `${v} pixels`} onChange={(v) => updateBlackHoleConfig('size', v)} />
                    <SwitchRow id="gx-bh-disk" label="Accretion disk" checked={config.blackHole.accretionDisk} onChange={(v) => updateBlackHoleConfig('accretionDisk', v)} />
                    <SliderRow id="gx-bh-spin" label="Disk spin" value={config.blackHole.spin} min={0} max={3} step={0.05} format={x2} onChange={(v) => updateBlackHoleConfig('spin', v)} />
                    <Text fontSize="xs" color="content.muted">Greatly exaggerated: at true scale Sgr A* would be far smaller than a pixel.</Text>
                  </Stack>
                </AccordionPanel>
              </AccordionItem>

              <AccordionItem borderColor="line.subtle" borderBottomWidth="0">
                <AccordionButton px={0}><Text flex={1} textAlign="left" fontWeight={600}>Navigation and diagnostics</Text><AccordionIcon /></AccordionButton>
                <AccordionPanel px={0}>
                  <Stack spacing={4}>
                    <SwitchRow id="gx-sun" label="Mark the Sun" checked={config.showSunMarker} onChange={(v) => updateConfig('showSunMarker', v)} />
                    <SwitchRow id="gx-labels" label="Labels in Explore mode" checked={config.exploreLabels} onChange={(v) => updateConfig('exploreLabels', v)} />
                    <SwitchRow id="gx-stats" label="Performance overlay" checked={config.showStats} onChange={(v) => updateConfig('showStats', v)} />
                  </Stack>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>

      <Button size="sm" variant="outline" leftIcon={<FiRotateCcw aria-hidden="true" />} onClick={() => reset('all', 'All galaxy settings')}>
        Reset everything
      </Button>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Launcher: button, shortcut, coach mark, panel/drawer
// ---------------------------------------------------------------------------

export default function GalaxyControls({ raised = false }: { raised?: boolean }) {
  const [open, setOpen] = useState(false);
  const [coach, setCoach] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });
  const fabRef = useRef<HTMLButtonElement>(null);

  const dismissCoach = useCallback(() => {
    setCoach(false);
    try {
      window.localStorage.setItem(COACH_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setOpen((o) => !o);
    dismissCoach();
  }, [dismissCoach]);

  // "G" toggles the panel (not while typing, and never with modifier keys).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'g' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName))) return;
      toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);

  // One-time hint after ten seconds on a first visit.
  useEffect(() => {
    let seen = false;
    try {
      seen = window.localStorage.getItem(COACH_KEY) === '1';
    } catch {
      seen = true;
    }
    if (seen) return;
    const show = window.setTimeout(() => setCoach(true), 10000);
    const hide = window.setTimeout(() => setCoach(false), 24000);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, []);

  return (
    <>
      <Box position="fixed" right={{ base: 3, md: 5 }} bottom={{ base: raised ? 'calc(112px + env(safe-area-inset-bottom))' : 'calc(12px + env(safe-area-inset-bottom))', md: 5 }} zIndex={60}>
        {coach && !open && (
          <HStack
            role="status"
            position="absolute"
            right={0}
            bottom="64px"
            w="max-content"
            maxW="260px"
            bg="surface.raised"
            border="1px solid"
            borderColor="accent.fg"
            borderRadius="xl"
            pl={4}
            pr={1}
            py={2}
            boxShadow="lg"
            spacing={2}
          >
            <Text fontSize="sm">Tune the galaxy ✦ <Text as="span" color="content.muted">(press G)</Text></Text>
            <CloseButton size="sm" aria-label="Dismiss hint" onClick={dismissCoach} />
          </HStack>
        )}
        <Tooltip label="Galaxy settings (G)" placement="left" openDelay={400}>
          <IconButton
            ref={fabRef}
            aria-label="Galaxy settings"
            aria-expanded={open}
            aria-controls="galaxy-settings-panel"
            icon={open ? <FiX size={22} /> : <GiGalaxy size={26} />}
            variant="glass"
            borderRadius="full"
            boxSize="52px"
            boxShadow="lg"
            borderColor={open ? 'accent.fg' : 'line.subtle'}
            onClick={toggle}
          />
        </Tooltip>
      </Box>

      {isMobile ? (
        <Drawer isOpen={open} onClose={() => setOpen(false)} placement="bottom" finalFocusRef={fabRef}>
          <DrawerOverlay />
          <DrawerContent id="galaxy-settings-panel" borderTopRadius="2xl" maxH="85dvh" aria-label="Galaxy settings">
            <Box aria-hidden="true" mx="auto" mt={2} w="40px" h="4px" borderRadius="full" bg="whiteAlpha.400" />
            <Flex align="center" justify="space-between" px={5} pt={3}>
              <Heading as="h2" size="md">Galaxy settings</Heading>
              <CloseButton onClick={() => setOpen(false)} aria-label="Close galaxy settings" />
            </Flex>
            <DrawerBody px={5} pt={4} pb="calc(24px + env(safe-area-inset-bottom))"><ControlsPanel onClose={() => setOpen(false)} /></DrawerBody>
          </DrawerContent>
        </Drawer>
      ) : (
        open && (
          <Box
            id="galaxy-settings-panel"
            role="dialog"
            aria-modal="false"
            aria-label="Galaxy settings"
            position="fixed"
            right={5}
            bottom="84px"
            w="380px"
            maxH="calc(100dvh - 124px)"
            overflowY="auto"
            zIndex={60}
            bg="surface.glassStrong"
            border="1px solid"
            borderColor="line.subtle"
            borderRadius="2xl"
            boxShadow="xl"
            backdropFilter="blur(16px) saturate(160%)"
            p={5}
          >
            <Flex align="center" justify="space-between" mb={4}>
              <Heading as="h2" size="md">Galaxy settings</Heading>
              <CloseButton onClick={() => { setOpen(false); fabRef.current?.focus(); }} aria-label="Close galaxy settings" />
            </Flex>
            <ControlsPanel onClose={() => { setOpen(false); fabRef.current?.focus(); }} />
          </Box>
        )
      )}
    </>
  );
}
