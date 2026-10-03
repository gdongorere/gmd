// src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { projectsData } from '@/data/projectsData';
import { profile } from '@/data/profile';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages = [
    { path: '', priority: 1 },
    { path: '/projects', priority: 0.9 },
    { path: '/contact', priority: 0.6 },
    { path: '/stars', priority: 0.5 },
  ];
  return [
    ...pages.map(({ path, priority }) => ({ url: `${profile.siteUrl}${path}`, lastModified: now, priority })),
    ...projectsData.map((p) => ({ url: `${profile.siteUrl}/projects/${p.id}`, lastModified: now, priority: 0.7 })),
  ];
}
