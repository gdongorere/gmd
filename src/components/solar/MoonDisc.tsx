// src/components/solar/MoonDisc.tsx
'use client';

import React from 'react';

/**
 * Moon phase disc as seen from the northern hemisphere. `cycle` 0 = new, 0.5 = full (waxing lit on the right).
 * The terminator is a half-ellipse whose width is cos(phase angle).
 */
export function MoonDisc({ cycle, size = 72 }: { cycle: number; size?: number }) {
  const r = size / 2 - 2, c = size / 2;
  const waxing = cycle < 0.5;
  const k = Math.cos(cycle * 2 * Math.PI); // 1 at new … −1 at full
  const rx = Math.abs(k) * r;
  // Lit limb: right half when waxing, left half when waning.
  const limb = waxing ? 1 : 0;
  const bulgeOnLit = k < 0; // gibbous: terminator bulges into the dark side
  const sweepTerm = waxing ? (bulgeOnLit ? 0 : 1) : (bulgeOnLit ? 1 : 0);
  const d = `M ${c} ${c - r} A ${r} ${r} 0 0 ${limb} ${c} ${c + r} A ${rx} ${r} 0 0 ${sweepTerm} ${c} ${c - r} Z`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Moon phase" data-testid="moon-disc">
      <circle cx={c} cy={c} r={r} fill="#1a2030" stroke="rgba(255,255,255,0.25)" />
      <path d={d} fill="#eee8d4" />
    </svg>
  );
}
