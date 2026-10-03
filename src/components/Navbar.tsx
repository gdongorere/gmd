// src/components/Navbar.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Box, Button, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay,
  Flex, HStack, IconButton, Link, Stack, Text, useDisclosure,
} from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { FiDownload, FiGithub, FiLinkedin, FiMail, FiMenu } from 'react-icons/fi';
import { navItems, profile } from '@/data/profile';

const MotionSpan = motion.span;

function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <Link
      as={NextLink}
      href="/"
      onClick={onClick}
      aria-label={`${profile.name} — home`}
      _hover={{ textDecoration: 'none' }}
      fontFamily="heading"
      fontWeight={700}
      fontSize={{ base: 'lg', md: 'xl' }}
      letterSpacing="-0.02em"
      color="content.primary"
      whiteSpace="nowrap"
    >
      {profile.firstName}{' '}
      <Box as="span" color="accent.fg">
        {profile.lastName}
      </Box>
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const lastY = useRef(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Close the drawer whenever the route changes.
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  // Compact on scroll; on small screens hide while scrolling down and return on scroll up.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setScrolled(y > 24);
      const delta = y - lastY.current;
      if (Math.abs(delta) > 8) {
        const small = window.matchMedia('(max-width: 47.99em)').matches;
        setHidden(small && delta > 0 && y > 160);
        lastY.current = y;
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Scroll-spy for the in-page "About" link on the home page.
  useEffect(() => {
    setSection(null);
    if (pathname !== '/') return;
    let observer: IntersectionObserver | undefined;
    const attach = () => {
      const el = document.getElementById('about');
      if (!el) return false;
      observer = new IntersectionObserver(([entry]) => setSection(entry.isIntersecting ? 'about' : null), {
        rootMargin: '-40% 0px -45% 0px',
      });
      observer.observe(el);
      return true;
    };
    let retry = 0;
    if (!attach()) retry = window.setTimeout(attach, 400);
    return () => {
      window.clearTimeout(retry);
      observer?.disconnect();
    };
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/' && section !== 'about';
    if (href === '/#about') return pathname === '/' && section === 'about';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <Box
        as="header"
        position="fixed"
        top={0}
        insetX={0}
        zIndex={50}
        px={{ base: 3, md: 4 }}
        pt={3}
        transform={hidden && !isOpen ? 'translateY(-120%)' : 'none'}
        transition="transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)"
        pointerEvents="none"
      >
        <Flex
          as="nav"
          aria-label="Main"
          maxW="container.xl"
          mx="auto"
          h="60px"
          px={{ base: 4, md: 6 }}
          align="center"
          justify="space-between"
          bg={scrolled ? 'surface.glassStrong' : 'surface.glass'}
          border="1px solid"
          borderColor="line.subtle"
          borderRadius="2xl"
          backdropFilter="blur(14px) saturate(160%)"
          boxShadow={scrolled ? 'lg' : 'md'}
          transition="background-color 200ms, box-shadow 200ms"
          pointerEvents="auto"
        >
          <Logo />

          {/* Desktop */}
          <HStack as="ul" listStyleType="none" spacing={1} display={{ base: 'none', md: 'flex' }} h="100%">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Box as="li" key={item.href} position="relative" h="100%" display="flex" alignItems="center">
                  <Button
                    as={NextLink}
                    href={item.href}
                    variant="ghost"
                    size="md"
                    aria-current={active ? 'page' : undefined}
                    color={active ? 'white' : 'content.secondary'}
                  >
                    {item.label}
                  </Button>
                  {active && (
                    <MotionSpan
                      layoutId="nav-underline"
                      aria-hidden="true"
                      style={{ position: 'absolute', left: 14, right: 14, bottom: 8, height: 2, borderRadius: 2, background: 'var(--chakra-colors-accent-fg)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </Box>
              );
            })}
            <Box as="li" ml={2}>
              <Button as="a" href={profile.resume.url} download variant="outline" size="sm" leftIcon={<FiDownload aria-hidden="true" />}>
                Résumé
              </Button>
            </Box>
          </HStack>

          {/* Mobile */}
          <IconButton
            ref={menuButtonRef}
            display={{ base: 'inline-flex', md: 'none' }}
            variant="ghost"
            aria-label="Open menu"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            icon={<FiMenu size={22} />}
            onClick={onOpen}
            boxSize="48px"
            mr={-2}
          />
        </Flex>
      </Box>

      <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="xs" finalFocusRef={menuButtonRef}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton top={4} right={4} size="lg" />
          <DrawerHeader pt={6}>
            <Logo onClick={onClose} />
          </DrawerHeader>
          <DrawerBody display="flex" flexDirection="column" justifyContent="space-between" pb={8}>
            <Stack as="nav" aria-label="Mobile" spacing={1} mt={4}>
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Button
                    key={item.href}
                    as={NextLink}
                    href={item.href}
                    variant="ghost"
                    justifyContent="flex-start"
                    h="52px"
                    fontSize="lg"
                    aria-current={active ? 'page' : undefined}
                    color={active ? 'accent.fg' : 'content.primary'}
                    borderLeft="3px solid"
                    borderColor={active ? 'accent.fg' : 'transparent'}
                    borderRadius="md"
                    onClick={onClose}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Stack>

            <Stack spacing={4}>
              <Button as="a" href={profile.resume.url} download leftIcon={<FiDownload aria-hidden="true" />} size="lg">
                Download résumé
              </Button>
              <HStack spacing={2} justify="center">
                <IconButton as="a" href={profile.github.url} target="_blank" rel="noopener noreferrer" aria-label="GitHub (opens in a new tab)" icon={<FiGithub size={20} />} variant="ghost" boxSize="48px" />
                <IconButton as="a" href={profile.linkedin.url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn (opens in a new tab)" icon={<FiLinkedin size={20} />} variant="ghost" boxSize="48px" />
                <IconButton as="a" href={`mailto:${profile.email}`} aria-label="Email" icon={<FiMail size={20} />} variant="ghost" boxSize="48px" />
              </HStack>
              <Text fontSize="sm" color="content.muted" textAlign="center">
                {profile.location} · {profile.availability}
              </Text>
            </Stack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
