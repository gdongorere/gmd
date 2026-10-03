// src/components/HomePageClient.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import {
  Box, Button, Flex, Heading, HStack, IconButton, Link, SimpleGrid, Stack, Tag, Text, Wrap, WrapItem,
} from '@chakra-ui/react';
import { FiArrowRight, FiChevronDown, FiDownload, FiGithub, FiLinkedin, FiMail, FiMapPin, FiPhone } from 'react-icons/fi';
import { experience, interests, profile, skillGroups } from '@/data/profile';
import { projectsData } from '@/data/projectsData';
import { techCounts } from '@/lib/projects';
import { ButtonLink, CopyButton, GlassCard, Reveal, Section } from '@/components/ui';
import { ProjectCard } from '@/components/ProjectCard';

function Hero() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Section view="face-on" minH="calc(100dvh - 72px)" display="flex" alignItems="center" py={{ base: 10, md: 16 }}>
      <Stack align="center" spacing={{ base: 6, md: 8 }} textAlign="center">
        <HStack
          spacing={2}
          px={4}
          py={1.5}
          bg="surface.glass"
          border="1px solid"
          borderColor="line.subtle"
          borderRadius="full"
          fontSize="sm"
          color="content.secondary"
          backdropFilter="blur(12px)"
        >
          <Box as="span" aria-hidden="true" boxSize="8px" borderRadius="full" bg="green.300" boxShadow="0 0 10px var(--chakra-colors-green-300)" />
          <Text as="span" color="inherit">{profile.availability}</Text>
          <Box as="span" aria-hidden="true">·</Box>
          <HStack as="span" spacing={1}><FiMapPin aria-hidden="true" /><span>{profile.location}</span></HStack>
        </HStack>

        <Heading as="h1" size="4xl" lineHeight={1}>
          {profile.firstName}
          <br />
          <Box as="span" color="accent.fg">{profile.lastName}</Box>
        </Heading>

        <Text fontSize={{ base: 'lg', md: 'xl' }} color="content.secondary" maxW="2xl">{profile.tagline}</Text>

        <HStack spacing={3} flexWrap="wrap" justify="center">
          <ButtonLink href="/projects" size="lg" rightIcon={<FiArrowRight aria-hidden="true" />}>View projects</ButtonLink>
          <ButtonLink href="/contact" size="lg" variant="outline">Contact me</ButtonLink>
          <ButtonLink href={profile.resume.url} size="lg" variant="ghost" leftIcon={<FiDownload aria-hidden="true" />}>Résumé</ButtonLink>
        </HStack>

        <HStack spacing={1}>
          <IconButton as="a" href={profile.github.url} target="_blank" rel="noopener noreferrer" aria-label="GitHub (opens in a new tab)" icon={<FiGithub size={22} />} variant="glass" boxSize="48px" />
          <IconButton as="a" href={profile.linkedin.url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn (opens in a new tab)" icon={<FiLinkedin size={22} />} variant="glass" boxSize="48px" />
          <IconButton as="a" href={`mailto:${profile.email}`} aria-label="Email" icon={<FiMail size={22} />} variant="glass" boxSize="48px" />
        </HStack>

        <Link as={NextLink} href="/stars" fontSize="sm" color="content.muted" _hover={{ color: 'accent.fg', textDecoration: 'none' }}>
          ✦ That’s a real-scale model of the Milky Way behind me — explore it
        </Link>
      </Stack>

      <IconButton
        aria-label="Scroll to featured projects"
        icon={<FiChevronDown size={28} />}
        variant="ghost"
        position="absolute"
        bottom={{ base: 4, md: 8 }}
        left="50%"
        ml="-24px"
        boxSize="48px"
        opacity={scrolled ? 0 : 1}
        pointerEvents={scrolled ? 'none' : 'auto'}
        tabIndex={scrolled ? -1 : 0}
        transition="opacity 200ms"
        onClick={() => document.getElementById('featured')?.scrollIntoView({ behavior: 'smooth' })}
      />
    </Section>
  );
}

