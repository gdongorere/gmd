// src/components/ui/Reveal.tsx
'use client';

import React from 'react';
import { motion } from 'framer-motion';

/** Fades content up once as it scrolls into view. Honours reduced-motion via MotionConfig. */
export function Reveal({ children, delay = 0, y = 16 }: { children: React.ReactNode; delay?: number; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-8% 0px' }}
      transition={{ duration: 0.45, delay, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
