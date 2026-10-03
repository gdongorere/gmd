// src/app/global-error.tsx
// Last-resort boundary: replaces the whole document, so it can't rely on the theme or providers.
'use client';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', background: '#0A0A0A', color: '#fff', fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: 24 }}>
        <main>
          <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', margin: '0 0 12px' }}>Something went wrong</h1>
          <p style={{ color: '#C4C4C4', margin: '0 0 24px' }}>The page failed to load. Please try again.</p>
          <button onClick={reset} style={{ background: '#C93400', color: '#fff', border: 0, borderRadius: 12, padding: '12px 24px', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
