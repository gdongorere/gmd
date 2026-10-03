# Plan: UI/UX overhaul for the rest of the site

**Scope:** everything except the galaxy renderer:
- navigation, home, projects, project detail, contact
- the 404 page, page transitions and the house viewer
- the design system, accessibility, SEO, performance, and the code health that supports them

Findings below come from reading the current code.

---

## 0. Fix first (security and correctness)

These are not cosmetic, so they go before any redesign.

| # | Finding | Where | Risk | Fix |
| --- | --- | --- | --- | --- |
| S1 | Sanity **write token** uses a `NEXT_PUBLIC_` env var. Next.js inlines these into any client bundle that touches the module. | `src/lib/sanity.ts:60` | Anyone could write to or delete your CMS if it ships to the browser | Rename to server-only `SANITY_API_WRITE_TOKEN`, move `writeClient` into a `server-only` module, **rotate the token in Sanity** |
| S2 | `GET /api/contact` returns **every contact submission** (names, emails, messages) with no auth | `src/app/api/contact/route.ts:9` | Personal data leak | Delete the GET handler, or protect it behind auth (e.g. a Vercel-protected admin route or a secret header) |
| S3 | `POST /api/projects` lets **anyone create projects and upload images** | `src/app/api/projects/route.ts:9` | Spam or defacement of the portfolio | Remove it (manage projects in Sanity Studio) or require auth |
| S4 | The contact form has no spam protection | `ContactForm.tsx`, `api/contact` POST | Inbox spam, Sanity quota use | Honeypot field + rate limit per IP + server-side validation (zod) |
| S5 | Next 15.3.6 has a published security advisory; the lockfile is out of sync with package.json (`npm ci` fails) | `package.json`, `package-lock.json` | Vulnerable framework; broken reproducible installs | Upgrade to the patched Next 15.x and regenerate the lockfile |
| C1 | Conflicting contact details: GitHub `geehyness` vs `gdongorere`, email `godlinessdongorere@gmail.com` vs `gdongorere@gmail.com` | `HomePageClient.tsx`, `Footer.tsx` | Visitors reach the wrong account | One `src/data/profile.ts` source of truth |
| C2 | The home page fetches projects, services and settings from Sanity, then **discards them**. The fetch still slows the page and makes builds depend on Sanity being reachable. | `src/app/page.tsx` | Slower TTFB, fragile builds | Either use the data or delete the query |
| C3 | Two sources of project data: local `projectsData.ts` (rendered) and Sanity (fetched but ignored on `/projects`) | `PublicProjects.tsx`, `projects/page.tsx` | Content drift | Pick Sanity (recommended) and migrate `projectsData.ts` into it |
| C4 | `ProjectDetailClient.tsx` exists, but no `/projects/[slug]` route uses it | `src/components` | No shareable project pages | Build the route (§5) |
| C5 | `README.md` contains song lyrics instead of project docs | repo root | Looks unprofessional to recruiters browsing GitHub | Write a real README (stack, setup, env vars, scripts, architecture) |
| C6 | Public files that may be unintended: `cover-letter-data.fi.html`, several resume HTML drafts, `DeepSeek - Into the Unknown.html` + assets | `public/` | Private drafts are world-readable | Review; delete or move out of `public/` |

---

## 1. Design system

**Problems:**
- `initialColorMode: 'light'`, yet the whole site is dark.
- `neutral.light` and `neutral.dark` are identical, and every component calls `useColorModeValue` for nothing.
- `brand` is a grey ramp, so `colorScheme="brand"` buttons are grey while the real brand colour is `accent` orange.
- `input-bg` is white on a dark site.
- The glass-card style is copy-pasted in at least 6 places.
- The focus ring (`rgba(102,102,102,0.2)`) is practically invisible.
- Inter is loaded twice (`next/font` plus a render-blocking `@import`).
- A global `* { margin: 0 }` reset fights Chakra.

**Plan:**

