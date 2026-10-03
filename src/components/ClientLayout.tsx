// src/components/ClientLayout.tsx
'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Box, Flex } from '@chakra-ui/react';
import { Navbar } from '@/components/Navbar';
import { Footer, FooterProject } from '@/components/Footer';
import GalaxyControls from '@/components/galaxy/GalaxyControls';

/** Immersive routes that supply their own chrome. */
const BARE_ROUTES = ['/stars', '/house-viewer'];

export default function ClientLayout({
  children,
  footerProjects,
}: {
  children: React.ReactNode;
  siteTitle?: string;
  footerProjects?: FooterProject[];
}) {
  const pathname = usePathname();
  const bare = BARE_ROUTES.includes(pathname);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  // After a client-side navigation, move focus to the new page so keyboard and screen-reader
  // users start at the top of the content instead of on the link they just activated.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <Flex direction="column" minH="100dvh" position="relative" zIndex={10}>
      <Box
        as="a"
        href="#main"
        position="fixed"
        top={3}
        left={3}
        zIndex={100}
        px={4}
        py={2}
        borderRadius="md"
        bg="accent.solid"
        color="white"
        fontWeight={600}
        transform="translateY(-200%)"
        _focus={{ transform: 'none' }}
        transition="transform 150ms"
      >
        Skip to content
      </Box>
      {!bare && <Navbar />}
      <Box as="main" id="main" ref={mainRef} tabIndex={-1} flex="1" pt={bare ? 0 : '72px'} _focus={{ outline: 'none' }}>
        {children}
      </Box>
      {!bare && <Footer projects={footerProjects} />}
      {!bare && <GalaxyControls />}
    </Flex>
  );
}
