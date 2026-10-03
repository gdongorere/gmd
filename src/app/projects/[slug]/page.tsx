// src/app/projects/[slug]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { projectsData } from '@/data/projectsData';
import { getAdjacentProjects, getProject } from '@/lib/projects';
import { profile } from '@/data/profile';
import { ProjectCaseStudy } from '@/components/ProjectCaseStudy';

export const dynamicParams = false;

export function generateStaticParams() {
  return projectsData.map((p) => ({ slug: p.id }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return { title: 'Project not found' };
  return {
    title: project.name,
    description: project.shortDescription,
    alternates: { canonical: `/projects/${project.id}` },
    openGraph: { type: 'article', title: project.name, description: project.shortDescription, url: `/projects/${project.id}` },
    twitter: { card: 'summary_large_image', title: project.name, description: project.shortDescription },
  };
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();
  const { prev, next } = getAdjacentProjects(slug);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.name,
    description: project.shortDescription,
    url: `${profile.siteUrl}/projects/${project.id}`,
    dateCreated: project.year ? String(project.year) : undefined,
    keywords: project.tech?.join(', '),
    author: { '@type': 'Person', name: profile.name, url: profile.siteUrl },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <ProjectCaseStudy project={project} prev={prev} next={next} />
    </>
  );
}
