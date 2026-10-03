// src/app/opengraph-image.tsx
import { OG_SIZE, renderOgImage } from '@/lib/ogImage';
import { profile } from '@/data/profile';

export const alt = `${profile.name} — ${profile.title}`;
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderOgImage({ eyebrow: 'Portfolio', title: profile.name, subtitle: profile.tagline });
}
