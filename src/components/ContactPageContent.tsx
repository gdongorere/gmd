'use client';

// src/components/ContactPageContent.tsx
import { Box, Grid, GridItem, Heading, HStack, Stack, Text } from '@chakra-ui/react';
import { FiGithub, FiLinkedin, FiMail, FiMapPin, FiPhone } from 'react-icons/fi';
import ContactForm from '@/components/ContactForm';
import { CopyButton, ExternalLink, GlassCard, Section } from '@/components/ui';
import { profile } from '@/data/profile';

export default function ContactPageContent() {
  return (
    <Section
      view="home"
      headingLevel="h1"
      eyebrow="Contact"
      title="Let’s talk"
      subtitle="Tell me about your project, role or question. I reply within two business days."
    >
      <Grid templateColumns={{ base: '1fr', lg: '1.6fr 1fr' }} gap={{ base: 6, lg: 10 }} alignItems="start">
        <GridItem><ContactForm /></GridItem>
        <GridItem>
          <GlassCard p={{ base: 6, md: 8 }}>
            <Heading as="h2" size="lg" mb={5}>Prefer another way?</Heading>
            <Stack spacing={5}>
              <HStack align="flex-start" spacing={3}>
                <Box as={FiMail} mt={1} color="accent.fg" aria-hidden="true" />
                <Box flex={1} minW={0}>
                  <Text fontSize="sm" color="content.muted">Email</Text>
                  <HStack spacing={1}>
                    <ExternalLink href={`mailto:${profile.email}`} showIcon={false} wordBreak="break-all">{profile.email}</ExternalLink>
                    <CopyButton value={profile.email} label="email address" />
                  </HStack>
                </Box>
              </HStack>
              <HStack align="flex-start" spacing={3}>
                <Box as={FiPhone} mt={1} color="accent.fg" aria-hidden="true" />
                <Box><Text fontSize="sm" color="content.muted">Phone</Text><ExternalLink href={profile.phoneHref} showIcon={false}>{profile.phone}</ExternalLink></Box>
              </HStack>
              <HStack align="flex-start" spacing={3}>
                <Box as={FiLinkedin} mt={1} color="accent.fg" aria-hidden="true" />
                <Box><Text fontSize="sm" color="content.muted">LinkedIn</Text><ExternalLink href={profile.linkedin.url}>{profile.linkedin.label}</ExternalLink></Box>
              </HStack>
              <HStack align="flex-start" spacing={3}>
                <Box as={FiGithub} mt={1} color="accent.fg" aria-hidden="true" />
                <Box><Text fontSize="sm" color="content.muted">GitHub</Text><ExternalLink href={profile.github.url}>{profile.github.label}</ExternalLink></Box>
              </HStack>
              <HStack align="flex-start" spacing={3}>
                <Box as={FiMapPin} mt={1} color="accent.fg" aria-hidden="true" />
                <Box><Text fontSize="sm" color="content.muted">Based in</Text><Text>{profile.location}</Text></Box>
              </HStack>
            </Stack>
          </GlassCard>
        </GridItem>
      </Grid>
    </Section>
  );
}
