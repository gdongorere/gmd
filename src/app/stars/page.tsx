// src/app/stars/page.tsx
import type { Metadata } from 'next';
import ExploreMode from '@/components/galaxy/explore/ExploreMode';

export const metadata: Metadata = {
  title: 'Explore the Milky Way',
  description: 'Fly through a scaled model of the Milky Way: orbit, zoom, jump to the Sun, Sgr A* or the Magellanic Clouds, and take a guided tour.',
  alternates: { canonical: '/stars' },
};

export default function StarsPage() {
  return <ExploreMode />;
}
