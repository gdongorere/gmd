// src/app/stars/page.tsx
import type { Metadata } from 'next';
import ExploreMode from '@/components/galaxy/explore/ExploreMode';

export const metadata: Metadata = {
  title: 'Explore the Milky Way and travel through time',
  description: 'Fly through a scaled model of the Milky Way, drop into a real-time 3D Solar System down to Earth, and travel to any date: Mars dust storms, the last ice age, a galactic year ago.',
  alternates: { canonical: '/stars' },
  openGraph: { title: 'Explore the Milky Way and travel through time', description: 'A scaled Milky Way, a real-time 3D Solar System and a time machine, in your browser.', url: '/stars' },
};

export default function StarsPage() {
  return <ExploreMode />;
}
