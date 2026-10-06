// src/app/fly/page.tsx
import type { Metadata } from 'next';
import FlyApp from '@/components/fly/FlyApp';

export const metadata: Metadata = {
  title: 'Fly: the Kestrel',
  description: 'The Kestrel, a small glass-bubble VTOL scout, in the hangar. Orbit it, fold its legs, light its engines.',
  robots: { index: false, follow: false }, // not public until /fly is released
  alternates: { canonical: '/fly' },
};

export default function FlyPage() {
  return <FlyApp />;
}
