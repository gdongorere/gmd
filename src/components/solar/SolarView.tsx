// src/components/solar/SolarView.tsx
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { FiArrowLeft } from 'react-icons/fi';
import { EarthView } from './EarthView';
import { MarsView } from './MarsView';
import { Orrery } from './Orrery';
import { System3D, solar3dSupported } from './System3D';
import { SunInGalaxy } from './SunInGalaxy';

export type SolarTab = '3d' | 'system' | 'earth' | 'mars' | 'sun';
const ORDER: SolarTab[] = ['3d', 'system', 'earth', 'mars', 'sun'];

/**
 * The step down from the galaxy: Sun's neighbourhood, Earth, Mars and the verification card.
 * It covers the galaxy view but leaves the toolbar and the time panel on top.
 */
export default function SolarView({ onClose, initialTab, autoDescend = false, hudHidden = false }: { onClose: () => void; initialTab?: SolarTab; autoDescend?: boolean; hudHidden?: boolean }) {
  const reduce = useReducedMotion();
  // The 3D scene needs WebGL and a capable device; everything else is plain 2D and works anywhere.
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => setSupported(solar3dSupported()), []);
  const [tab, setTab] = useState<number | null>(null);
  const start = supported === null ? null : initialTab && (initialTab !== '3d' || supported) ? ORDER.indexOf(initialTab) : supported ? 0 : 1;
  const index = tab ?? start;
  const hud = index === 0;
  const fallBack = useCallback(() => { setSupported(false); setTab(1); }, []);
  return (
    <motion.section
      aria-label="The Sun and the Solar System"
      initial={reduce ? false : { opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduce ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(4,6,14,0.96)', backdropFilter: 'blur(6px)', overflowY: 'auto' }}
    >
      <Box
        {...(hud
          ? { position: 'fixed' as const, top: '64px', left: 3, right: { base: 3, md: '260px' }, zIndex: 25, pointerEvents: 'none' as const }
          : { pt: '72px', pb: { base: '280px', md: '210px' }, px: { base: 3, md: 8 } })}
      >
      <Box maxW={hud ? 'none' : '1100px'} mx="auto" sx={hud ? { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 2, '& > *': { pointerEvents: 'auto' } } : undefined}>
        <Button display={hud && hudHidden ? 'none' : undefined} size={hud ? 'xs' : 'sm'} h={hud ? '30px' : undefined} position="relative" zIndex={1} variant={hud ? 'glass' : 'outline'} leftIcon={<FiArrowLeft aria-hidden="true" />} onClick={onClose} mb={hud ? 0 : 4}>Back to the galaxy</Button>
        {!hud && <Text color="content.secondary" mb={4}>
          You’ve zoomed in to the Sun’s place in the Milky Way. Use the clock below to go to any moment: everything here follows it.
        </Text>}
        {index !== null && (
        <Tabs variant="enclosed" isLazy index={index} onChange={setTab} w={hud ? 'auto' : undefined} maxW="100%">
          <TabList overflowX="auto" overflowY="hidden" {...(hud ? { display: hudHidden ? 'none' : 'inline-flex', position: 'relative' as const, zIndex: 1, bg: 'rgba(8,10,20,0.62)', backdropFilter: 'blur(10px)', borderRadius: 'xl', maxW: '100%' } : {})}>
            <Tab whiteSpace="nowrap" fontSize={{ base: 'xs', md: 'sm' }} py={hud ? 1 : undefined} px={hud ? 2 : undefined} isDisabled={!supported}>3D system</Tab>
            <Tab whiteSpace="nowrap" fontSize={{ base: 'xs', md: 'sm' }} py={hud ? 1 : undefined} px={hud ? 2 : undefined}>Top-down</Tab>
            <Tab whiteSpace="nowrap" fontSize={{ base: 'xs', md: 'sm' }} py={hud ? 1 : undefined} px={hud ? 2 : undefined}>Earth</Tab>
            <Tab whiteSpace="nowrap" fontSize={{ base: 'xs', md: 'sm' }} py={hud ? 1 : undefined} px={hud ? 2 : undefined}>Mars</Tab>
            <Tab whiteSpace="nowrap" fontSize={{ base: 'xs', md: 'sm' }} py={hud ? 1 : undefined} px={hud ? 2 : undefined}>Sun in the Galaxy</Tab>
          </TabList>
          <TabPanels>
            <TabPanel px={0} p={hud ? 0 : undefined}>{supported && <System3D autoDescend={autoDescend} hud={!hudHidden} onFallback={fallBack} />}</TabPanel>
            <TabPanel px={0}><Orrery /></TabPanel>
            <TabPanel px={0}><EarthView /></TabPanel>
            <TabPanel px={0}><MarsView /></TabPanel>
            <TabPanel px={0}><SunInGalaxy /></TabPanel>
          </TabPanels>
        </Tabs>
        )}
        {supported === false && <Text mt={2} fontSize="xs" color="content.muted">The 3D view needs WebGL and a capable device, so the top-down map is shown instead.</Text>}
      </Box>
      </Box>
    </motion.section>
  );
}
