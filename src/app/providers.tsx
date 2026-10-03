// src/app/providers.tsx
'use client';

import { ChakraProvider } from '@chakra-ui/react';
import { MotionConfig } from 'framer-motion';
import theme from '@/app/theme/theme';
import { StarfieldProvider } from '@/contexts/StarfieldContext';
import EnhancedStarfield from '@/components/EnhancedStarfield';

interface ProvidersProps {
  children?: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ChakraProvider theme={theme}>
      {/* Every framer-motion animation honours the visitor's reduced-motion setting. */}
      <MotionConfig reducedMotion="user">
        <StarfieldProvider>
          <EnhancedStarfield />
          {children}
        </StarfieldProvider>
      </MotionConfig>
    </ChakraProvider>
  );
}
