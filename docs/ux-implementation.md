# UI/UX implementation status

This records what shipped from [`plan-app-ux.md`](plan-app-ux.md) and [`plan-galaxy-ux.md`](plan-galaxy-ux.md), what was verified and how, and what is deliberately left for later.

## Shipped

### Security and correctness (plan A0)
- The Sanity **write client is server-only** (`src/lib/sanity.server.ts`, `import 'server-only'`) and created lazily, so importing it never fails a build that has no CMS variables. The token is read from `SANITY_API_WRITE_TOKEN`; the old `NEXT_PUBLIC_` name still works server-side with a warning until it is renamed. **The token must still be rotated in Sanity**, because it has lived under a public name.
- `GET /api/contact` (which listed every message), `PUT /api/contact` and `POST /api/projects` are gone. `POST /api/contact` validates with one shared schema, is rate-limited (best-effort, per server instance) and has a honeypot.
- Next.js moved from 15.3.6 to 15.5.27, the lockfile is in sync (`npm ci` works), and nine unused packages were removed.
- One source for personal details (`src/data/profile.ts`): GitHub `geehyness`, email `godlinessdongorere@gmail.com`. The footer previously used different handles. **Please confirm these are the right ones.**
- Private drafts (cover letter, résumé HTML variants, a stray DeepSeek export) moved from `public/` to `docs/archive/`, so they are no longer served.
- A real README and `.env.example`.

### Design system, navigation and pages (A1–A6)
- Semantic tokens (dark-only), an orange `brand` ramp, a fluid type scale, Space Grotesk + Inter through `next/font`, one visible focus style, dark inputs/modals/drawers, and `GlassCard` / `Section` / link components.
- Navigation: active-page state, skip link, focus moved to the new page after navigation, a mobile drawer (focus trap, Esc, closes on route change), Contact and Résumé links, a real footer.
- Home rebuilt (hero with calls to action, proof strip, featured work, About, linked skills, experience timeline, contact band). Projects: search, category, technology filters and sorting, kept in the URL. A case-study page per project with a gallery lightbox, copyable demo credentials and previous/next links. Contact form with inline validation, announced errors and a success state. "Lost in space" 404, `error.tsx`, `global-error.tsx`, `loading.tsx`.
- SEO: per-page metadata, sitemap, robots, JSON-LD, and share cards (site and per project).

### Galaxy experience (G1–G5)
- Sections declare a camera waypoint (`<Section view="…">`); the camera flies between them, holds each view while its section is centred, and keeps flying across route changes. Eight named views; roll is per-view (a full turn only between `edge-on` and `home`), halved on phones and removed under reduced motion.
- Reading dim, text scrims, and a "Dim while reading" setting.
- Controls 2.0: presets (Cinematic, Scientific, Calm, Battery saver, Custom), saved settings, per-section reset with undo, a bottom sheet on phones, a `G` shortcut, a first-visit hint, a status pill with a "Why?" explanation, and a "Try higher quality" benchmark.
- Explore mode (`/stars`): orbit, pan, zoom (mouse, touch, keyboard), 11 named places with fact cards and a "why it looks like this" note, collision-free labels, mini-map, scale bar, time controls with an elapsed-time readout, a 7-step guided tour, shareable view links and image capture. Press `?` for the shortcuts.

### House viewer (A7)
- Intro screen with controls and a download-size notice (skippable), real loading progress, a WebGL fallback, a HUD (exit, help, fullscreen), 56px touch controls, adaptive pixel ratio and antialiasing, the galaxy pauses while it is open, `cannon` → `cannon-es`, and `touch-action: none` scoped to the viewer instead of `body`.

### Quality (A8)
- 33 unit tests (generator determinism and the "lower tiers are subsets" property, governor hysteresis, camera continuity, explore maths, filters, validation).
- 29 browser tests (smoke, **axe WCAG 2.2 AA scans of five pages**, contact form, project filtering, explore mode, mobile menu). The axe scans caught and fixed invalid list markup and a colour-only link.
- CI (`.github/workflows/ci.yml`): lint, typecheck, unit tests, a **build with no CMS credentials**, and the browser tests.
- Lint rules that were switched off are back as warnings (39 left, mostly `any` in the legacy house-viewer file).

## Deliberately not done (and why)
- **Fidelity upgrades (HDR + tone mapping, bloom, lensing, motion blur, background galaxies).** These need a real GPU to tune and judge; software rendering here can't show them faithfully. They remain in the plan.
- **Content-exclusion mask in the shader** and **generation streaming by layer.** Replaced for now by CSS scrims and the existing worker.
- **Sanity as the project source.** Content stays in `src/data/projectsData.ts` (already complete); migrating it needs CMS access.
- **Splitting `App.tsx` into hooks.** The viewer's UI layer was rebuilt, but its 1,100-line scene logic is untouched to avoid regressions; its `any` warnings remain.
- **View Transitions API, sheet snap points, privacy-safe telemetry, Lighthouse budgets.** Not measured here; run Lighthouse on a deployed build before trusting any performance number.
- Visual checks were done in software-rendered Chromium at the Low/Minimal/Medium tiers. Ultra on real hardware has not been seen.