function Proof() {
  const stats = useMemo(() => {
    const categories = new Set(projectsData.map((p) => p.category).filter(Boolean));
    return [
      { value: projectsData.length, label: 'projects built' },
      { value: techCounts().length, label: 'technologies used' },
      { value: categories.size, label: 'domains, from e-commerce to industrial' },
    ];
  }, []);
  return (
    <Section scrim={false} py={{ base: 6, md: 10 }} aria-label="At a glance">
      <SimpleGrid columns={{ base: 1, sm: 3 }} spacing={4}>
        {stats.map((s, i) => (
          <Reveal key={s.label} delay={i * 0.06}>
            <GlassCard p={6} textAlign="center" h="100%">
              <Text fontFamily="heading" fontWeight={700} fontSize="4xl" lineHeight={1} color="accent.fg">{s.value}</Text>
              <Text mt={2} color="content.secondary">{s.label}</Text>
            </GlassCard>
          </Reveal>
        ))}
      </SimpleGrid>
    </Section>
  );
}

function Featured() {
  const featured = projectsData.filter((p) => p.featured).slice(0, 3);
  return (
    <Section id="featured" view="arm-flyby" eyebrow="Featured work" title="Things I’ve built" subtitle="Real products for real users. Open any one for the full story.">
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={{ base: 5, md: 6 }} as="ul" listStyleType="none">
        {featured.map((project, i) => (
          <Box as="li" key={project.id}><Reveal delay={i * 0.08}><ProjectCard project={project} /></Reveal></Box>
        ))}
      </SimpleGrid>
      <Flex justify="center" mt={10}>
        <ButtonLink href="/projects" size="lg" variant="outline" rightIcon={<FiArrowRight aria-hidden="true" />}>See all {projectsData.length} projects</ButtonLink>
      </Flex>
    </Section>
  );
}

function About() {
  return (
    <Section id="about" view="tilted" eyebrow="About" title="Software that works in the real world" align="start">
      <SimpleGrid columns={{ base: 1, lg: 5 }} spacing={{ base: 6, lg: 10 }}>
        <Box gridColumn={{ lg: 'span 3' }}>
          <Reveal>
            <GlassCard strong p={{ base: 6, md: 8 }}>
              <Stack spacing={4} fontSize={{ base: 'md', md: 'lg' }} color="content.secondary" lineHeight={1.75}>
                <Text color="content.secondary">
                  I’m a full-stack developer based in Eswatini. I started in industrial systems — programming Siemens PLCs, building SCADA dashboards and
                  3D-printing solutions for hospital IT at The Luke Commission — and now build web products at Synapse Digital.
                </Text>
                <Text color="content.secondary">
                  That mix shapes how I work: I care about software that keeps running on patchy connections and in busy workplaces, and I like making it fast and pleasant to use.
                </Text>
              </Stack>
            </GlassCard>
          </Reveal>
        </Box>
        <Box gridColumn={{ lg: 'span 2' }}>
          <Reveal delay={0.08}>
            <GlassCard p={{ base: 6, md: 8 }} h="100%">
              <Heading as="h3" size="md" mb={4}>Currently interested in</Heading>
              <Wrap spacing={2}>
                {interests.map((interest) => (<WrapItem key={interest}><Tag size="lg">{interest}</Tag></WrapItem>))}
              </Wrap>
            </GlassCard>
          </Reveal>
        </Box>
      </SimpleGrid>
    </Section>
  );
}

function Skills() {
  const known = useMemo(() => new Set(techCounts().map((t) => t.tech)), []);
  return (
    <Section id="skills" view="core" eyebrow="Skills" title="Tools of the trade" subtitle="Technologies that appear in my projects link straight to the work that used them.">
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={5}>
        {skillGroups.map((group, i) => (
          <Reveal key={group.category} delay={(i % 3) * 0.06}>
            <GlassCard p={6} h="100%">
              <Heading as="h3" size="md" color="accent.fg" mb={4}>{group.category}</Heading>
              <Wrap spacing={2}>
                {group.items.map((item) => (
                  <WrapItem key={item}>
                    {known.has(item) ? (
                      <Tag as={NextLink} href={`/projects?tech=${encodeURIComponent(item)}`} cursor="pointer" _hover={{ borderColor: 'accent.fg', color: 'accent.fg' }} aria-label={`${item} — see projects using it`}>{item}</Tag>
                    ) : (
                      <Tag>{item}</Tag>
                    )}
                  </WrapItem>
                ))}
              </Wrap>
            </GlassCard>
          </Reveal>
        ))}
      </SimpleGrid>
    </Section>
  );
}

