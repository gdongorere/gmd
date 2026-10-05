// src/components/galaxy/explore/ExploreCards.tsx
'use client';

import React from 'react';
import {
  Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel, Box, Button, CloseButton, Flex, Heading, HStack, Stack, Tag, Text,
} from '@chakra-ui/react';
import { FiChevronLeft, FiChevronRight, FiCrosshair } from 'react-icons/fi';
import type { Feature, TourStep } from '@/lib/galaxy/features';
import { GlassCard } from '@/components/ui';

const KIND_LABELS: Record<Feature['kind'], string> = {
  centre: 'Galactic centre', structure: 'Structure', arm: 'Spiral arm', home: 'Home', satellite: 'Satellite galaxy', cluster: 'Globular cluster',
};

const cardPosition = { left: { base: 3, md: 5 }, right: { base: 3, md: 'auto' }, bottom: { base: '150px', md: '104px' } } as const;

export function InfoCard({ feature, onClose, onFlyHere, action }: { feature: Feature; onClose: () => void; onFlyHere: () => void; action?: { label: string; onClick: () => void } }) {
  return (
    <GlassCard
      strong
      as="section"
      aria-label={`${feature.label} details`}
      position="fixed"
      {...cardPosition}
      w={{ base: 'auto', md: '380px' }}
      maxH={{ base: "40dvh", md: "calc(100dvh - 190px)" }}
      overflowY="auto"
      zIndex={30}
      p={5}
    >
      <Flex justify="space-between" align="flex-start" gap={3}>
        <Stack spacing={1}>
          <Tag variant="accent" size="sm" alignSelf="flex-start">{KIND_LABELS[feature.kind]}</Tag>
          <Heading as="h2" size="lg">{feature.label}</Heading>
        </Stack>
        <CloseButton onClick={onClose} aria-label={`Close ${feature.label} details`} />
      </Flex>
      <Text mt={3} color="content.secondary">{feature.summary}</Text>
      <Stack as="dl" mt={4} spacing={2}>
        {feature.facts.map((f) => (
          <Flex key={f.label} justify="space-between" gap={4} fontSize="sm">
            <Text as="dt" color="content.muted">{f.label}</Text>
            <Text as="dd" textAlign="right" fontWeight={600}>{f.value}</Text>
          </Flex>
        ))}
      </Stack>
      {feature.why && (
        <Accordion allowToggle mt={3}>
          <AccordionItem border="none">
            <AccordionButton px={0}><Text flex={1} textAlign="left" fontSize="sm" fontWeight={600}>Why it looks like this</Text><AccordionIcon /></AccordionButton>
            <AccordionPanel px={0} pt={0}><Text fontSize="sm" color="content.secondary">{feature.why}</Text></AccordionPanel>
          </AccordionItem>
        </Accordion>
      )}
      <HStack mt={3} spacing={2} wrap="wrap">
        <Button size="sm" variant="outline" leftIcon={<FiCrosshair aria-hidden="true" />} onClick={onFlyHere}>Re-centre here</Button>
        {action && <Button size="sm" onClick={action.onClick}>{action.label}</Button>}
      </HStack>
    </GlassCard>
  );
}

export function TourCard({
  step, index, total, onPrev, onNext, onEnd,
}: { step: TourStep; index: number; total: number; onPrev: () => void; onNext: () => void; onEnd: () => void }) {
  return (
    <GlassCard strong as="section" aria-label="Guided tour" position="fixed" {...cardPosition} w={{ base: 'auto', md: '400px' }} zIndex={30} p={5}>
      <Flex justify="space-between" align="center" mb={2}>
        <Text fontSize="xs" letterSpacing="0.12em" textTransform="uppercase" color="accent.fg" fontWeight={700}>Guided tour · {index + 1} of {total}</Text>
        <Button size="xs" variant="ghost" onClick={onEnd}>End tour</Button>
      </Flex>
      <Heading as="h2" size="lg" mb={2}>{step.title}</Heading>
      <Text color="content.secondary">{step.body}</Text>
      <HStack mt={4} justify="space-between">
        <HStack spacing={1.5} aria-hidden="true">
          {Array.from({ length: total }).map((_, i) => (
            <Box key={i} boxSize="8px" borderRadius="full" bg={i === index ? 'accent.fg' : 'whiteAlpha.400'} />
          ))}
        </HStack>
        <HStack>
          <Button size="sm" variant="outline" leftIcon={<FiChevronLeft aria-hidden="true" />} onClick={onPrev} isDisabled={index === 0}>Back</Button>
          <Button size="sm" rightIcon={<FiChevronRight aria-hidden="true" />} onClick={index === total - 1 ? onEnd : onNext}>{index === total - 1 ? 'Finish' : 'Next'}</Button>
        </HStack>
      </HStack>
    </GlassCard>
  );
}
