# Time machine — continuation plan (for a new session)

Persona/constraints: address the user as **Gee**, speak like Jarvis, be honest about what was and wasn't verified.
Branch: `ccr-da26c508-iddj0b` (push only here). **Do not open a PR unless Gee asks.** GitHub scope: `gee-highness/gmd` only.
Sandbox: only the npm registry is reachable (no NASA/Wikimedia/journals/third-party repos). Browser: set
`PW_CHROMIUM=/opt/pw-browsers/chromium` for Playwright; dev server `npx next dev -p 3217`.
Never `pkill -f "next dev"` (kills your own shell); use `pgrep -f "[n]ext dev -p PORT"`.

## 1. Where things stand (commit 4f83d6c, pushed)

Gee's request: verify the Sun's place in the Milky Way ("accurate to the dot", visible when zoomed in); UTC + local
time with fullscreen; everything accurate to the real time at load; travel forward/back (Mars storms, ice age).

**Built** (see `docs/time-machine.md` for sources and accuracy table):
- `src/lib/astro/`: `julian` (calendar/JD any year), `time` (ΔT, GMST, local clock/LMT), `earth` (obliquity, Sun,
  sub-solar point), `galaxySun` (cited constants), `mars` (Ls, dated storm catalogue, dust), `marsMap`, `climate`
  (sea level → ice edges, `iceCover`), `globe` (projection, Mars orientation), `render` (per-pixel globe),
  `planets` (astronomy-engine wrapper), `accuracy` (per-moment honesty report), `clock` (SimClock, rates, epoch labels).
- UI: `components/solar/` — `TimePanel` (UTC + local, fullscreen, transport, Time machine dialog), `SolarView`
  overlay (tabs: Orrery, Earth, Mars, Sun in the Galaxy), `GlobeCanvas`, `EarthView`, `MarsView`, `Orrery`, `SunInGalaxy`.
  Wired into `ExploreMode` (O key / Sun button / Sun card / scroll-in hand-off, `?t=` share param, real-time boot).
- Engine: `ExploreState.galacticYears` drives galaxy rotation (`SUN_ORBIT_MYR` ≈ 203 Myr); constants updated
  (R0 8.178 kpc, z 20.8 pc, Θ0 236, bar 39 / arm 28 km/s/kpc).
- Land asset: `public/solar/land.json` from `scripts/build-land.mjs` (Natural Earth 110m via `world-atlas`, antimeridian-unwrapped).
- Tests: 76 unit (Vitest), 11 e2e passing (time-machine + explore specs, incl. axe). Build and lint (0 errors) OK.

## 2. Known gaps (honest list)

1. Galactic constants entered from memory — **unverified** against papers.
2. "Zoom to see the Sun" is a 2D overlay hand-off, not a continuous 3D descent.
3. Mars surface is hand-placed blobs; Earth coastlines are 1:110m and today's at every date; ice sheets schematic.
4. No Moon view/orbit; planets are dots; planets illustrative beyond ~±6,000 yr.
5. Not run: full e2e suite, mobile project, PR #4's two Stars-link tests, real fullscreen entry, `/code-review`,
   post-wrap mobile toolbar check, low-end performance measurement.
6. Mars storm onsets (Mars Year/Ls) and ice-age anchor points are from memory.

## 3. Phases (do in order; commit + push after each; keep tests green)

### P0 — Orientation (10 min)
`git log --oneline -8`, read `docs/time-machine.md`, this file, `src/components/galaxy/explore/ExploreMode.tsx`,
`src/components/solar/*`. Start dev server, confirm `/stars` loads, `npx vitest run`, `npx tsc --noEmit`.

### P1 — Verification and hardening (highest value)
- Re-derive/verify every constant in `galaxySun.ts`, storm catalogue in `mars.ts`, sea-level anchors in `climate.ts`.
  If sources can't be fetched, mark each value in the UI as "unverified" or keep the doc's verify-list and ask Gee
  to confirm. Never claim more than was checked.
- Run the **full** e2e suite desktop + mobile (`PW_CHROMIUM=... BASE_URL=http://localhost:3217 npx playwright test`),
  including `smoke`, `a11y`, `projects`, `contact`, and the two PR #4 Stars-link tests. Fix failures.
- Mobile (Pixel 7, 412px): re-screenshot `/stars` + solar overlay after the toolbar-wrap change; ensure no overlap
  between TimePanel, GalaxyControls FAB and cards; no horizontal overflow.
- Fullscreen: test `requestFullscreen` in Chromium headless (may need user-gesture click); consider making the clock
  itself fullscreen-able ("big clock" mode) if Gee wants it; iOS Safari hides the button.