1. **Semantic tokens** (Chakra `semanticTokens`):

   | Group | Tokens |
   | --- | --- |
   | Backgrounds | `bg.canvas` (#0A0A0A), `bg.surface` (glass), `bg.surfaceRaised`, `bg.inset` |
   | Text | `text.primary` (#FFF), `text.secondary` (#B3B3B3, AA on surface), `text.muted` |
   | Borders | `border.subtle`, `border.strong` |
   | Accent | `accent.solid` (#FF3F00), `accent.fg`, `accent.subtle` |
   | Focus | `focus.ring` (#FF7F47, 2px + offset) |

   Delete `neutral.light` / `neutral.dark` and the colour-mode hooks, and set the colour mode to dark.
2. **Brand ramp:** make `brand` = the accent orange so `colorScheme="brand"` works. Keep the greys as `gray`.
3. **Type scale:**
   - Inter for body text, with a display face for headings (Space Grotesk or similar; Rubik Mono One is already loaded but heavy).
   - A fluid `clamp()` scale: display 56–88px, h1 40–64, h2 28–40, h3 20–24, body 16–18, small 14.
4. **Spacing, radii and elevation:** a 4px spacing grid; radii `md` 10 / `xl` 16 / `2xl` 24; three elevation levels with glass blur values.
5. **Motion tokens:**

   | Token | Value |
   | --- | --- |
   | `fast` | 120ms |
   | `base` | 200ms |
   | `slow` | 400ms |
   | Easing | `[0.2, 0.8, 0.2, 1]` |

   Wrap the app in framer-motion `MotionConfig reducedMotion="user"`.
6. **Components:** `GlassCard`, `Section` (eyebrow + title + subtitle + galaxy waypoint), `PrimaryButton`/`SecondaryButton`, `IconLink` (accessible external links), `TagList`, `Timeline`, `StatPill`, `Drawer`-based `MobileNav`, `EmptyState`, `Skeleton` variants.
7. **CSS cleanup:**
   - Remove the `@import` of Inter and the global `*` reset.
   - Remove `transition: all` on every link and button.
   - Remove the unused `.glitch-text` styles if they're no longer used.
   - Move the manual viewport meta to Next's `viewport` export.

**Acceptance:** no hard-coded colours in components. Every text/background pair is ≥ 4.5:1. Focus is visible on every interactive element.

---

## 2. Information architecture and navigation

**Today:**
- The nav has only Home and Projects.
- `/contact` exists but nothing links to it.
- The resume is buried at the bottom of the home page.
- The logo is an `<h1>` on every page (multiple h1s).
- The mobile menu has no exit animation, no focus trap, and doesn't close on Escape or route change; it also has a mismatched `#333` background.
- `/stars` hides the nav with no way back.

**Plan:**
- **Primary nav:** Home · Projects · About (section anchor) · Contact, plus a **Resume** button (accent outline) on the right.
- **Active state:** `aria-current="page"` with an accent underline that animates between items (shared layout animation).
- **Skip link:** "Skip to content" as the first focusable element.
- **Logo:** becomes `<span>` / `<Link aria-label="Home">`. Each page owns its single `<h1>`.
- **Mobile:** Chakra `Drawer` from the right, with a focus trap, Esc to close, close on route change, 48px touch targets, social links and a Resume CTA at the bottom.
- **Scroll behaviour:** the nav hides on scroll-down and reappears on scroll-up (mobile), and stays compact on desktop after 80px of scroll.
- **Footer:** sitemap columns (Pages / Work / Connect), social icons that match C1, "Back to top", a small "Built with Next.js + a real-scale Milky Way" credit linking to `/stars`.
- **`/stars`:** keep it immersive, but show a floating "← Back to site" control (see the galaxy plan §4).

---

## 3. Home page

**Today:**
- The hero is a stacked name, three icon buttons and a chevron, with no value proposition or call to action.
- Contact "cards" are divs with `onClick={window.open}`, so they aren't keyboard-accessible, can't be middle-clicked and give screen readers nothing to announce.
- Skills, experience and interests are long, uniform glass boxes.

**New structure** (each section is a galaxy waypoint, see the galaxy plan §2):

1. **Hero**
   - Name, a one-line value proposition ("Full-stack developer building fast, delightful products — from PLCs to the browser"), and a location/availability badge.
   - CTAs: **View projects** (primary), **Contact me** (secondary), **Download résumé** (text link).
   - Social icon links.
   - A scroll cue that hides after the first scroll.
2. **Proof strip:** 3–4 short stats or logos (years building, shipped apps, industries).
3. **Featured projects:** 3 large cards (see §4), plus "All projects →".
4. **About:** a short bio, a photo or avatar, and what you're looking for. Replaces the "Interests" box.
5. **Skills:** grouped chips with icons and a filter ("Show skills used in project X"). No fake percentage bars.
6. **Experience:** a vertical timeline with company, role, dates, 2–3 impact bullets each (quantified where possible), and tech chips.
7. **Contact CTA band:** a short pitch, the email with a copy-to-clipboard button and confirmation, the contact form link, and résumé download (PDF, with its size shown).

**Interaction details:**
- Real `<a href>` links everywhere, with `rel="noopener"` on external ones.
- Entrance animations at most 400ms, staggered and triggered once in view; skipped under reduced motion.
- Scrollspy highlights the current section in the nav and the galaxy progress rail.

---

## 4. Projects

**Today:**
- An auto-playing carousel with no pause control (fails WCAG 2.2.2) and no swipe.
- The modal overlay is **white** (`#ffffff99`) on a dark site.
- Screenshots use Chakra `Image` (no responsive sizing or lazy optimisation).
- There's no filtering, and no deep-linkable project pages.

**Plan:**
- **Card design:** device-framed screenshot (desktop and mobile), title, one-line outcome, 3 tech chips, role, year. Hover/focus lifts the card and reveals "Case study →".
- **Home carousel → curated grid** (3 cards). If a carousel is kept: no autoplay, swipe support, visible pagination, and arrow keys.
- **`/projects`:**
  - Filter chips by technology/domain (multi-select, reflected in the URL `?tech=react`).
  - Search box and sort (newest / featured).
  - Result count, an empty state, and a smooth layout animation when filters change.
- **`/projects/[slug]` case study** (reuses `ProjectDetailClient`):
  1. Hero with title, outcome, role, timeline, stack, links (Live / Code)
  2. Problem → Approach → Solution → Impact sections (from Sanity Portable Text)
  3. Gallery lightbox (keyboard ←/→, swipe, Esc, captions)
  4. "Next project" footer
  - Static generation with ISR, plus `generateMetadata` and an OG image per project.
- **Modal → route.** Clicking a card navigates to the case study (Next intercepting/parallel route for a modal-over-list on desktop, a full page on mobile). Back closes it, and the URL is shareable.
- **Images:** `next/image` with `sizes`, AVIF/WebP, blur placeholders from Sanity LQIP, and `priority` only for the first card.

---

## 5. Contact

**Today:**
- The page isn't linked from anywhere.
- Inputs are white on dark.
- Feedback comes only through toasts, so errors aren't announced next to the field.
- There's no spam protection.

**Plan:**
- Inline validation on blur, with errors under the field (`aria-describedby`, `aria-invalid`).
- A form-level `aria-live` summary.
- An inline success state that replaces the form ("Thanks, I reply within 2 business days"), plus "Send another".
- Honeypot + rate limit (S4). Validate the same zod schema on the server.
- A dark input style from tokens, character count on the message, and appropriate `autoComplete` hints.
- Alternative routes: email with copy, LinkedIn, and a booking link if wanted.
- The galaxy settles on the `home` view ("you are here").

---

## 6. Page transitions, loading and errors

**Today:**
- `PageTransitionProvider` renders a full-screen glitchy "LOADING" overlay with a 5-second timeout, but nothing in the app calls `startTransition`, so it's dead weight. It also loads a Google font just for that overlay.
- There are no `loading.tsx` or `error.tsx` boundaries.

**Plan:**
- Remove the overlay provider. Use the View Transitions API (Next 15 supports `unstable_ViewTransition` / CSS `view-transition-name`) for a 200ms cross-fade, falling back to a framer-motion fade. The galaxy camera flight carries the sense of travel.
- Add `loading.tsx` skeletons for `/projects` and `/projects/[slug]`.
- Add an `error.tsx` with a friendly message, retry, and home link.
- Add `global-error.tsx`.
- **404:** "Lost in space": the galaxy drifts to the halo, with a big "404" over the stars, search/links to Projects and Home, and a "Take me home" button that flies the camera to the Sun.

---

## 7. House viewer (`/house-viewer`)

**Today:**
- Hidden from the nav.
- A 1,143-line component with keyboard/pointer-lock/joystick controls and no onboarding.
- It sets `touch-action: none` on `body`.
- It uses `cannon` (with `cannon-es` installed but unused).

**Plan:**
- **Entry:** list it as a project with a "Launch 3D tour" button, with a short consent screen ("Uses WebGL, ~X MB").
- **Onboarding overlay:** controls for desktop (WASD + mouse, click to look) and touch (left joystick move, right drag look), with a "Don't show again" option.
- **Loading:** a real progress percentage from `GLTFLoader` `onProgress`, and a cancel/back button.
- **HUD:** model switcher, fullscreen, reset position, help (?), exit; all buttons at least 44px.
- **Quality:** reuse the galaxy's `detectDevice` tiers (shadow resolution, pixel ratio, HDRI size).
- **Fallbacks:** if WebGL is missing, show a screenshot gallery plus an explanation.
- **Code health:**
  - Split into `useThreeScene`, `usePhysics`, `useControls` and `HUD`.
  - Migrate to `cannon-es` (maintained).
  - Scope `touch-action: none` to the canvas, not `body`.

---

## 8. Accessibility (WCAG 2.2 AA)

- **Landmarks and headings:** `header` / `nav` / `main` / `footer` landmarks; one `h1` per page; logical heading order.
- **Focus:** visible focus everywhere (token `focus.ring`) and keyboard access to all interactions (no div `onClick`).
- **Alt text:** descriptive alt text for project screenshots (from Sanity alt fields).
- **Contrast:** text ≥ 4.5:1 over glass + galaxy (with the scrim from the galaxy plan §3); UI components ≥ 3:1.
- **Motion:** all framer-motion animations respect reduced motion; no autoplay without a pause control.
- **Targets:** at least 24×24 CSS px (44×44 on touch for primary actions).
- **Forms:** labels, errors, live regions (§5).
- **Testing:** `@axe-core/playwright` in CI on every route, plus a manual VoiceOver/NVDA pass per phase.

---

## 9. SEO, sharing and metadata

- **Per-page metadata:**
  - `metadata` / `generateMetadata` on each route.
  - `metadataBase`, canonical URLs, and a title template ("%s · Godliness Dongorere").
- **Sharing:**
  - Open Graph and Twitter images via `next/og`: a branded card with the galaxy and the page title, plus per-project images.
  - JSON-LD for `Person` (home) and `CreativeWork` / `SoftwareApplication` (case studies).
- **Crawling:** `app/sitemap.ts` (static pages plus project slugs from Sanity) and `app/robots.ts`.
- **App manifest:** check the manifest icons; `theme-color` should match `bg.canvas` (currently orange).

---

## 10. Performance

- **Budgets (mobile, Lighthouse):**

  | Metric | Budget |
  | --- | --- |
  | Performance score | ≥ 90 |
  | LCP | < 2.5s |
  | CLS | < 0.05 |
  | INP | < 200ms |
  | Initial JS | ≤ 200 KB gzipped (excluding the lazy galaxy chunk) |

- **Remove unused dependencies** (no imports found in `src/`): `cannon-es`, `html2canvas`, `jspdf`, `jspdf-autotable`, `bcryptjs`, `recharts`, `nipplejs`, `js-cookie`, `winston`. Verify the house viewer first, then prune.
- **Fonts:** `next/font` only, with `display: swap` and subset; preload the heading font.
- **Rendering:**
  - Convert static sections to Server Components, with client islands only for interactive parts.
  - Lazy-load the controls panel and project lightbox.
  - `next/image` everywhere.
- **Caching:** ISR with on-demand revalidation via a Sanity webhook (tag-based `revalidateTag`).

---

## 11. Engineering quality

- **ESLint:** re-enable the rules that were switched off globally (`no-unused-vars`, `no-explicit-any`, `prefer-const`) as warnings and fix them incrementally. Add `react-hooks/exhaustive-deps`.
- **Tests:**
  - Vitest + Testing Library for components (nav, form validation, filters).
  - Playwright for e2e smoke on every route, visual snapshots, axe checks, and the contact form against a mocked API.
- **CI** (GitHub Actions): install → lint → typecheck → unit → build (with mocked Sanity env) → Playwright. Required on PRs.
- **Content model:** Sanity schemas for `profile`, `experience`, `skill` and `project` (with alt text, LQIP, case-study fields), so content edits never need a deploy.
- **Error monitoring:** Vercel / Sentry for client errors and API failures.

---

## 12. Phased roadmap

| Phase | Scope | Size | Done when |
| --- | --- | --- | --- |
| A0 | **Security and correctness:** S1–S5, C1–C6 | S | Token rotated; contact GET/projects POST locked down; one profile source; lockfile clean; README real |
| A1 | **Design system:** semantic tokens, brand ramp, type scale, `GlassCard`/`Section`/buttons, CSS cleanup, focus ring | M | No hard-coded colours; axe shows no contrast or focus issues |
| A2 | **Navigation and layout:** new nav, mobile drawer, skip link, footer, `/stars` back control, page-transition removal, `error.tsx` / `loading.tsx` | M | Keyboard-only walkthrough passes on every page |
| A3 | **Home rebuild:** hero CTA, proof strip, featured grid, about, skills, timeline, contact band, scrollspy + galaxy waypoints | L | Lighthouse ≥ 90 mobile; usability check: "what does he do?" answered in 5 seconds |
| A4 | **Projects:** Sanity as the single source, filter/search, `/projects/[slug]` case studies, lightbox, `next/image`, OG per project | L | Every project shareable with a rich preview |
| A5 | **Contact:** validation, success state, honeypot/rate limit, dark inputs | S | Spam test blocked; screen reader announces errors |
| A6 | **404 "lost in space," SEO** (sitemap, robots, JSON-LD, OG images), manifest | S | Rich results test passes |
| A7 | **House viewer UX:** onboarding, progress, HUD, tiers, fallback, refactor, `cannon-es` | M | Playable on a budget phone with clear controls |
| A8 | **Quality:** lint rules back on, tests, CI, dependency prune, monitoring | M | CI green and required on PRs |

**Suggested order across both plans:** A0 → A1 → G1 + A2 → A3 + G2 → G3 → A4 → A5 → G4 → A6 → G5 → A7 → G6–G7 → A8 + G8. Security comes first; the design system comes before visual work; each galaxy phase lands next to the page work that uses it.

---

## 13. Open questions (recommended defaults)

| Question | Recommended default |
| --- | --- |
| Single source for projects | Sanity |
| Keep the house viewer public? | Yes, as a showcased project with a launch button |
| Light theme? | No; a dark-only site suits the galaxy. Revisit later. |
| Display font | Space Grotesk for headings, Inter for body |
| Contact backend | Keep Sanity storage + add email notification (Resend) so messages aren't missed |
| Résumé | One canonical PDF linked everywhere; remove the HTML drafts from `public/` |
