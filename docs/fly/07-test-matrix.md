# `/fly` — test matrix and quality gates

Companion to `docs/plan-fly.md` §17. What is tested, how, at which level, and the gate each phase must pass. **No test is skipped, loosened or quarantined to
reach green; fix the cause.** Unit tests are pure TypeScript (Vitest); e2e runs Playwright against a **production build** (`next build` + `next start`) with
`PW_CHROMIUM=/opt/pw-browsers/chromium` and software WebGL (SwiftShader), which is slow: e2e uses small viewports, the low pixel ratio the scene already picks on
software renderers, relative (not absolute) performance checks, and generous timeouts.

## 1. Unit tests by module

| Module | Property / case | Method | Tolerance |
|---|---|---|---|
| `units` | constants vs SI definitions | exact | exact |
| `bodies` | every numeric field is `Sourced` with `unit`, `source`, `reality`, `verified` | schema test over all bodies | exact (fails the build) |
| `bodies` | `GM/R² ≈ g` stated | table-driven | 1 % |
| `bodies` | derived `v_e`, `v_c`, `T`, SOI equal `docs/fly/01-physics-numbers.md` | table-driven | 0.5 % |
| `ephemeris` | planets match `lib/astro/planets.ts` | cross-check | 1e-9 AU |
| `ephemeris` | Galileans vs `JupiterMoons` API | cross-check | exact |
| `ephemeris` | mean-element moons reproduce their defining elements at epoch | analytic | 1e-6 relative |
| `frames` | round trips inertial↔fixed↔ENU | property test, 10⁴ random states | 1 µm, 1 nm/s |
| `frames` | Earth W matches GMST, Mars matches `marsOrientation` | cross-check | 0.01° |
| `gravity` | J2 nodal precession vs closed form | analytic | 5 % |
| `integrator` | circular orbit period; energy and angular-momentum drift | 10 orbits | period 0.1 %, drift 1e-9 |
| `patched` | SOI hand-off conserves heliocentric state | round trip | 1 mm, 1 µm/s |
| `modes` | tier caps, bubble cap curve monotone, auto-brake never overshoots | property tests | exact (inequalities) |
| `modes` | light tier path avoids every body; arrival = d/v | geometry test over random start/target pairs | one frame |
| `atmosphere` | `ρ` continuous, monotone (documented exceptions), `p(0)` = surface | per body | 1e-6 |
| `atmosphere` | scale heights reproduce exponentials | analytic | 1 % |
| `aero` | terminal velocity under constant ρ | `√(2βg/ρ)` | 1 % |
| `aero` | stability: restoring moment sign across α | table check | exact |
| `thermal` | Sutton–Graves hand calc; equilibrium temperature | analytic | 1 % |
| `thermal` | calibration vs published capsule/Shuttle order of magnitude | reference table | within 2× |
| `wind` | determinism (seed, date, place); mean/variance vs config | statistics over 10⁵ samples | 5 % |
| `contact` | rest on slope; energy dissipation; no tunnelling at 20 m/s | scenarios | exact/threshold |
| `ship` | rocket equation Δv; thrust-to-weight per world | analytic | 0.5 % |
| `terrain` | determinism (byte-identical tiles); seam match; height ranges per world | property tests | 1 mm seam |
| `terrain` | LOD error monotone; levels formula | analytic | exact |
| `sky` | LUT energy conservation (transmittance ≤ 1); colour class per world | numeric + pixel classes | classes |
| `input` | dead zones, expo, remap persistence (guarded storage), non-finite rejection | unit | exact |
| `state` | save/load validation rejects NaN/Infinity/huge values; storage blocked path | unit | exact |
| `audio` | graph builds without errors; vacuum preset silent except structure-borne | node-graph inspection | exact |

## 2. Integration and e2e (Playwright)

| Flow | Assertions | Notes |
|---|---|---|
| Boot | `/fly` loads, ship visible, tier dial present, no console errors, no hydration warnings | desktop + Pixel 7 |
| Keyboard flight | `W` accelerates, `1–6` switch tiers, caption "Slowing for …" near a body | scripted waits |
| Orbit → Moon landing (auto-land) | "Landed" within the time limit | scripted assists |
| Mars entry survives with shield | peak hull temperature < limit; "Landed" | seeded wind |
| Venus over-depth recall | recall card shows cause and numbers | scripted dive |
| Jupiter radiation recall | meter climbs; recall at the limit | seeded date |
| Hide-interface, pause, photo mode | HUD hidden/shown; capture file named `fly-<body>-<date>.png` | download event |
| Reduced motion | no shake/streaks; sequences step-by-step | `emulateMedia` |
| Gamepad | mocked Gamepad API drives throttle/pitch | injected |
| Touch | virtual sticks respond; targets ≥ 44 px | Pixel 7 profile |
| Fallback | WebGL disabled → friendly message and link to `/stars` | init script |
| Share link | coarse state restores on load; invalid state ignored | URL params |
| A11y | axe on HUD, menus, reality panel, pause menu | `@axe-core/playwright` |
| Perf smoke | frame time relative to a baseline run on the same machine; memory growth < 15 % over 60 s | not absolute fps |

## 3. Visual regression (curated)

Screenshots of: Earth orbit (day and night), Moon pad, Mars sky at noon and sunset, Venus deck, Jupiter bands with GRS, Saturn rings from the ring plane, Titan
haze, Io plume, Neptune limb, ship chase and cockpit views, reentry glow, HUD at 360/412/1280 px. Compared with a pixel tolerance; updated **only deliberately** with a note
on what changed. Stored under `e2e/__screenshots__/` with a size budget.

## 4. Manual checklist (needs real hardware; Gee)

- Control feel: mouse, keyboard, gamepad, touch; throttle response; assist behaviour.
- Motion comfort at each tier; comfort settings effective.
- Scale: does the ship read as large next to a landing site; do planets read as true-scale?
- Thermals/battery on a phone over 10 minutes; load times on a mid-range device.
- Loudness and audio balance; captions; limiter.
- Whether each world feels distinct (blind test with screenshots).

## 5. Quality gates by phase

| Gate | Requirement |
|---|---|
| Every commit | `npx tsc --noEmit` clean; `npx vitest run` green; `npx eslint src` 0 errors |
| End of each phase | all above + `next build` (Sanity env unset) + the phase's e2e subset on a production build |
| Before PR | full Playwright desktop + mobile; bundle check (`/fly` chunk isolated; `/stars` and `/` within 2 %); docs updated |
| Data | no numeric field without `source`; unverified values visibly badged |
| Security | no new network fetches except same-origin static assets; URL/state inputs validated (finite, clamped); no `dangerouslySetInnerHTML`; no secrets in the client |
| Licensing | every external asset has a recorded licence in `docs/fly/credits.md` |

## 6. Flake policy

A failing test is a real failure until proven otherwise. Re-run at most once, and only for a failure that died before any assertion ran (browser launch, install). A second failure
is real. Timing-sensitive e2e uses event/`expect` polling, never fixed sleeps as the assertion.
