// src/components/ui/Section.tsx
'use client';

import React from 'react';
import { Box, BoxProps, Container, Heading, Text, VStack } from '@chakra-ui/react';
import type { GalaxyViewName } from '@/lib/galaxy/camera';
import { useGalaxyWaypoint } from '@/components/galaxy/useGalaxyWaypoint';

export interface SectionProps extends Omit<BoxProps, 'title'> {
  id?: string;
  /** Small uppercase label above the title. */
  eyebrow?: string;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** The galaxy camera view to settle on while this section is in view. */
  view?: GalaxyViewName;
  align?: 'center' | 'start';
  /** Soft dark halo behind the content so text stays readable over bright parts of the galaxy. */
  scrim?: boolean;
  /** Use h1 for the page's single main heading. */
  headingLevel?: 'h1' | 'h2';
  containerMaxW?: string;
}

export function Section({
  id, eyebrow, title, subtitle, view, align = 'center', scrim = true, headingLevel = 'h2',
  containerMaxW = 'container.xl', children, ...rest
}: SectionProps) {
  const ref = useGalaxyWaypoint<HTMLElement>(view);
  const headingId = id ? `${id}-title` : undefined;

  return (
    <Box
      as="section"
      ref={ref as React.Ref<HTMLDivElement>}
      id={id}
      aria-labelledby={title ? headingId : undefined}
      position="relative"
      isolation="isolate"
      py={{ base: 14, md: 24 }}
      _before={
        scrim
          ? {
              content: '""',
              position: 'absolute',
              inset: { base: '0', md: '0 -4%' },
              zIndex: -1,
              pointerEvents: 'none',
              bg: 'radial-gradient(ellipse 85% 75% at 50% 42%, rgba(10,10,10,0.8), rgba(10,10,10,0.55) 55%, rgba(10,10,10,0) 100%)',
            }
          : undefined
      }
      {...rest}
    >
      <Container maxW={containerMaxW} px={{ base: 5, md: 8 }}>
        {(eyebrow || title || subtitle) && (
          <VStack
            spacing={3}
            mb={{ base: 8, md: 12 }}
            textAlign={align === 'center' ? 'center' : 'left'}
            align={align === 'center' ? 'center' : 'flex-start'}
          >
            {eyebrow && (
              <Text color="accent.fg" fontWeight={700} fontSize="sm" letterSpacing="0.14em" textTransform="uppercase">
                {eyebrow}
              </Text>
            )}
            {title && (
              <Heading as={headingLevel} id={headingId} size={headingLevel === 'h1' ? '3xl' : '2xl'}>
                {title}
              </Heading>
            )}
            {subtitle && (
              <Text color="content.secondary" fontSize={{ base: 'md', md: 'lg' }} maxW="2xl">
                {subtitle}
              </Text>
            )}
          </VStack>
        )}
        {children}
      </Container>
    </Box>
  );
}
