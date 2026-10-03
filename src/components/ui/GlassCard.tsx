// src/components/ui/GlassCard.tsx
'use client';

import { Box, BoxProps, forwardRef } from '@chakra-ui/react';

export interface GlassCardProps extends BoxProps {
  /** Lifts and brightens the border on hover/focus-within (use for clickable cards). */
  interactive?: boolean;
  /** A more opaque surface for text-heavy content that sits over bright parts of the galaxy. */
  strong?: boolean;
}

/** The site's frosted-glass surface. One definition, used everywhere. */
export const GlassCard = forwardRef<GlassCardProps, 'div'>(({ interactive, strong, ...rest }, ref) => (
  <Box
    ref={ref}
    bg={strong ? 'surface.glassStrong' : 'surface.glass'}
    border="1px solid"
    borderColor="line.subtle"
    borderRadius="2xl"
    boxShadow="md"
    backdropFilter="blur(14px) saturate(160%)"
    transitionProperty="transform, box-shadow, border-color"
    transitionDuration="200ms"
    _hover={interactive ? { borderColor: 'line.strong', transform: 'translateY(-3px)', boxShadow: 'lg' } : undefined}
    _focusWithin={interactive ? { borderColor: 'accent.fg' } : undefined}
    {...rest}
  />
));
GlassCard.displayName = 'GlassCard';
