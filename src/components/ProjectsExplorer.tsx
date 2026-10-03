// src/components/ProjectsExplorer.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Box, Button, Flex, FormControl, FormLabel, HStack, Input, InputGroup, InputLeftElement, Select, SimpleGrid, Stack, Text, Wrap, WrapItem,
} from '@chakra-ui/react';
import { FiSearch, FiX } from 'react-icons/fi';
import type { Project } from '@/data/projectsData';
import {
  CATEGORY_LABELS, SORT_LABELS, filterProjects, filtersFromParams, paramsFromFilters, techCounts, type ProjectFilters, type SortKey,
} from '@/lib/projects';
import { GlassCard } from '@/components/ui';
import { ProjectCard } from '@/components/ProjectCard';

const MotionLi = motion.li;

export function ProjectsExplorer({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(search.toString())), [search]);
  const [query, setQuery] = useState(filters.q ?? '');

  const update = useCallback(
    (next: Partial<ProjectFilters>) => {
      const qs = paramsFromFilters({ ...filters, ...next }).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters, pathname, router],
  );

  // Debounce typing into the URL, and follow the URL when it changes (back/forward).
  useEffect(() => {
    if ((filters.q ?? '') === query) return;
    const id = window.setTimeout(() => update({ q: query }), 250);
    return () => window.clearTimeout(id);
  }, [query, filters.q, update]);
  useEffect(() => {
    setQuery((current) => ((filters.q ?? '') !== current.trim() ? filters.q ?? '' : current));
  }, [filters.q]);

  const results = useMemo(() => filterProjects(projects, filters), [projects, filters]);
  const allTech = useMemo(() => techCounts(projects), [projects]);
  const selected = useMemo(() => filters.tech ?? [], [filters.tech]);
  const chips = useMemo(() => {
    const top = allTech.slice(0, 14).map((t) => t.tech);
    return [...top, ...selected.filter((t) => !top.includes(t))];
  }, [allTech, selected]);
  const categories = useMemo(
    () => [...new Set(projects.map((p) => p.category).filter(Boolean))] as NonNullable<Project['category']>[],
    [projects],
  );
  const hasFilters = !!(filters.q?.trim() || selected.length || filters.category || filters.sort !== 'featured');

  const toggleTech = (tech: string) =>
    update({ tech: selected.includes(tech) ? selected.filter((t) => t !== tech) : [...selected, tech] });
  const clear = () => {
    setQuery('');
    router.replace(pathname, { scroll: false });
  };

  return (
    <Stack spacing={8}>
      <GlassCard p={{ base: 4, md: 6 }} as="form" role="search" aria-label="Filter projects" onSubmit={(e: React.FormEvent) => e.preventDefault()}>
        <Stack spacing={5}>
          <Flex gap={4} direction={{ base: 'column', md: 'row' }}>
            <FormControl flex={2}>
              <FormLabel htmlFor="project-search">Search</FormLabel>
              <InputGroup>
                <InputLeftElement pointerEvents="none" color="content.muted"><FiSearch aria-hidden="true" /></InputLeftElement>
                <Input id="project-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, technology or keyword" autoComplete="off" />
              </InputGroup>
            </FormControl>
            <FormControl flex={1}>
              <FormLabel htmlFor="project-category">Category</FormLabel>
              <Select id="project-category" value={filters.category ?? ''} onChange={(e) => update({ category: e.target.value || undefined })}>
                <option value="">All categories</option>
                {categories.map((c) => (<option key={c} value={c}>{CATEGORY_LABELS[c]}</option>))}
              </Select>
            </FormControl>
            <FormControl flex={1}>
              <FormLabel htmlFor="project-sort">Sort by</FormLabel>
              <Select id="project-sort" value={filters.sort ?? 'featured'} onChange={(e) => update({ sort: e.target.value as SortKey })}>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (<option key={k} value={k}>{SORT_LABELS[k]}</option>))}
              </Select>
            </FormControl>
          </Flex>

          <Box as="fieldset">
            <Text as="legend" fontSize="sm" fontWeight={500} color="content.secondary" mb={2}>Technology (projects must use all selected)</Text>
            <Wrap spacing={2}>
              {chips.map((tech) => {
                const on = selected.includes(tech);
                return (
                  <WrapItem key={tech}>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-pressed={on}
                      onClick={() => toggleTech(tech)}
                      bg={on ? 'accent.subtle' : 'transparent'}
                      borderColor={on ? 'accent.fg' : 'line.strong'}
                      color={on ? 'accent.fg' : 'content.secondary'}
                    >
                      {tech}
                    </Button>
                  </WrapItem>
                );
              })}
            </Wrap>
          </Box>

          <HStack justify="space-between" flexWrap="wrap" gap={2}>
            <Text role="status" aria-live="polite" color="content.secondary" fontSize="sm">
              Showing {results.length} of {projects.length} projects
            </Text>
            {hasFilters && (
              <Button size="sm" variant="ghost" leftIcon={<FiX aria-hidden="true" />} onClick={clear}>Clear filters</Button>
            )}
          </HStack>
        </Stack>
      </GlassCard>

      {results.length > 0 ? (
        <SimpleGrid as="ul" listStyleType="none" columns={{ base: 1, md: 2, xl: 3 }} spacing={{ base: 5, md: 6 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            {results.map((project, index) => (
              <MotionLi
                key={project.id}
                layout
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.22 }}
              >
                <ProjectCard project={project} priority={index < 3} />
              </MotionLi>
            ))}
          </AnimatePresence>
        </SimpleGrid>
      ) : (
        <GlassCard p={10} textAlign="center">
          <Stack spacing={4} align="center">
            <Text fontSize="xl" fontWeight={600}>Nothing matches those filters</Text>
            <Text color="content.secondary">Try removing a technology or searching for something broader.</Text>
            <Button onClick={clear}>Show all projects</Button>
          </Stack>
        </GlassCard>
      )}
    </Stack>
  );
}
