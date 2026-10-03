// src/components/ProjectCard.tsx
'use client';

import React from 'react';
import NextLink from 'next/link';
import { Box, Flex, Heading, HStack, LinkOverlay, Tag, Text } from '@chakra-ui/react';
import { FiArrowRight } from 'react-icons/fi';
import type { Project } from '@/data/projectsData';
import { CATEGORY_LABELS } from '@/lib/projects';
import { GlassCard } from '@/components/ui';
import { ProjectMedia } from '@/components/ProjectMedia';

export function ProjectCard({ project, priority }: { project: Project; priority?: boolean }) {
  const { id, name, shortDescription, tech = [], year, category, screenshotAlt, featured } = project;
  return (
    <GlassCard as="article" interactive position="relative" overflow="hidden" h="100%" display="flex" flexDirection="column">
      <ProjectMedia id={id} name={name} alt={screenshotAlt} priority={priority} />
      <Flex direction="column" flex={1} p={{ base: 5, md: 6 }} gap={3}>
        <HStack spacing={2} flexWrap="wrap">
          {category && <Tag variant="accent" size="sm">{CATEGORY_LABELS[category]}</Tag>}
          {featured && <Tag size="sm">Featured</Tag>}
          {year && <Text as="span" color="content.muted" fontSize="sm" ml="auto">{year}</Text>}
        </HStack>
        <Heading as="h3" size="md">
          <LinkOverlay as={NextLink} href={`/projects/${id}`} _hover={{ textDecoration: 'none' }}>
            {name}
          </LinkOverlay>
        </Heading>
        {shortDescription && <Text color="content.secondary" noOfLines={3}>{shortDescription}</Text>}
        <HStack spacing={1.5} flexWrap="wrap" mt="auto" pt={2}>
          {tech.slice(0, 3).map((t) => (<Tag key={t} size="sm">{t}</Tag>))}
          {tech.length > 3 && <Tag size="sm" variant="subtle" aria-label={`and ${tech.length - 3} more technologies`}>+{tech.length - 3}</Tag>}
        </HStack>
        <HStack color="accent.fg" fontWeight={600} fontSize="sm" spacing={1}>
          <Text as="span">Read the case study</Text>
          <Box as={FiArrowRight} aria-hidden="true" />
        </HStack>
      </Flex>
    </GlassCard>
  );
}
