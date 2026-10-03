// src/app/template.tsx
// Re-mounts on every navigation: a short opacity fade between pages. Opacity only,
// because a transform here would break position:fixed controls inside pages.
'use client';

import { motion } from 'framer-motion';

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}
