# Godliness Dongorere — portfolio

A Next.js portfolio with a scientifically grounded, scaled-down 3D model of the Milky Way as its living background.

- **Stack:** Next.js 15 (App Router), React 18, TypeScript, Chakra UI, framer-motion, three.js, Sanity (contact messages).
- **Highlights:** WebGL galaxy with adaptive quality tiers, scroll-driven camera waypoints, an explorable `/stars` page, case-study pages for every project, and a walkable 3D house viewer.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the Sanity values
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | client + server | Sanity project |
| `NEXT_PUBLIC_SANITY_DATASET` | client + server | Dataset (default `production`) |
| `NEXT_PUBLIC_SANITY_API_VERSION` | client + server | API version |
| `SANITY_API_WRITE_TOKEN` | **server only** | Lets `/api/contact` store messages. Never prefix it with `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_SITE_URL` | client + server | Canonical URL for metadata, sitemap and share cards |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript without emitting |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Browser tests: smoke, accessibility (Playwright + axe) |

## Project layout

```
src/app/                 routes (home, /projects, /projects/[slug], /contact, /stars, /house-viewer, /api/contact)
src/components/          UI: nav, footer, home sections, project cards, contact form
src/components/ui/       design-system building blocks (GlassCard, Section, ...)
src/components/galaxy/   galaxy canvas, waypoints, explore mode
src/lib/galaxy/          galaxy model, shaders, quality governor, camera views
src/data/                profile and project content
docs/                    design notes, UX plans, archived drafts
```

## The galaxy

See [`docs/milky-way-starfield.md`](docs/milky-way-starfield.md) for the model, the real-world constants, the quality tiers and how to test weak devices (`?quality=low`).

## Content and security notes

- Project content lives in `src/data/projectsData.ts`; personal details in `src/data/profile.ts`.
- `/api/contact` accepts new messages only (validated, rate-limited, honeypot-protected). Stored messages are read in Sanity Studio.
- The Sanity write client is in `src/lib/sanity.server.ts` and is server-only.
