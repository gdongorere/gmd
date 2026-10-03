// src/app/house-viewer/page.tsx
import type { Metadata } from 'next';
import HouseViewerShell from '@/components/HouseViewerShell';

export const metadata: Metadata = {
  title: '3D House Viewer',
  description: 'Walk through an interactive 3D house with physics, collision and touch controls, built with Three.js.',
  alternates: { canonical: '/house-viewer' },
};

export default function HouseViewerPage() {
  return <HouseViewerShell />;
}
