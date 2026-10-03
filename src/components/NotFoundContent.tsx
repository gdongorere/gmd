// src/components/NotFoundContent.tsx
'use client';

import { Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { FiHome } from 'react-icons/fi';
import { ButtonLink, GlassCard, Section } from '@/components/ui';

export default function NotFoundContent() {
  return (
    <Section view="halo" scrim minH="calc(100dvh - 72px)" display="flex" alignItems="center">
      <Stack align="center" spacing={6} textAlign="center">
        <Text color="accent.fg" fontWeight={700} letterSpacing="0.14em" textTransform="uppercase" fontSize="sm">
          Error 404
        </Text>
        <Heading as="h1" size="4xl">Lost in space</Heading>
        <GlassCard px={6} py={5} maxW="lg">
          <Text color="content.secondary" fontSize="lg">
            That page drifted out past the halo and I can’t find it. Let’s get you back to somewhere with stars you recognise.
          </Text>
        </GlassCard>
        <HStack spacing={3} flexWrap="wrap" justify="center">
          <ButtonLink href="/" size="lg" leftIcon={<FiHome aria-hidden="true" />}>Take me home</ButtonLink>
          <ButtonLink href="/projects" size="lg" variant="outline">Browse projects</ButtonLink>
          <ButtonLink href="/stars" size="lg" variant="ghost">Explore the galaxy</ButtonLink>
        </HStack>
      </Stack>
    </Section>
  );
}