function Experience() {
  return (
    <Section id="experience" view="edge-on" eyebrow="Experience" title="Where I’ve worked">
      <Box position="relative" maxW="4xl" mx="auto" pl={{ base: 6, md: 10 }}>
        <Box aria-hidden="true" position="absolute" left={{ base: '7px', md: '15px' }} top={2} bottom={2} w="2px" bg="line.strong" />
        <Stack as="ol" listStyleType="none" spacing={8}>
          {experience.map((job, i) => (
            <Box as="li" key={job.company} position="relative">
              <Box aria-hidden="true" position="absolute" left={{ base: '-24px', md: '-40px' }} top="28px" boxSize="16px" borderRadius="full" bg="accent.solid" border="3px solid" borderColor="surface.canvas" boxShadow="0 0 0 2px var(--chakra-colors-accent-fg)" />
              <Reveal delay={i * 0.06}>
                <GlassCard strong p={{ base: 6, md: 8 }}>
                  <Flex justify="space-between" direction={{ base: 'column', md: 'row' }} gap={1} mb={1}>
                    <Heading as="h3" size="lg">{job.position}</Heading>
                    <Text color="accent.fg" fontWeight={600}>{job.period}</Text>
                  </Flex>
                  <Text color="content.secondary" fontSize="lg" mb={4}>{job.company}</Text>
                  <Stack as="ul" spacing={2} listStyleType="none" mb={5}>
                    {job.achievements.map((a) => (
                      <HStack as="li" key={a} align="flex-start" spacing={3}>
                        <Box as="span" aria-hidden="true" color="accent.fg" mt="2px">▸</Box>
                        <Text color="content.secondary">{a}</Text>
                      </HStack>
                    ))}
                  </Stack>
                  <Wrap spacing={2}>
                    {job.tech.map((t) => (<WrapItem key={t}><Tag size="sm">{t}</Tag></WrapItem>))}
                  </Wrap>
                </GlassCard>
              </Reveal>
            </Box>
          ))}
        </Stack>
      </Box>
    </Section>
  );
}

function ContactBand() {
  return (
    <Section id="contact" view="home" py={{ base: 14, md: 24 }}>
      <Reveal>
        <GlassCard
          strong
          p={{ base: 8, md: 14 }}
          textAlign="center"
          bgImage="radial-gradient(120% 140% at 50% 0%, rgba(255,63,0,0.22), transparent 60%)"
        >
          <Stack align="center" spacing={6}>
            <Heading as="h2" size="2xl">Let’s build something good</Heading>
            <Text color="content.secondary" fontSize={{ base: 'md', md: 'lg' }} maxW="xl">
              Have a project, a problem to untangle, or a role to fill? I reply within two business days.
            </Text>
            <HStack spacing={1} bg="surface.inset" borderRadius="xl" pl={4} pr={1} maxW="100%">
              <Link href={`mailto:${profile.email}`} color="content.primary" fontWeight={600} wordBreak="break-all" py={2}>{profile.email}</Link>
              <CopyButton value={profile.email} label="email address" />
            </HStack>
            <HStack spacing={3} flexWrap="wrap" justify="center">
              <ButtonLink href="/contact" size="lg" rightIcon={<FiArrowRight aria-hidden="true" />}>Send a message</ButtonLink>
              <ButtonLink href={profile.resume.url} size="lg" variant="outline" leftIcon={<FiDownload aria-hidden="true" />}>Download résumé (PDF)</ButtonLink>
            </HStack>
            <Button as="a" href={profile.phoneHref} variant="ghost" leftIcon={<FiPhone aria-hidden="true" />}>{profile.phone}</Button>
          </Stack>
        </GlassCard>
      </Reveal>
    </Section>
  );
}

export default function HomePageClient() {
  return (
    <>
      <Hero />
      <Proof />
      <Featured />
      <About />
      <Skills />
      <Experience />
      <ContactBand />
    </>
  );
}
