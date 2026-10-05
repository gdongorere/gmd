// src/components/solar/TimePanel.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Button, Flex, FormControl, FormLabel, HStack, IconButton, Input, Menu, MenuButton, MenuItem, MenuList, Modal, ModalBody,
  ModalCloseButton, ModalContent, ModalHeader, ModalOverlay, NumberInput, NumberInputField, Select, SimpleGrid, Stack, Text, Tooltip, VisuallyHidden,
} from '@chakra-ui/react';
import { FiChevronDown, FiClock, FiMaximize, FiMinimize, FiPause, FiPlay, FiRewind, FiFastForward } from 'react-icons/fi';
import { RATE_PRESETS, describeEpoch, simClock, unixMsOrNaN } from '@/lib/astro/clock';
import { MONTHS, calendarFromJd, jdFromCalendar, jdFromUnixMs, formatDateHuman, formatTime } from '@/lib/astro/julian';
import { localClock } from '@/lib/astro/time';
import { accuracyReport, type Level } from '@/lib/astro/accuracy';
import { DATED_STORMS } from '@/lib/astro/mars';
import { useSimClock, useViewerZone } from './useSimClock';

const LEVEL_COLOR: Record<Level, string> = { precise: 'green', good: 'teal', approximate: 'orange', schematic: 'purple', 'n/a': 'gray' };

const DAY = 365.25;
interface Preset { label: string; detail: string; jd: () => number }
const PRESETS: Preset[] = [
  { label: 'Now', detail: 'Back to the real clock', jd: () => jdFromUnixMs(Date.now()) },
  { label: 'Mars dust storm 2018', detail: 'Global storm begins (Mars Year 34, Ls 185°)', jd: () => DATED_STORMS.find((s) => s.id === '2018')!.startJd },
  { label: 'Mars dust storm 2001', detail: 'Global storm begins in Hellas', jd: () => DATED_STORMS.find((s) => s.id === '2001')!.startJd },
  { label: 'Mars dust storm 1971', detail: 'Mariner 9 arrives at a veiled planet', jd: () => DATED_STORMS.find((s) => s.id === '1971')!.startJd },
  { label: 'Last Glacial Maximum', detail: '≈ 21,000 years ago: ice to ~40°N, seas 130 m lower', jd: () => jdFromCalendar(-19050, 1, 15, 12) },
  { label: 'Eemian interglacial', detail: '≈ 125,000 years ago: warmer than today, seas ~7 m higher', jd: () => jdFromCalendar(-123050, 6, 21, 12) },
  { label: 'Penultimate glaciation', detail: '≈ 150,000 years ago', jd: () => jdFromCalendar(-148050, 1, 15, 12) },
  { label: 'Dinosaurs end', detail: '66 million years ago (galaxy only)', jd: () => jdFromCalendar(2026, 10, 5, 12) - 66e6 * DAY },
  { label: 'One galactic year ago', detail: '≈ 203 million years ago (galaxy only)', jd: () => jdFromCalendar(2026, 10, 5, 12) - 203e6 * DAY },
];

function useFullscreen() {
  const [full, setFull] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(!!document.documentElement.requestFullscreen);
    const on = () => setFull(!!document.fullscreenElement);
    on();
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const toggle = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* user gesture refused or unsupported: nothing to do */ }
  };
  return { full, toggle, supported };
}

