// src/components/ProjectMedia.tsx
'use client';

import React from 'react';
import Image from 'next/image';
import { Box, Text } from '@chakra-ui/react';
import { projectMedia } from '@/data/projectMedia';

function hue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

interface ProjectMediaProps {
  id: string;
  name: string;
  alt?: string;
  priority?: boolean;
  sizes?: string;
  /** Which shot to prefer when both exist. */
  prefer?: 'desktop' | 'mobile';
}

/** The project's screenshot in a consistent 16:10 frame, with a graceful generated fallback. */
export function ProjectMedia({ id, name, alt, priority, sizes = '(min-width: 62em) 400px, (min-width: 48em) 50vw, 100vw', prefer = 'desktop' }: ProjectMediaProps) {
  const media = projectMedia[id];
  const h = hue(id);
  const backdrop = `radial-gradient(120% 90% at 20% 0%, hsl(${h} 70% 28% / 0.9), transparent 60%), radial-gradient(100% 80% at 90% 100%, hsl(${(h + 60) % 360} 70% 22% / 0.9), transparent 60%), #111`;
  const shot = prefer === 'mobile' ? media?.mobile ?? media?.desktop : media?.desktop ?? media?.mobile;
  const isPhone = shot && shot === media?.mobile && shot !== media?.desktop;

  return (
    <Box position="relative" w="100%" sx={{ aspectRatio: '16 / 10' }} overflow="hidden" bg="gray.900" style={{ backgroundImage: backdrop }}>
      {shot && !isPhone && (
        <Image src={shot.src} alt={alt ?? `${name} screenshot`} fill sizes={sizes} priority={priority} style={{ objectFit: 'cover', objectPosition: 'top left' }} />
      )}
      {shot && isPhone && (
        <Box position="absolute" top="7%" bottom="-4%" left="50%" transform="translateX(-50%)" sx={{ aspectRatio: `${shot.width} / ${shot.height}` }} borderRadius="22px" border="3px solid" borderColor="whiteAlpha.500" overflow="hidden" boxShadow="xl" bg="black">
          <Image src={shot.src} alt={alt ?? `${name} mobile screenshot`} fill sizes="240px" priority={priority} style={{ objectFit: 'cover', objectPosition: 'top' }} />
        </Box>
      )}
      {!shot && (
        <Box position="absolute" inset={0} display="grid" placeItems="center" aria-hidden="true">
          <Text fontFamily="heading" fontWeight={700} fontSize="5xl" color="whiteAlpha.700" letterSpacing="-0.04em">{initials(name)}</Text>
        </Box>
      )}
    </Box>
  );
}
