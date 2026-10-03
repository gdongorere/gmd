// src/components/ProjectCaseStudy.tsx
'use client';

import React, { useState } from 'react';
import NextLink from 'next/link';
import Image from 'next/image';
import {
  Box, Breadcrumb, BreadcrumbItem, BreadcrumbLink, Button, Flex, Grid, GridItem, Heading, HStack, IconButton, ListItem, Modal,
  ModalBody, ModalCloseButton, ModalContent, ModalOverlay, SimpleGrid, Stack, Tag, Text, UnorderedList, VisuallyHidden, Wrap, WrapItem,
} from '@chakra-ui/react';
import { FiArrowLeft, FiArrowRight, FiChevronLeft, FiChevronRight, FiExternalLink, FiGithub, FiMaximize2 } from 'react-icons/fi';
import type { Project } from '@/data/projectsData';
import { projectMedia } from '@/data/projectMedia';
import { CATEGORY_LABELS, parseLongDescription } from '@/lib/projects';
import { ButtonLink, CopyButton, GlassCard, Section } from '@/components/ui';
import { ProjectMedia } from '@/components/ProjectMedia';

const humanise = (key: string) => key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

function Gallery({ project }: { project: Project }) {
  const media = projectMedia[project.id];
  const shots = [
    media?.desktop && { ...media.desktop, label: `${project.name} — desktop view` },
    media?.mobile && { ...media.mobile, label: `${project.name} — mobile view` },
  ].filter(Boolean) as { src: string; width: number; height: number; label: string }[];
  const [open, setOpen] = useState<number | null>(null);
  if (!shots.length) return null;

  const step = (delta: number) => setOpen((i) => (i === null ? i : (i + delta + shots.length) % shots.length));
  const current = open === null ? null : shots[open];

  return (
    <Section id="gallery" eyebrow="Screens" title="Gallery" view="tilted" py={{ base: 10, md: 16 }}>
      <SimpleGrid columns={{ base: 1, sm: shots.length > 1 ? 2 : 1 }} spacing={5}>
        {shots.map((shot, i) => (
          <GlassCard key={shot.src} interactive p={3} as="button" type="button" textAlign="left" onClick={() => setOpen(i)} aria-label={`Enlarge: ${shot.label}`} position="relative">
            <Box position="relative" borderRadius="xl" overflow="hidden" bg="blackAlpha.600" sx={{ aspectRatio: `${shot.width} / ${shot.height}` }} maxH="420px" mx="auto">
              <Image src={shot.src} alt={shot.label} fill sizes="(min-width: 48em) 50vw, 100vw" style={{ objectFit: 'contain' }} />
            </Box>
            <HStack mt={3} color="content.secondary" fontSize="sm" justify="space-between">
              <Text>{shot.label}</Text>
              <Box as={FiMaximize2} aria-hidden="true" />
            </HStack>
          </GlassCard>
        ))}
      </SimpleGrid>

      <Modal isOpen={open !== null} onClose={() => setOpen(null)} size="6xl" isCentered>
        <ModalOverlay />
        <ModalContent
          mx={3}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') step(1);
            if (e.key === 'ArrowLeft') step(-1);
          }}
        >
          <ModalCloseButton size="lg" zIndex={2} />
          <ModalBody p={{ base: 3, md: 6 }}>
            {current && (
              <Stack spacing={4} align="center">
                <Image src={current.src} alt={current.label} width={current.width} height={current.height} sizes="100vw" style={{ width: 'auto', maxWidth: '100%', maxHeight: '78vh', height: 'auto', objectFit: 'contain' }} />
                <HStack spacing={4}>
                  {shots.length > 1 && <IconButton aria-label="Previous image" icon={<FiChevronLeft />} variant="outline" onClick={() => step(-1)} />}
                  <Text color="content.secondary" aria-live="polite">{current.label} ({(open ?? 0) + 1} of {shots.length})</Text>
                  {shots.length > 1 && <IconButton aria-label="Next image" icon={<FiChevronRight />} variant="outline" onClick={() => step(1)} />}
                </HStack>
              </Stack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Section>
  );
}

