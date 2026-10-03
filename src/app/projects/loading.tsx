// src/app/projects/loading.tsx
import { Container, SimpleGrid, Skeleton, Stack } from '@chakra-ui/react';

export default function Loading() {
  return (
    <Container maxW="container.xl" px={{ base: 5, md: 8 }} py={{ base: 14, md: 24 }} aria-busy="true" aria-label="Loading projects">
      <Stack spacing={4} align="center" mb={12}>
        <Skeleton h="56px" w="min(420px, 80%)" borderRadius="xl" startColor="whiteAlpha.100" endColor="whiteAlpha.300" />
        <Skeleton h="20px" w="min(560px, 90%)" borderRadius="md" startColor="whiteAlpha.100" endColor="whiteAlpha.300" />
      </Stack>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} h="380px" borderRadius="2xl" startColor="whiteAlpha.100" endColor="whiteAlpha.300" />
        ))}
      </SimpleGrid>
    </Container>
  );
}
