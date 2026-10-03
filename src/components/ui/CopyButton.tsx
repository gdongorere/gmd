// src/components/ui/CopyButton.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { IconButton, VisuallyHidden } from '@chakra-ui/react';
import { FiCheck, FiCopy } from 'react-icons/fi';

/** Copies text and confirms with a visible icon change plus a screen-reader announcement. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement('textarea');
      area.value = value;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <IconButton
        aria-label={`Copy ${label}`}
        icon={copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
        size="sm"
        variant="ghost"
        color={copied ? 'green.300' : undefined}
        onClick={copy}
      />
      <VisuallyHidden role="status" aria-live="polite">{copied ? `${label} copied` : ''}</VisuallyHidden>
    </>
  );
}
