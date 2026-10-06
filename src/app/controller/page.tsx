// src/app/controller/page.tsx
import type { Metadata } from 'next';
import ControllerLab from '@/components/input/ControllerLab';

export const metadata: Metadata = {
  title: 'Controller check',
  description: 'See what your gamepad reports, test vibration, and teach the site a controller once so it works everywhere.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/controller' },
};

export default function ControllerPage() {
  return <ControllerLab />;
}
