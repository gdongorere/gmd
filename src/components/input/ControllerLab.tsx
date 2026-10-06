// src/components/input/ControllerLab.tsx
'use client';

import React, { useRef, useState } from 'react';
import NextLink from 'next/link';
import { Badge, Box, Button, Container, Flex, Heading, List, ListItem, Progress, SimpleGrid, Text, VisuallyHidden } from '@chakra-ui/react';
import { usePadFrames, usePadStatus } from './usePad';
import { padHub } from '@/lib/input/hub';
import {
  CONTROLS, LEARN_STEPS, applyLearned, buttonName, clearLearned, detectBinding, emptyLearned, saveLearned, type LearnedMapping, type RawPad,
} from '@/lib/input/gamepad';

interface Live { axes: number[]; pressed: boolean[]; mapping: string; shaped: { lx: number; ly: number; rx: number; ry: number; l2: number; r2: number }; down: string[] }

const snapshot = (r: RawPad): RawPad => ({ ...r, axes: Array.from(r.axes), buttons: Array.from(r.buttons, (b) => ({ pressed: b.pressed, value: b.value })) });

/** Moves the wizard on when the pad has been still for a few frames, then waits for a button press or a stick push. */
export default function ControllerLab() {
  const pad = usePadStatus();
  const [live, setLive] = useState<Live | null>(null);
  const [rumbleNote, setRumbleNote] = useState('');
  const [step, setStep] = useState<number | null>(null);
  const [learned, setLearned] = useState<LearnedMapping | null>(null);
  const [saved, setSaved] = useState<boolean | null>(null);
  const armed = useRef(false);
  const rest = useRef<RawPad | null>(null);
  const prevAxes = useRef<number[]>([]);
  const stillFrames = useRef(0);
  const lastLive = useRef(0);
  const stepRef = useRef<number | null>(null);
  stepRef.current = step;
  const learnedRef = useRef<LearnedMapping | null>(null);
  learnedRef.current = learned;

  usePadFrames(({ pad: p, raw }) => {
    const now = performance.now();
    if (raw && now - lastLive.current > 66) {
      lastLive.current = now;
      setLive({
        axes: Array.from(raw.axes), pressed: Array.from(raw.buttons, (b) => b.pressed || b.value > 0.5), mapping: raw.mapping,
        shaped: { lx: p.lx, ly: p.ly, rx: p.rx, ry: p.ry, l2: p.l2, r2: p.r2 }, down: CONTROLS.filter((c) => p.down[c]),
      });
    }
    const s = stepRef.current;
    if (s === null || !raw || !learnedRef.current) return;
    const axes = Array.from(raw.axes);
    const changed = axes.some((a, i) => Math.abs(a - (prevAxes.current[i] ?? a)) > 0.05) || raw.buttons.some((b) => b.pressed);
    prevAxes.current = axes;
    if (!armed.current) {
      stillFrames.current = changed ? 0 : stillFrames.current + 1;
      if (stillFrames.current >= 8) { rest.current = snapshot(raw); armed.current = true; }
      return;
    }
    const b = detectBinding(rest.current!, raw);
    if (!b) return;
    const next = applyLearned(learnedRef.current, LEARN_STEPS[s], b);
    armed.current = false; stillFrames.current = 0;
    setLearned(next);
    advance(s);
  });

  function advance(from: number) {
    const n = from + 1;
    if (n >= LEARN_STEPS.length) { setStep(null); armed.current = false; return; }
    setStep(n);
  }
  function start() {
    if (!pad?.id) return;
    setLearned(emptyLearned(pad.id)); setStep(0); setSaved(null); armed.current = false; stillFrames.current = 0;
  }
  function save() {
    if (!learned) return;
    setSaved(saveLearned(learned));
    padHub.refresh();
  }
  function reset() { if (pad?.id) { clearLearned(pad.id); padHub.refresh(); setLearned(null); setStep(null); setSaved(null); } }
  function testRumble() {
    const ok = padHub.rumble({ strong: 0.9, weak: 0.9, ms: 500 });
    setRumbleNote(ok ? 'Vibration sent. If nothing moved, this browser or system does not pass rumble through to the controller.' : 'This browser does not expose vibration for this controller.');
  }

  const learning = step !== null;
  return (
    <Container maxW="3xl" py={{ base: 8, md: 12 }} px={4}>
      <Button as={NextLink} href="/stars" size="sm" variant="outline" mb={6}>← Back to the Milky Way</Button>
      <Heading as="h1" size="lg" mb={2}>Controller check</Heading>
      <Text color="content.secondary" mb={6}>
        DualShock 4, DualSense, Xbox and most other gamepads work in any browser, over USB or Bluetooth, on desktop, Android and iPhone/iPad.
        Connect it, then press any button once: browsers only show a controller after its first button press.
      </Text>

      <Box p={4} border="1px solid" borderColor="line.subtle" borderRadius="lg" bg="surface.inset" mb={6} data-testid="pad-status">
        {pad ? (
          <>
            <Flex gap={2} align="center" wrap="wrap">
              <Badge colorScheme="green">Connected</Badge>
              <Text fontWeight={700} data-testid="pad-label">{pad.label}</Text>
              <Badge colorScheme={pad.source === 'fallback' ? 'orange' : 'blue'} data-testid="pad-source">
                {pad.source === 'standard' ? 'standard layout' : pad.source === 'profile' ? 'built-in DS4 profile' : pad.source === 'learned' ? 'your saved mapping' : 'unknown layout'}
              </Badge>
            </Flex>
            <Text fontSize="xs" color="content.muted" mt={1} wordBreak="break-all">{pad.id}</Text>
            {pad.source === 'fallback' && <Text fontSize="sm" color="orange.300" mt={2}>This controller reports a layout we don’t recognise. Run “Teach this controller” below; it takes about 30 seconds and is remembered on this device.</Text>}
          </>
        ) : (
          <Text>No controller yet. Press any button on it. For a DualShock 4: hold <b>PS + Share</b> until the light bar flashes, then pair it in Bluetooth settings (or plug in a USB cable).</Text>
        )}
      </Box>

      {pad && (
        <>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6} mb={6}>
            <Box>
              <Text fontWeight={600} mb={2}>Sticks and triggers (after dead zone)</Text>
              {(['lx', 'ly', 'rx', 'ry'] as const).map((k) => (
                <Box key={k} mb={2}>
                  <Flex justify="space-between" fontSize="xs"><Text>{{ lx: 'Left stick X', ly: 'Left stick Y', rx: 'Right stick X', ry: 'Right stick Y' }[k]}</Text><Text fontFamily="mono">{(live?.shaped[k] ?? 0).toFixed(2)}</Text></Flex>
                  <Progress value={((live?.shaped[k] ?? 0) + 1) * 50} size="xs" aria-label={k} />
                </Box>
              ))}
              {(['l2', 'r2'] as const).map((k) => (
                <Box key={k} mb={2}>
                  <Flex justify="space-between" fontSize="xs"><Text>{k === 'l2' ? 'L2' : 'R2'}</Text><Text fontFamily="mono">{(live?.shaped[k] ?? 0).toFixed(2)}</Text></Flex>
                  <Progress value={(live?.shaped[k] ?? 0) * 100} size="xs" aria-label={k} />
                </Box>
              ))}
            </Box>
            <Box>
              <Text fontWeight={600} mb={2}>Buttons pressed</Text>
              <Flex gap={1} wrap="wrap" minH="40px" data-testid="pad-down">
                {(live?.down ?? []).map((c) => <Badge key={c} colorScheme="blue">{buttonName(c as never, pad.family)}</Badge>)}
                {(live?.down.length ?? 0) === 0 && <Text fontSize="sm" color="content.muted">none</Text>}
              </Flex>
              <Text fontSize="xs" color="content.muted" mt={3}>Browser-reported layout: <b>{live?.mapping || '(none, raw)'}</b> · {live?.axes.length ?? 0} axes · {live?.pressed.length ?? 0} buttons</Text>
              <Button mt={3} size="sm" variant="outline" onClick={testRumble}>Test vibration</Button>
              {rumbleNote && <Text fontSize="xs" color="content.secondary" mt={2}>{rumbleNote}</Text>}
            </Box>
          </SimpleGrid>

          <Box p={4} border="1px solid" borderColor="line.subtle" borderRadius="lg" mb={6}>
            <Text fontWeight={600} mb={1}>Teach this controller</Text>
            <Text fontSize="sm" color="content.secondary" mb={3}>If a button or stick does the wrong thing, press each control when asked. The mapping is saved only in this browser.</Text>
            {!learning && <Flex gap={2} wrap="wrap"><Button size="sm" onClick={start}>Start</Button>{pad.source === 'learned' && <Button size="sm" variant="outline" onClick={reset}>Forget my mapping</Button>}</Flex>}
            {learning && step !== null && (
              <Box data-testid="wizard">
                <Text fontWeight={600} data-testid="wizard-prompt">{LEARN_STEPS[step].prompt}</Text>
                <Progress value={(step / LEARN_STEPS.length) * 100} size="xs" my={2} aria-label="Wizard progress" />
                <Flex gap={2}>
                  {LEARN_STEPS[step].optional && <Button size="sm" variant="outline" onClick={() => { armed.current = false; advance(step); }}>Skip</Button>}
                  <Button size="sm" variant="ghost" onClick={() => { setStep(null); }}>Stop</Button>
                </Flex>
              </Box>
            )}
            {!learning && learned && (
              <Flex gap={2} mt={3} align="center" wrap="wrap">
                <Button size="sm" variant="solid" onClick={save}>Save this mapping</Button>
                {saved === true && <Text fontSize="sm" color="green.300">Saved. It is used the next time you open the Milky Way.</Text>}
                {saved === false && <Text fontSize="sm" color="orange.300">This browser blocked saving; the mapping works until you leave the page.</Text>}
              </Flex>
            )}
          </Box>
        </>
      )}

      <Box>
        <Text fontWeight={600} mb={2}>Connecting a DualShock 4</Text>
        <List spacing={1} fontSize="sm" color="content.secondary" styleType="disc" pl={5}>
          <ListItem><b>Any device, USB:</b> plug it in with a micro-USB data cable (a charge-only cable won’t work), then press a button.</ListItem>
          <ListItem><b>Bluetooth:</b> hold <b>PS + Share</b> until the light bar flashes quickly, then pick “Wireless Controller” in Bluetooth settings.</ListItem>
          <ListItem><b>iPhone / iPad (iOS 13+):</b> pair it in Settings → Bluetooth, open this site in Safari, then press a button.</ListItem>
          <ListItem><b>Android:</b> pair in Bluetooth settings; use Chrome. <b>Windows / Mac / Linux / ChromeOS:</b> Chrome, Edge, Firefox or Safari all work.</ListItem>
          <ListItem>Web pages can read the sticks, triggers, buttons and (in most browsers) the touchpad <i>click</i>, and can ask for vibration. The touchpad surface, light bar, gyroscope and battery level are not part of the browser standard, so they are not used.</ListItem>
        </List>
      </Box>
      <VisuallyHidden role="status" aria-live="polite">{pad ? `${pad.label} connected` : 'No controller connected'}</VisuallyHidden>
    </Container>
  );
}
