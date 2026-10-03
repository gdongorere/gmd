// src/components/HouseViewerShell.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import NextLink from 'next/link';
import {
  Box, Button, Checkbox, Flex, Heading, HStack, IconButton, Image, Kbd, Popover, PopoverArrow, PopoverBody, PopoverContent, PopoverTrigger,
  SimpleGrid, Stack, Text,
} from '@chakra-ui/react';
import { FiArrowLeft, FiHelpCircle, FiMaximize, FiMinimize } from 'react-icons/fi';
import App from '@/components/App';
import { GlassCard } from '@/components/ui';
import { detectDevice } from '@/lib/galaxy/quality';
import { galaxyBus } from '@/lib/galaxy/bus';

const SKIP_KEY = 'gmd.house.intro.v1';

type Stage = 'checking' | 'intro' | 'running' | 'unsupported';

function ControlsList() {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={5}>
      <Stack spacing={2}>
        <Heading as="h3" size="sm" fontFamily="body">Keyboard and mouse</Heading>
        <Text color="content.secondary" fontSize="sm"><Kbd>W</Kbd> <Kbd>A</Kbd> <Kbd>S</Kbd> <Kbd>D</Kbd> walk · click the scene, then move the mouse to look · <Kbd>Esc</Kbd> releases the mouse</Text>
      </Stack>
      <Stack spacing={2}>
        <Heading as="h3" size="sm" fontFamily="body">Touch</Heading>
        <Text color="content.secondary" fontSize="sm">Hold the left buttons to walk forward or back. Hold the arrows on the right to look around.</Text>
      </Stack>
    </SimpleGrid>
  );
}

export default function HouseViewerShell() {
  const [stage, setStage] = useState<Stage>('checking');
  const [skipNext, setSkipNext] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled;

  // The 3D viewer covers the galaxy, so stop rendering it while this page is open.
  useEffect(() => {
    galaxyBus.paused = true;
    document.documentElement.style.overscrollBehaviorY = 'contain';
    return () => {
      galaxyBus.paused = false;
      document.documentElement.style.overscrollBehaviorY = '';
    };
  }, []);

  useEffect(() => {
    if (detectDevice().ceiling === 'static') {
      setStage('unsupported');
      return;
    }
    let skip = false;
    try {
      skip = window.localStorage.getItem(SKIP_KEY) === '1';
    } catch {
      /* ignore */
    }
    setStage(skip ? 'running' : 'intro');
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const start = useCallback(() => {
    if (skipNext) {
      try {
        window.localStorage.setItem(SKIP_KEY, '1');
      } catch {
        /* ignore */
      }
    }
    setStage('running');
  }, [skipNext]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  if (stage === 'checking') return <Box minH="100dvh" aria-busy="true" />;

  if (stage === 'running') {
    return (
      <Box as="div" position="relative" minH="100dvh" bg="black">
        <App />
        <HStack position="fixed" top={3} left={3} right={3} zIndex={40} justify="space-between" pointerEvents="none">
          <Button as={NextLink} href="/projects/house-viewer" variant="glass" leftIcon={<FiArrowLeft aria-hidden="true" />} h="48px" pointerEvents="auto">Exit tour</Button>
          <HStack pointerEvents="auto" spacing={2}>
            <Popover placement="bottom-end">
              <PopoverTrigger>
                <IconButton aria-label="Controls help" icon={<FiHelpCircle size={20} />} variant="glass" boxSize="48px" />
              </PopoverTrigger>
              <PopoverContent bg="surface.raised" borderColor="line.strong" w="min(420px, 92vw)">
                <PopoverArrow bg="surface.raised" />
                <PopoverBody p={4}><ControlsList /></PopoverBody>
              </PopoverContent>
            </Popover>
            {canFullscreen && (
              <IconButton aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'} icon={fullscreen ? <FiMinimize size={20} /> : <FiMaximize size={20} />} variant="glass" boxSize="48px" onClick={toggleFullscreen} />
            )}
          </HStack>
        </HStack>
      </Box>
    );
  }

  if (stage === 'unsupported') {
    return (
      <Flex minH="100dvh" align="center" justify="center" p={5}>
        <GlassCard strong p={{ base: 6, md: 10 }} maxW="2xl" textAlign="center">
          <Stack spacing={5} align="center">
            <Heading as="h1" size="xl">The 3D tour needs WebGL</Heading>
            <Text color="content.secondary">Your browser or device can’t run WebGL right now, so the interactive house can’t start. Here’s what it looks like:</Text>
            <Image src="/projects/house-viewer.desktop.png" alt="The 3D house viewer: a walkable house with sunlight and an on-screen control panel" borderRadius="xl" maxH="320px" objectFit="contain" />
            <Button as={NextLink} href="/projects/house-viewer">Read the case study</Button>
          </Stack>
        </GlassCard>
      </Flex>
    );
  }

  return (
    <Flex minH="100dvh" align="center" justify="center" p={5}>
      <GlassCard strong p={{ base: 6, md: 10 }} maxW="2xl" w="100%">
        <Stack spacing={6}>
          <Stack spacing={2}>
            <Text color="accent.fg" fontWeight={700} fontSize="sm" letterSpacing="0.14em" textTransform="uppercase">Interactive demo</Text>
            <Heading as="h1" size="2xl">Walk through a 3D house</Heading>
            <Text color="content.secondary" fontSize="lg">
              A physics-enabled scene built with Three.js. You’ll download the 3D model (up to about 2&nbsp;MB) and it runs entirely in your browser.
            </Text>
          </Stack>
          <ControlsList />
          <Checkbox isChecked={skipNext} onChange={(e) => setSkipNext(e.target.checked)} colorScheme="orange">Don’t show this screen next time</Checkbox>
          <HStack spacing={3} flexWrap="wrap">
            <Button size="lg" onClick={start} autoFocus>Start the tour</Button>
            <Button as={NextLink} href="/projects/house-viewer" size="lg" variant="outline">Back to the case study</Button>
          </HStack>
        </Stack>
      </GlassCard>
    </Flex>
  );
}
