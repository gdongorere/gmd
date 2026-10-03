// src/app/projects/page.tsx
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Section } from '@/components/ui';
import { ProjectsExplorer } from '@/components/ProjectsExplorer';
import { projectsData } from '@/data/projectsData';
import Loading from './loading';

export const metadata: Metadata = {
  title: 'Projects',
  description: 'Case studies of full-stack, industrial and 3D projects: marketplaces, field-service systems, university platforms and more.',
  alternates: { canonical: '/projects' },
};

export default function ProjectsPage() {
  return (
    <>
      <Section
        view="tilted"
        headingLevel="h1"
        eyebrow="Selected work"
        title="Projects"
        subtitle="Products I’ve designed and built, from offline-first marketplaces to PLC dashboards. Open any one for the full case study."
        pb={{ base: 4, md: 8 }}
      />
      <Section view="arm-flyby" id="all-projects" aria-label="All projects" pt={{ base: 4, md: 8 }}>
        <Suspense fallback={<Loading />}>
          <ProjectsExplorer projects={projectsData} />
        </Suspense>
      </Section>
    </>
  );
}
