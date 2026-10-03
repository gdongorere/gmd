// src/app/error.tsx
'use client';

import { useEffect } from 'react';
import { Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { FiRefreshCw } from 'react-icons/fi';
import { ButtonLink, Section } from '@/components/ui';
import { Button } from '@chakra-ui/react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Section view="core" minH="calc(100dvh - 72px)" display="flex" alignItems="center">
      <Stack align="center" spacing={6} textAlign="center" role="alert">
        <Heading as="h1" size="3xl">Something went wrong</Heading>
        <Text color="content.secondary" fontSize="lg" maxW="lg">
          An unexpected error got in the way. You can try again, or head back home.
        </Text>
        {error.digest && <Text color="content.muted" fontSize="sm">Reference: {error.digest}</Text>}
        <HStack spacing={3}>
          <Button size="lg" leftIcon={<FiRefreshCw aria-hidden="true" />} onClick={reset}>Try again</Button>
          <ButtonLink href="/" size="lg" variant="outline">Go home</ButtonLink>
        </HStack>
      </Stack>
    </Section>
  );
}