export function ProjectCaseStudy({ project, prev, next }: { project: Project; prev?: Project; next?: Project }) {
  const blocks = parseLongDescription(project.longDescription);
  const [primary, ...otherLinks] = project.links ?? [];
  const creds = project.credentials;
  const hasCreds = !!creds && (creds.username || creds.password || creds.note);

  return (
    <>
      {/* Hero */}
      <Section view="arm-flyby" pb={{ base: 6, md: 10 }} pt={{ base: 8, md: 16 }}>
        <Breadcrumb mb={6} fontSize="sm" color="content.muted" separator="/" aria-label="Breadcrumb">
          <BreadcrumbItem><BreadcrumbLink as={NextLink} href="/projects" color="content.secondary">Projects</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbItem isCurrentPage><BreadcrumbLink aria-current="page" color="content.primary">{project.name}</BreadcrumbLink></BreadcrumbItem>
        </Breadcrumb>

        <Grid templateColumns={{ base: '1fr', lg: '1.05fr 1fr' }} gap={{ base: 8, lg: 12 }} alignItems="center">
          <Stack spacing={6}>
            <HStack spacing={2} flexWrap="wrap">
              {project.category && <Tag variant="accent">{CATEGORY_LABELS[project.category]}</Tag>}
              {project.featured && <Tag>Featured</Tag>}
              {project.year && <Tag>{project.year}</Tag>}
            </HStack>
            <Heading as="h1" size="3xl">{project.name}</Heading>
            {project.shortDescription && <Text fontSize={{ base: 'lg', md: 'xl' }} color="content.secondary">{project.shortDescription}</Text>}
            {project.role && (
              <Text><Text as="span" color="content.muted">My role · </Text>{project.role}</Text>
            )}
            <HStack spacing={3} flexWrap="wrap">
              {primary && (
                <ButtonLink href={primary.url} size="lg" rightIcon={<FiExternalLink aria-hidden="true" />}>{primary.label}</ButtonLink>
              )}
              {project.repo && (
                <ButtonLink href={project.repo} size="lg" variant="outline" leftIcon={<FiGithub aria-hidden="true" />}>View code</ButtonLink>
              )}
            </HStack>
          </Stack>
          <GlassCard overflow="hidden" p={0}>
            <ProjectMedia id={project.id} name={project.name} alt={project.screenshotAlt} priority sizes="(min-width: 62em) 50vw, 100vw" />
          </GlassCard>
        </Grid>
      </Section>

      {/* Details */}
      <Section view="tilted" id="details" py={{ base: 8, md: 14 }}>
        <Grid templateColumns={{ base: '1fr', lg: '2fr 1fr' }} gap={{ base: 8, lg: 10 }} alignItems="start">
          <GridItem>
            <GlassCard strong p={{ base: 6, md: 8 }}>
              <Heading as="h2" size="xl" mb={5}>About this project</Heading>
              <Stack spacing={4} color="content.secondary" fontSize={{ base: 'md', md: 'lg' }} lineHeight={1.7}>
                {blocks.map((block, i) => {
                  if (block.type === 'h') return <Heading key={i} as="h3" size="md" color="content.primary" pt={2}>{block.text}</Heading>;
                  if (block.type === 'ul')
                    return (
                      <UnorderedList key={i} spacing={2} ml={5} sx={{ '::marker': { color: 'var(--chakra-colors-accent-fg)' } }}>
                        {block.items.map((item, j) => {
                          const [lead, ...rest] = item.split(/:\s(.+)/);
                          return (
                            <ListItem key={j}>
                              {rest.length ? (<><Text as="span" color="content.primary" fontWeight={600}>{lead}: </Text>{rest[0]}</>) : item}
                            </ListItem>
                          );
                        })}
                      </UnorderedList>
                    );
                  return <Text key={i}>{block.text}</Text>;
                })}
              </Stack>
            </GlassCard>
          </GridItem>

          <GridItem>
            <Stack spacing={5} position={{ lg: 'sticky' }} top={{ lg: '96px' }}>
              {project.tech && project.tech.length > 0 && (
                <GlassCard p={6}>
                  <Heading as="h2" size="md" mb={4}>Tech stack</Heading>
                  <Wrap spacing={2}>
                    {project.tech.map((t) => (<WrapItem key={t}><Tag>{t}</Tag></WrapItem>))}
                  </Wrap>
                </GlassCard>
              )}

              {project.metrics && (
                <GlassCard p={6}>
                  <Heading as="h2" size="md" mb={4}>At a glance</Heading>
                  <Stack as="dl" spacing={3}>
                    {Object.entries(project.metrics).map(([key, value]) => (
                      <Box key={key}>
                        <Text as="dt" fontSize="xs" letterSpacing="0.1em" textTransform="uppercase" color="content.muted">{humanise(key)}</Text>
                        <Text as="dd" fontWeight={600}>{value}</Text>
                      </Box>
                    ))}
                  </Stack>
                </GlassCard>
              )}

              {(otherLinks.length > 0 || hasCreds) && (
                <GlassCard p={6}>
                  <Heading as="h2" size="md" mb={4}>{hasCreds ? 'Try it out' : 'Links'}</Heading>
                  <Stack spacing={3}>
                    {otherLinks.map((link) => (
                      <ButtonLink key={link.url} href={link.url} variant="outline" size="sm" rightIcon={<FiExternalLink aria-hidden="true" />} justifyContent="space-between">{link.label}</ButtonLink>
                    ))}
                    {creds?.note && <Text color="content.secondary" fontSize="sm">{creds.note}</Text>}
                    {creds?.username && (
                      <Flex align="center" justify="space-between" bg="surface.inset" borderRadius="lg" pl={3}>
                        <Box minW={0}><Text fontSize="xs" color="content.muted">Demo username</Text><Text fontFamily="mono" fontSize="sm" noOfLines={1}>{creds.username}</Text></Box>
                        <CopyButton value={creds.username} label="username" />
                      </Flex>
                    )}
                    {creds?.password && (
                      <Flex align="center" justify="space-between" bg="surface.inset" borderRadius="lg" pl={3}>
                        <Box minW={0}><Text fontSize="xs" color="content.muted">Demo password</Text><Text fontFamily="mono" fontSize="sm" noOfLines={1}>{creds.password}</Text></Box>
                        <CopyButton value={creds.password} label="password" />
                      </Flex>
                    )}
                  </Stack>
                </GlassCard>
              )}
            </Stack>
          </GridItem>
        </Grid>
      </Section>

      <Gallery project={project} />

      {/* More projects */}
      <Section view="face-on" eyebrow="Keep exploring" title="More projects" py={{ base: 10, md: 16 }}>
        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={5}>
          {[{ p: prev, dir: 'Previous' as const }, { p: next, dir: 'Next' as const }].map(({ p, dir }) =>
            p ? (
              <GlassCard key={dir} interactive as={NextLink} href={`/projects/${p.id}`} p={6} display="block" _hover={{ textDecoration: 'none', borderColor: 'line.strong', transform: 'translateY(-3px)' }}>
                <HStack justify={dir === 'Next' ? 'flex-end' : 'flex-start'} color="accent.fg" fontSize="sm" fontWeight={600} spacing={2}>
                  {dir === 'Previous' && <FiArrowLeft aria-hidden="true" />}
                  <span>{dir} project</span>
                  {dir === 'Next' && <FiArrowRight aria-hidden="true" />}
                </HStack>
                <Heading as="p" size="lg" mt={2} textAlign={dir === 'Next' ? 'right' : 'left'}>{p.name}</Heading>
              </GlassCard>
            ) : null,
          )}
        </SimpleGrid>
        <Flex justify="center" mt={8}>
          <Button as={NextLink} href="/projects" variant="outline">Back to all projects</Button>
        </Flex>
        <VisuallyHidden>End of case study</VisuallyHidden>
      </Section>
    </>
  );
}