- Run `/code-review` high on the diff `f48972e..HEAD`; fix real findings. Run `/security-review` (fetch of
  `/solar/land.json`, URL params `?t=` clamped and validated — confirm NaN/huge values can't break the clock).
- Add unit tests: `describeEpoch` boundaries, `localClock` (civil vs mean-solar), `?t=` parsing, SimClock clamping,
  `sunHeightPc` continuity, Orrery/Globe pure helpers. Performance: measure globe redraw cost (target < 6 ms/frame
  at 360², throttle to 15 fps when `document.hidden` or tab not visible, pause when overlay closed — already unmounted).

### P2 — Accuracy upgrades
- Sun/Earth: swap `sunPosition` to astronomy-engine within 1800–2200 (keep Meeus fallback for deep time); add nutation
  and refraction-free solar elevation display; equation of time shown on Earth card.
- Moon: add Moon to Earth view (phase disc + orbit inset) and the orrery (Earth–Moon inset); eclipse proximity flag.
- Mars: replace hand-placed blobs by a baked low-res albedo map **only if** a legitimately fetchable public-domain
  dataset exists via npm (check first; otherwise keep schematic and say so). Verify storm onset Ls/Mars Year.
- Ice ages: draw exposed continental shelf using a baked coarse bathymetry (only if available via npm, e.g. a
  GEBCO-derived package); otherwise annotate. Add Milankovitch panel (obliquity, eccentricity, precession from the
  Laskar series already used for tilt) so the ice-age link is explained.
- Planets: label orbital periods, add toggles (orbits/labels), click-to-focus.
- Galaxy: show Sun's galactic position marker with live uncertainty ellipse in the 3D view; arm-drift uncertainty fan.

### P3 — Real 3D descent ("zoom to see the Sun")
Follow `docs/plan-solar-system-zoom.md` (scale ladder, float64 camera-relative rendering, log depth) as amended by
its 'Update: time machine' section:
1. `src/lib/solar/engine.ts` (lazy three.js scene): Sun, 8 planets, Earth–Moon, orbit lines from `planetStates`,
   camera-relative float64, log depth buffer, labels.
2. Continuous camera ladder: galaxy → local bubble → Sun (~1 ly) → system → Earth; crossfade galaxy points
   `nearFade` already supports close range; extend `MIN_LOG` in `lib/galaxy/explore.ts` and reuse the SolarView
   tabs as the "info" layer rather than the full-screen cover.
3. "Take me home" button (descent from galaxy to the viewer's Earth) and reverse ("Back to the galaxy").
4. Mobile/low-end: tier-gate the solar scene; fall back to current 2D overlay.
5. Tests: unit for scale ladder math; e2e that scroll-in over the Sun reaches the system view; screenshots.

### P4 — Product polish
- Time UI: keyboard shortcuts (`,`/`.` step, `[`/`]` speed, `N` now, `J` jump), URL-synced time (`?t=`) with
  copy-link includes time (done) + restore on load tests, "bookmarks" (localStorage) of dates.
- Narrative: guided "time-travel tour" (today → 2018 Mars storm → LGM → 66 Mya → one galactic year ago).
- Content: update site copy/SEO for `/stars` (title/description mention time machine), add OG image, add to sitemap.
- Docs: keep `docs/time-machine.md` accurate; add CHANGELOG entry.

### P5 — Release
Full CI-equivalent locally: `npx tsc --noEmit`, `npx eslint src`, `npx vitest run`, `next build` with
Sanity vars unset, Playwright desktop + mobile. Commit, push. **Ask Gee whether to open a PR** (use repo PR template
if present; end PR body with the Claude Code attribution line). Then offer to subscribe to PR activity.

## 4. Definition of done
- Every number the UI shows has a source or is labelled schematic/unverified.
- All unit + e2e (desktop + mobile) green; build and lint clean; no hydration/console errors on `/stars`.
- Gee can: load at the real time, see UTC + local clocks and go fullscreen, jump to any date, watch Mars dust storms
  and the ice age, and zoom from the galaxy to the Sun without a hard cut.

## 5. Pitfalls learned (don't repeat)
- Hydration: anything time-dependent in SSR'd components must render only after mount (TimePanel does; incl. the
  visually-hidden status text and fullscreen support detection).
- Chakra `transition` prop collides with framer-motion; use a plain `motion.section` wrapper.
- `smoothstep(a,b,x)` with reversed edges inverts the result — ice logic now lives in `climate.iceCover` with tests.
- Antimeridian rings must be unwrapped and drawn at ±360° offsets (see `build-land.mjs`, `EarthView`).
- Playwright needs `PW_CHROMIUM=/opt/pw-browsers/chromium` here (headless-shell build isn't installed).
- Toolbar on 412px width overflows if more buttons are added — keep it wrapping.
