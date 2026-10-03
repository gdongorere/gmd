// src/app/page.tsx
import type { Metadata } from 'next';
import HomePageClient from '@/components/HomePageClient';
import { profile } from '@/data/profile';

export const metadata: Metadata = {
  title: { absolute: `${profile.name} · Full-stack developer` },
  description: `${profile.tagline} Explore projects, experience and an explorable 3D Milky Way.`,
  alternates: { canonical: '/' },
};

export default function Page() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: profile.name,
    jobTitle: profile.title,
    url: profile.siteUrl,
    email: `mailto:${profile.email}`,
    address: { '@type': 'PostalAddress', addressCountry: profile.location },
    sameAs: [profile.github.url, profile.linkedin.url],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <HomePageClient />
    </>
  );
}
