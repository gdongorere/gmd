// src/components/solar/SolarView.tsx
'use client';

import React from 'react';
import { Box, Button, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { motion, useReducedMotion } from 'framer-motion';
import { FiArrowLeft } from 'react-icons/fi';
import { EarthView } from './EarthView';
import { MarsView } from './MarsView';
import { Orrery } from './Orrery';
import { SunInGalaxy } from './SunInGalaxy';

export type SolarTab = 'system' | 'earth' | 'mars' | 'sun';
const ORDER: SolarTab[] = ['system', 'earth', 'mars', 'sun'];

/**
 * The step down from the galaxy: Sun's neighbourhood, Earth, Mars and the verification card.
 * It covers the galaxy view but leaves the toolbar and the time panel on top.
 */
export default function SolarView({ onClose, initialTab = 'system' }: { onClose: () => void; initialTab?: SolarTab }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      aria-label="The Sun and the Solar System"
      initial={reduce ? false : { opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduce ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
      style={{ position: 'fixed', inset: 0, zIndex: 20, background: 'rgba(4,6,14,0.96)', backdropFilter: 'blur(6px)', overflowY: 'auto' }}
    >
      <Box pt="72px" pb={{ base: '280px', md: '210px' }} px={{ base: 3, md: 8 }}>
      <Box maxW="1100px" mx="auto">
        <Button size="sm" variant="outline" leftIcon={<FiArrowLeft aria-hidden="true" />} onClick={onClose} mb={4}>Back to the galaxy</Button>
        <Text color="content.secondary" mb={4}>
          You’ve zoomed in to the Sun’s place in the Milky Way. Use the clock below to go to any moment: everything here follows it.
        </Text>
        <Tabs variant="enclosed" isLazy defaultIndex={ORDER.indexOf(initialTab)}>
          <TabList overflowX="auto" overflowY="hidden">
            <Tab>Solar system</Tab>
            <Tab>Earth</Tab>
            <Tab>Mars</Tab>
            <Tab>Sun in the Galaxy</Tab>
          </TabList>
          <TabPanels>
            <TabPanel px={0}><Orrery /></TabPanel>
            <TabPanel px={0}><EarthView /></TabPanel>
            <TabPanel px={0}><MarsView /></TabPanel>
            <TabPanel px={0}><SunInGalaxy /></TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
      </Box>
    </motion.section>
  );
}
