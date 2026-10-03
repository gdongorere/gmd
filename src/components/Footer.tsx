// src/components/Footer.tsx
'use client';

import React from 'react';
import NextLink from 'next/link';
import { Box, Button, Container, Divider, Flex, Heading, HStack, IconButton, Link, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { FiArrowUp, FiGithub, FiLinkedin, FiMail } from 'react-icons/fi';
import { navItems, profile } from '@/data/profile';

export interface FooterProject {
  id: string;
  name: string;
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Stack spacing={3} as="nav" aria-label={title}>
      <Heading as="h2" fontSize="sm" letterSpacing="0.12em" textTransform="uppercase" color="content.muted" fontFamily="body">
        {title}
      </Heading>
      {children}
    </Stack>
  );
}

const linkProps = { color: 'content.secondary', _hover: { color: 'white', textDecoration: 'none' } } as const;

export function Footer({ projects = [] }: { projects?: FooterProject[] }) {
  return (
    <Box as="footer" position="relative" zIndex={10} bg="surface.glassStrong" borderTop="1px solid" borderColor="line.subtle" sx={{ backdropFilter: 'blur(14px) saturate(160%)' }}>
      <Container maxW="container.xl" px={{ base: 5, md: 8 }} py={{ base: 12, md: 16 }}>
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={{ base: 10, lg: 12 }}>
          <Stack spacing={4}>
            <Heading as="p" fontSize="2xl" fontFamily="heading">
              {profile.firstName} <Box as="span" color="accent.fg">{profile.lastName}</Box>
            </Heading>
            <Text color="content.secondary" maxW="xs">{profile.tagline}</Text>
            <HStack spacing={1} ml={-2}>
              <IconButton as="a" href={profile.github.url} target="_blank" rel="noopener noreferrer" aria-label="GitHub (opens in a new tab)" icon={<FiGithub size={20} />} variant="ghost" boxSize="44px" />
              <IconButton as="a" href={profile.linkedin.url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn (opens in a new tab)" icon={<FiLinkedin size={20} />} variant="ghost" boxSize="44px" />
              <IconButton as="a" href={`mailto:${profile.email}`} aria-label="Email" icon={<FiMail size={20} />} variant="ghost" boxSize="44px" />
            </HStack>
          </Stack>

          <FooterColumn title="Pages">
            {navItems.map((item) => (
              <Link key={item.href} as={NextLink} href={item.href} {...linkProps}>{item.label}</Link>
            ))}
            <Link as={NextLink} href="/stars" {...linkProps}>Explore the Milky Way</Link>
          </FooterColumn>

          <FooterColumn title="Work">
            {projects.map((project) => (
              <Link key={project.id} as={NextLink} href={`/projects/${project.id}`} {...linkProps}>{project.name}</Link>
            ))}
            <Link as={NextLink} href="/projects" color="accent.fg" _hover={{ color: 'white', textDecoration: 'none' }}>All projects →</Link>
          </FooterColumn>

          <FooterColumn title="Connect">
            <Link href={`mailto:${profile.email}`} {...linkProps} wordBreak="break-all">{profile.email}</Link>
            <Link href={profile.phoneHref} {...linkProps}>{profile.phone}</Link>
            <Link href={profile.resume.url} download {...linkProps}>{profile.resume.label}</Link>
          </FooterColumn>
        </SimpleGrid>

        <Divider my={{ base: 8, md: 10 }} />

        <Flex direction={{ base: 'column', md: 'row' }} justify="space-between" align={{ base: 'flex-start', md: 'center' }} gap={4}>
          <Stack spacing={1}>
            <Text color="content.muted" fontSize="sm">© {new Date().getFullYear()} {profile.name}. All rights reserved.</Text>
            <Text color="content.muted" fontSize="sm">
              Built with Next.js and a real-scale Milky Way —{' '}
              <Link as={NextLink} href="/stars" color="accent.fg" textDecoration="underline" textUnderlineOffset="3px">explore it</Link>.
            </Text>
          </Stack>
          <Button variant="outline" size="sm" leftIcon={<FiArrowUp aria-hidden="true" />} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            Back to top
          </Button>
        </Flex>
      </Container>
    </Box>
  );
}
