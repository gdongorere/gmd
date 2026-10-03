// src/lib/sanity.server.ts
// Server-only Sanity client with write access. Never import this from a client
// component: the token below must stay out of the browser bundle.
import 'server-only';
import { createClient, type SanityClient } from 'next-sanity';

let cached: SanityClient | null = null;

/**
 * Lazily creates the write client so importing this module never throws at build
 * time when the CMS env vars are absent (e.g. in CI).
 */
export function getWriteClient(): SanityClient {
  if (cached) return cached;

  // SANITY_API_WRITE_TOKEN is the correct name. The NEXT_PUBLIC_ fallback only keeps
  // existing deployments working until the variable is renamed; that token has been
  // exposed under a public name, so it should be rotated in the Sanity dashboard.
  const token = process.env.SANITY_API_WRITE_TOKEN ?? process.env.NEXT_PUBLIC_SANITY_API_WRITE_TOKEN;
  if (!process.env.SANITY_API_WRITE_TOKEN && token) {
    console.warn('[sanity] Using NEXT_PUBLIC_SANITY_API_WRITE_TOKEN. Rename it to SANITY_API_WRITE_TOKEN and rotate it.');
  }

  cached = createClient({
    projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || 'missing-project-id',
    dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
    apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-05-20',
    useCdn: false,
    token,
  });
  return cached;
}
