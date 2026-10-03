// src/lib/ogImage.tsx
// Shared share-card artwork: a dark field, an orange galactic glow and big type.
import { ImageResponse } from 'next/og';
import { profile } from '@/data/profile';

export const OG_SIZE = { width: 1200, height: 630 };

export function renderOgImage({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72,
          color: 'white', background: '#0A0A0A',
          backgroundImage:
            'radial-gradient(ellipse 60% 45% at 78% 42%, rgba(255,150,80,0.55), rgba(255,63,0,0.18) 45%, rgba(10,10,10,0) 72%), radial-gradient(ellipse 90% 30% at 78% 42%, rgba(120,150,255,0.22), rgba(10,10,10,0) 70%)',
        }}
      >
        <div style={{ display: 'flex', fontSize: 28, letterSpacing: 6, textTransform: 'uppercase', color: '#FF7A45' }}>{eyebrow}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 820 }}>
          <div style={{ display: 'flex', fontSize: title.length > 28 ? 72 : 92, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>{title}</div>
          {subtitle && <div style={{ display: 'flex', fontSize: 32, color: '#C4C4C4', lineHeight: 1.3 }}>{subtitle.length > 130 ? `${subtitle.slice(0, 127)}…` : subtitle}</div>}
        </div>
        <div style={{ display: 'flex', fontSize: 28, color: '#C4C4C4' }}>
          {profile.name} · {profile.title}
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
