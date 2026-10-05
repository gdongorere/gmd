// src/app/stars/opengraph-image.tsx
import { OG_SIZE, renderOgImage } from '@/lib/ogImage';

export const alt = 'Explore the Milky Way, the Solar System and time itself';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default function Image() {
  return renderOgImage({
    eyebrow: 'Interactive',
    title: 'Explore the Milky Way',
    subtitle: 'Fly from the galaxy to Earth, then travel to any date: Mars dust storms, the last ice age, a galactic year ago.',
  });
}
