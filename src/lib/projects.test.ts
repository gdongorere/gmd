import { describe, expect, it } from 'vitest';
import { projectsData } from '@/data/projectsData';
import { filterProjects, filtersFromParams, getAdjacentProjects, getProject, paramsFromFilters, parseLongDescription, techCounts } from './projects';

describe('projects', () => {
  it('every project has a unique slug and a name', () => {
    const ids = projectsData.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of projectsData) expect(p.name.length).toBeGreaterThan(0);
  });

  it('finds projects and wraps adjacent navigation', () => {
    expect(getProject('venda-khona')?.name).toBe('Venda Khona');
    expect(getProject('nope')).toBeUndefined();
    const first = projectsData[0].id;
    const last = projectsData[projectsData.length - 1].id;
    expect(getAdjacentProjects(first).prev?.id).toBe(last);
    expect(getAdjacentProjects(last).next?.id).toBe(first);
  });

  it('filters by search, technology (all must match) and category', () => {
    const react = filterProjects(projectsData, { tech: ['React'] });
    expect(react.length).toBeGreaterThan(0);
    react.forEach((p) => expect(p.tech).toContain('React'));
    const both = filterProjects(projectsData, { tech: ['React', 'TypeScript'] });
    expect(both.length).toBeLessThanOrEqual(react.length);
    expect(filterProjects(projectsData, { q: 'zzzz-no-match' })).toHaveLength(0);
    const cat = projectsData.find((p) => p.category)!.category!;
    filterProjects(projectsData, { category: cat }).forEach((p) => expect(p.category).toBe(cat));
  });

  it('sorts featured first by default and A→Z on request', () => {
    const featured = filterProjects(projectsData, {});
    const firstNonFeatured = featured.findIndex((p) => !p.featured);
    expect(featured.slice(0, firstNonFeatured).every((p) => p.featured)).toBe(true);
    const names = filterProjects(projectsData, { sort: 'name' }).map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('round-trips filters through URL params', () => {
    const filters = { q: 'offline', tech: ['React', 'Node.js'], category: 'ecommerce', sort: 'newest' as const };
    const parsed = filtersFromParams(paramsFromFilters(filters));
    expect(parsed).toEqual(filters);
    expect(paramsFromFilters({ q: '  ', sort: 'featured' }).toString()).toBe('');
  });

  it('counts technologies, most-used first', () => {
    const counts = techCounts();
    for (let i = 1; i < counts.length; i++) expect(counts[i - 1].count).toBeGreaterThanOrEqual(counts[i].count);
  });

  it('parses long descriptions into headings, bullets and paragraphs', () => {
    const blocks = parseLongDescription('Intro line.\n\nKey Features:\n• One: first\n• Two: second\n\nClosing.');
    expect(blocks.map((b) => b.type)).toEqual(['p', 'h', 'ul', 'p']);
    expect(blocks[2]).toEqual({ type: 'ul', items: ['One: first', 'Two: second'] });
    expect(parseLongDescription(undefined)).toEqual([]);
  });
});