function TimeMachineDialog({ isOpen, onClose, jd }: { isOpen: boolean; onClose: () => void; jd: number }) {
  const clock = simClock();
  const nowJd = jdFromUnixMs(Date.now());
  const c = calendarFromJd(jd);
  const [era, setEra] = useState<'CE' | 'BCE'>('CE');
  const [year, setYear] = useState('2026');
  const [month, setMonth] = useState(10);
  const [day, setDay] = useState('5');
  const [time, setTime] = useState('12:00');
  const [myr, setMyr] = useState('0');

  useEffect(() => {
    if (!isOpen) return;
    setEra(c.year > 0 ? 'CE' : 'BCE');
    setYear(String(c.year > 0 ? c.year : 1 - c.year));
    setMonth(c.month);
    setDay(String(c.day));
    setTime(`${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const go = () => {
    const y = Number(year);
    if (!Number.isFinite(y)) return;
    const astroYear = era === 'CE' ? y : 1 - y;
    const [hh, mm] = time.split(':').map((n) => Number(n) || 0);
    clock.setJd(jdFromCalendar(astroYear, month, Math.min(31, Math.max(1, Number(day) || 1)), hh, mm));
    onClose();
  };
  const goMyr = () => {
    const m = Number(myr);
    if (!Number.isFinite(m)) return;
    clock.setJd(nowJd + m * 1e6 * DAY);
    onClose();
  };
  const report = useMemo(() => accuracyReport(jd, nowJd), [jd, nowJd]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" isCentered scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent mx={3}>
        <ModalHeader>Time machine</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <Stack spacing={6}>
            <Box>
              <Text fontWeight={600} mb={2}>Jump to a date (UTC)</Text>
              <Flex gap={2} wrap="wrap" align="flex-end">
                <FormControl w="auto"><FormLabel fontSize="xs" mb={1}>Day</FormLabel>
                  <NumberInput min={1} max={31} value={day} onChange={setDay} w="72px"><NumberInputField /></NumberInput></FormControl>
                <FormControl w="auto"><FormLabel fontSize="xs" mb={1}>Month</FormLabel>
                  <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} w="96px">
                    {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                  </Select></FormControl>
                <FormControl w="auto"><FormLabel fontSize="xs" mb={1}>Year</FormLabel>
                  <NumberInput min={1} max={999999} value={year} onChange={setYear} w="120px"><NumberInputField /></NumberInput></FormControl>
                <FormControl w="auto"><FormLabel fontSize="xs" mb={1}>Era</FormLabel>
                  <Select value={era} onChange={(e) => setEra(e.target.value as 'CE' | 'BCE')} w="88px"><option>CE</option><option>BCE</option></Select></FormControl>
                <FormControl w="auto"><FormLabel fontSize="xs" mb={1}>Time (UTC)</FormLabel>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} w="140px" /></FormControl>
                <Button variant="solid" onClick={go}>Go</Button>
              </Flex>
              <Flex gap={2} mt={3} align="flex-end" wrap="wrap">
                <FormControl w="auto"><FormLabel fontSize="xs" mb={1}>or millions of years from now (negative = past)</FormLabel>
                  <NumberInput value={myr} onChange={setMyr} w="150px"><NumberInputField /></NumberInput></FormControl>
                <Button onClick={goMyr}>Go</Button>
              </Flex>
            </Box>

            <Box>
              <Text fontWeight={600} mb={2}>Famous moments</Text>
              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={2}>
                {PRESETS.map((p) => (
                  <Button key={p.label} variant="outline" h="auto" py={2} justifyContent="flex-start" textAlign="left" whiteSpace="normal" onClick={() => { clock.setJd(p.jd()); if (p.label === 'Now') clock.now(); onClose(); }}>
                    <Box><Text fontWeight={600}>{p.label}</Text><Text fontSize="xs" color="content.muted" fontWeight={400}>{p.detail}</Text></Box>
                  </Button>
                ))}
              </SimpleGrid>
            </Box>

            <Box>
              <Text fontWeight={600} mb={1}>How accurate is this moment?</Text>
              <Text fontSize="sm" color="content.muted" mb={3}>Every part of the simulation reports how far it can be trusted at the chosen time.</Text>
              <Stack spacing={2}>
                {report.map((r) => (
                  <Flex key={r.id} gap={3} align="flex-start">
                    <Badge colorScheme={LEVEL_COLOR[r.level]} minW="92px" textAlign="center" mt={0.5}>{r.level}</Badge>
                    <Box><Text fontSize="sm" fontWeight={600}>{r.topic}</Text><Text fontSize="sm" color="content.secondary">{r.note}</Text></Box>
                  </Flex>
                ))}
              </Stack>
            </Box>
          </Stack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export function TimePanel({ compact = false }: { compact?: boolean }) {
  const snap = useSimClock(200);
  const zone = useViewerZone();
  const { full, toggle, supported } = useFullscreen();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const clock = simClock();
  const nowJd = jdFromUnixMs(Date.now());

  const epoch = describeEpoch(snap.jd, nowJd);
  const c = calendarFromJd(snap.jd);
  const ms = unixMsOrNaN(snap.jd);
  const local = localClock(snap.jd, zone.name, zone.longitude, ms);
  const showTime = epoch.time !== '';
  const level = useMemo(() => {
    const rows = accuracyReport(snap.jd, nowJd);
    const order: Level[] = ['n/a', 'schematic', 'approximate', 'good', 'precise'];
    const earth = rows.find((r) => r.id === 'earth')!.level;
    return order.indexOf(earth) < order.indexOf('good') ? earth : rows.find((r) => r.id === 'time')!.level;
  }, [snap.jd, nowJd]);

  const rateLabel = snap.rate === 1 ? 'Real time' : `${snap.rate < 0 ? '−' : ''}${RATE_PRESETS.find((p) => p.secondsPerSecond === Math.abs(snap.rate))?.label ?? `${Math.abs(snap.rate)}×`}`;
  const direction = snap.rate < 0 ? -1 : 1;
  const setPreset = (sps: number) => { clock.setRate(direction * sps); clock.setPlaying(true); };

  return (
    <Box role="group" aria-label="Date and time" w={{ base: 'full', md: 'auto' }} minW={{ md: '420px' }}>
      <Flex gap={3} align="flex-start" justify="space-between">
        <Box minW={0}>
          <HStack spacing={2} align="baseline" wrap="wrap">
            <Text fontSize="xs" color="content.muted" fontWeight={700} letterSpacing="0.08em">UTC</Text>
            <Text fontFamily="mono" fontSize={{ base: 'md', md: 'lg' }} fontWeight={700} minH="1.6em" aria-label={mounted ? `Universal time: ${formatDateHuman(c)} ${showTime ? formatTime(c) : ''}` : 'Universal time'}>
              {mounted ? `${formatDateHuman(c)}${showTime ? `  ${formatTime(c)}` : ''}` : '—'}
            </Text>
          </HStack>
          <HStack spacing={2} align="baseline" wrap="wrap">
            <Text fontSize="xs" color="content.muted" fontWeight={700} letterSpacing="0.08em">{local.kind === 'civil' ? 'LOCAL' : 'MEAN SOLAR'}</Text>
            <Text fontFamily="mono" fontSize="sm" color="content.secondary">
              {mounted && showTime ? local.text : '—'}
              <Text as="span" color="content.muted"> · {local.kind === 'civil' ? zone.name.replace('_', ' ') : `longitude ${zone.longitude.toFixed(0)}°`}</Text>
            </Text>
          </HStack>
          <Text fontSize="xs" color="content.muted" mt={0.5}>
            {mounted ? epoch.relative : ''}{mounted && snap.live ? ' · live' : ''} · <Badge colorScheme={LEVEL_COLOR[level]} variant="subtle" fontSize="2xs">{level}</Badge>
          </Text>
        </Box>
        <HStack spacing={1}>
          <Tooltip label="Time machine: jump to any date" placement="top">
            <IconButton aria-label="Open time machine" icon={<FiClock />} size="sm" variant="outline" onClick={() => setOpen(true)} />
          </Tooltip>
          {supported && (
            <Tooltip label={full ? 'Exit full screen' : 'Full screen'} placement="top">
              <IconButton aria-label={full ? 'Exit full screen' : 'Enter full screen'} icon={full ? <FiMinimize /> : <FiMaximize />} size="sm" variant="outline" onClick={toggle} />
            </Tooltip>
          )}
        </HStack>
      </Flex>

      <HStack spacing={2} mt={2} justify={compact ? 'center' : 'flex-start'} wrap="wrap">
        <IconButton aria-label="Run time backwards" aria-pressed={snap.rate < 0} icon={<FiRewind />} size="sm" variant="outline"
          bg={snap.rate < 0 ? 'accent.subtle' : undefined} borderColor={snap.rate < 0 ? 'accent.fg' : undefined}
          onClick={() => { clock.setRate(-Math.abs(snap.rate)); clock.setPlaying(true); }} />
        <IconButton aria-label={snap.playing ? 'Pause time' : 'Play time'} icon={snap.playing ? <FiPause /> : <FiPlay />} size="sm" variant="outline" onClick={() => clock.setPlaying(!snap.playing)} />
        <IconButton aria-label="Run time forwards" aria-pressed={snap.rate > 0} icon={<FiFastForward />} size="sm" variant="outline"
          bg={snap.rate > 0 ? 'accent.subtle' : undefined} borderColor={snap.rate > 0 ? 'accent.fg' : undefined}
          onClick={() => { clock.setRate(Math.abs(snap.rate)); clock.setPlaying(true); }} />
        <Menu placement="top">
          <MenuButton as={Button} size="sm" variant="outline" rightIcon={<FiChevronDown />} aria-label={`Time speed: ${rateLabel}`}>{rateLabel}</MenuButton>
          <MenuList bg="surface.raised" borderColor="line.strong" maxH="50dvh" overflowY="auto">
            {RATE_PRESETS.map((p) => (
              <MenuItem key={p.id} bg="transparent" _hover={{ bg: 'surface.inset' }} _focus={{ bg: 'surface.inset' }} onClick={() => setPreset(p.secondsPerSecond)}>{p.label}</MenuItem>
            ))}
          </MenuList>
        </Menu>
        <Button size="sm" variant="outline" onClick={() => clock.now()} isDisabled={snap.live}>Now</Button>
      </HStack>
      <VisuallyHidden role="status" aria-live="off">{mounted ? `Simulated time ${epoch.date} ${epoch.time}` : ''}</VisuallyHidden>
      <TimeMachineDialog isOpen={open} onClose={() => setOpen(false)} jd={snap.jd} />
    </Box>
  );
}
