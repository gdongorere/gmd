// src/components/ui/Links.tsx
'use client';

import React from 'react';
import NextLink from 'next/link';
import { Button, ButtonProps, Link, LinkProps, VisuallyHidden } from '@chakra-ui/react';
import { FiArrowUpRight } from 'react-icons/fi';

/** A real <a> styled as a button (client-side navigation for internal hrefs). */
export function ButtonLink({ href, children, ...rest }: ButtonProps & { href: string }) {
  const external = /^(https?:|mailto:|tel:)/.test(href);
  const isFile = /\.(pdf|zip)$/i.test(href);
  if (external || isFile) {
    return (
      <Button
        as="a"
        href={href}
        {...(/^https?:/.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        {...(isFile ? { download: true } : {})}
        {...rest}
      >
        {children}
      </Button>
    );
  }
  return (
    <Button as={NextLink} href={href} {...rest}>
      {children}
    </Button>
  );
}

/** An inline text link that opens externally and tells screen readers so. */
export function ExternalLink({ href, children, showIcon = true, ...rest }: LinkProps & { href: string; showIcon?: boolean }) {
  return (
    <Link href={href} isExternal rel="noopener noreferrer" display="inline-flex" alignItems="center" gap={1} {...rest}>
      {children}
      {showIcon && <FiArrowUpRight aria-hidden="true" />}
      <VisuallyHidden>(opens in a new tab)</VisuallyHidden>
    </Link>
  );
}
