// src/app/projects/[slug]/opengraph-image.tsx
import { OG_SIZE, renderOgImage } from '@/lib/ogImage';
import { getProject } from '@/lib/projects';
import { projectsData } from '@/data/projectsData';

export const alt = 'Project case study';
export const size = OG_SIZE;
export const contentType = 'image/png';

export function generateStaticParams() {
  return projectsData.map((p) => ({ slug: p.id }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = getProject(slug);
  return renderOgImage({ eyebrow: 'Case study', title: project?.name ?? 'Project', subtitle: project?.shortDescription });
}
