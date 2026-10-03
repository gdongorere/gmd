// src/lib/projects.ts
// Pure helpers for project data: lookup, filtering, sorting and description parsing.
import { projectsData, type Project } from '@/data/projectsData';

export const CATEGORY_LABELS: Record<NonNullable<Project['category']>, string> = {
  ecommerce: 'E-commerce',
  management: 'Management',
  education: 'Education',
  productivity: 'Productivity',
  utility: 'Utility',
  game: 'Games',
  design: 'Design',
  enterprise: 'Enterprise',
  marketplace: 'Marketplace',
  industrial: 'Industrial',
};

export type SortKey = 'featured' | 'newest' | 'name';
export const SORT_LABELS: Record<SortKey, string> = { featured: 'Featured first', newest: 'Newest first', name: 'A → Z' };

export interface ProjectFilters {
  q?: string;
  tech?: string[];
  category?: string;
  sort?: SortKey;
}

export const getProject = (slug: string) => projectsData.find((p) => p.id === slug);

export function getAdjacentProjects(slug: string) {
  const i = projectsData.findIndex((p) => p.id === slug);
  if (i < 0) return { prev: undefined, next: undefined };
  const len = projectsData.length;
  return { prev: projectsData[(i - 1 + len) % len], next: projectsData[(i + 1) % len] };
}

/** Technologies sorted by how many projects use them. */
export function techCounts(projects: Project[] = projectsData): { tech: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const p of projects) for (const t of p.tech ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tech, count]) => ({ tech, count }))
    .sort((a, b) => b.count - a.count || a.tech.localeCompare(b.tech));
}

export function filterProjects(projects: Project[], { q, tech = [], category, sort = 'featured' }: ProjectFilters): Project[] {
  const query = (q ?? '').trim().toLowerCase();
  const result = projects.filter((p) => {
    if (category && p.category !== category) return false;
    // A project must use every selected technology.
    if (tech.length && !tech.every((t) => p.tech?.includes(t))) return false;
    if (query) {
      const haystack = [p.name, p.shortDescription, p.role, ...(p.tech ?? [])].join(' ').toLowerCase();
      if (!query.split(/\s+/).every((word) => haystack.includes(word))) return false;
    }
    return true;
  });

  const index = new Map(projects.map((p, i) => [p.id, i]));
  return result.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'newest') return (b.year ?? 0) - (a.year ?? 0) || index.get(a.id)! - index.get(b.id)!;
    return Number(!!b.featured) - Number(!!a.featured) || (b.year ?? 0) - (a.year ?? 0) || index.get(a.id)! - index.get(b.id)!;
  });
}

export type DescriptionBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] };

/** Turns the plain-text long descriptions ("Key Features:" + "• item" lines) into structured blocks. */
export function parseLongDescription(text: string | undefined): DescriptionBlock[] {
  if (!text) return [];
  const blocks: DescriptionBlock[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push({ type: 'ul', items: list });
    list = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const bullet = line.match(/^[•\-*]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flush();
    if (/^[A-Z][^.!?]{0,60}:$/.test(line)) blocks.push({ type: 'h', text: line.slice(0, -1) });
    else blocks.push({ type: 'p', text: line });
  }
  flush();
  return blocks;
}

/** Parses the `tech`, `q`, `category`, `sort` URL params into filters. */
export function filtersFromParams(params: URLSearchParams): ProjectFilters {
  const sort = params.get('sort');
  return {
    q: params.get('q') ?? '',
    tech: params.getAll('tech'),
    category: params.get('category') ?? undefined,
    sort: sort === 'newest' || sort === 'name' ? sort : 'featured',
  };
}

export function paramsFromFilters({ q, tech = [], category, sort }: ProjectFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (q?.trim()) params.set('q', q.trim());
  tech.forEach((t) => params.append('tech', t));
  if (category) params.set('category', category);
  if (sort && sort !== 'featured') params.set('sort', sort);
  return params;
}
