# `/fly` — ticket-level roadmap

Companion to `docs/plan-fly.md` §16. Each phase is broken into **tickets** with an id, scope, dependencies, acceptance criteria and the test that
proves it. Sizes: **S** ≈ ½–1 day, **M** 1–3 days, **L** 3–7 days, **XL** 1–3 weeks (focused sessions). Order matters: finish and push each phase
(unit tests, `tsc`, `eslint src`, build) before the next. **Never skip or weaken a test to go green.**

Dependency graph (arrows = "needs"):

```
F0 ─► F1 ─► F2 ─► F3 ─► F5 ─► F6 ─► F7 ─► F8
            │      │      │            ▲
            │      └─► F4 ┘            │
            └──────────────────────────┤
F9 (controls/HUD) needs F3 (+ F5/F6 for assists); F10 (audio) needs F3+F5; F11 needs F7–F10; F12 last.
```

---

## F0 — Orientation and skeleton (S)

| Id | Ticket | Acceptance | Test |
|---|---|---|---|
| F0.1 | Read the prior art: `docs/time-machine.md`, `docs/plan-solar-system-zoom.md`, `src/lib/solar/*`, `src/lib/astro/*`, `System3D.tsx` | notes in `docs/fly/verification.md` header listing reused modules | — |
| F0.2 | `/fly` route (server page + `dynamic` client app, `ssr:false`), metadata, canonical, sitemap entry, OG image | `/fly` returns 200, appears in sitemap, OG renders | smoke e2e, build |
| F0.3 | Feature flag `NEXT_PUBLIC_FLY=1` (default **on** in dev, **off** in production until F9) | route 404s when off | unit + e2e |
| F0.4 | Shell page: full-screen canvas reusing `SolarScene` (true scale, markers), hide-interface key, back link | page shows the Solar System; no console errors | e2e |
| F0.5 | Docs skeleton `docs/fly/{bodies,verification,credits}.md` | files exist, linked from the master plan | lint for links |

**Phase gate:** build green; `/stars` bundle size unchanged (check with `next build` output).

## F1 — Data layer (M)

| Id | Ticket | Acceptance | Test |
|---|---|---|---|
| F1.1 | `units.ts` (c, AU, G, R_u, conversions) | constants match SI definitions | unit |
| F1.2 | `bodies.ts` schema (§1 of `02`) and **all** §8.1 bodies entered as `verified:false` with `source` strings | every numeric field is `Sourced` | unit: schema test fails if any field lacks `source` |
| F1.3 | Derived values module (`g`, `v_e`, `v_c`, SOI) | match `01-physics-numbers.md` §1 within 0.5 % | unit (table-driven) |
| F1.4 | Doc generator `scripts/gen-bodies-doc.mjs` → `docs/fly/bodies.md` | idempotent output, lists unverified fields | CI check (no diff after run) |
| F1.5 | Reality panel component (list measured/derived/artistic/unverified) | renders from data, a11y clean | component + axe |

## F2 — Ephemeris and frames (M)

| Id | Ticket | Acceptance | Test |
|---|---|---|---|
| F2.1 | Wrap astronomy-engine for planets/Moon/Pluto/Sun; add `JupiterMoons()` | positions equal existing `planetStates`/`moonState` within 1e-9 AU | unit |
| F2.2 | Mean-element models for the missing moons (Mars's two, Saturn's major, Uranus's major, Triton, Charon) + Ceres/Vesta Kepler | each within a stated tolerance of its mean-element definition at epoch; labelled `approximate` | unit + snapshot of positions at 3 dates |
| F2.3 | IAU rotation models (pole, W0, rate) for all bodies | Earth W matches GMST; Mars matches `marsOrientation` | unit |
| F2.4 | `frames.ts` with all transforms | round-trip < 1 µm / 1 nm/s (property tests, 10⁴ random states) | property test |
| F2.5 | `ephemeris.ts` interpolation layer (sample at 1 s, interpolate between) | error < 1 km for planets over a 60 s window; < 1 mm for the local body | unit |

## F3 — Flight model in vacuum (L)

| Id | Ticket | Acceptance | Test |
|---|---|---|---|
| F3.1 | 6-DOF state + integrator (Verlet/RK4, adaptive step) | LEO period within 0.1 % of analytic; energy drift < 1e-9/orbit | unit |
| F3.2 | `gravity.ts` point mass + J2 + third-body | J2 nodal precession of a sun-sync-like orbit within 5 % of formula | unit |
| F3.3 | SOI hand-off (`patched.ts`) | Earth→Sun→Earth round trip error < 1 mm, 1 µm/s | unit |
| F3.4 | Thrusters, RCS, fuel, throttle spool | Δv from rocket equation within 0.5 % | unit |
| F3.5 | Speed tiers 3–6, auto-brake, light-tier chord with exclusion bend | no path intersects any body; arrival time within one frame of `d/v` | unit + property test |
| F3.6 | Render: ship placeholder, chase camera, nav sphere, minimal HUD, floating-origin camera for the sim state | no visible jitter at 1 AU, 1 mm local motion | e2e screenshot diff |
| F3.7 | Patched-conic **prediction** line (ellipse/hyperbola) from the numerical state | predicted apoapsis within 1 % after a burn | unit |

## F4 — The Wayfarer (L)

| Id | Ticket | Acceptance | Test |
|---|---|---|---|
| F4.1 | Parametric hull builder (lofted sections, chamfers, greebles by seeded rules) | LOD0 ≤ 200 k triangles, ≤ 60 draw calls | unit (counts) |
| F4.2 | Procedural PBR textures (panels, soot, rust, hazard, emissive windows) | texture memory ≤ 48 MB | unit |
| F4.3 | LODs + impostor (LOD1 30 k, LOD2 3 k, impostor beyond 2 km) | switch distances by angular size, no pop > 2 px | e2e screenshots |
| F4.4 | Lights, running lights, landing-light cones, radar dish animation | toggles; flicker-free | visual |
| F4.5 | Plume VFX per thruster (pressure-dependent shape) | vacuum plume wider than sea-level | unit (plume parameters) + visual |
| F4.6 | Hull state shader (heat glow, soot accrual, damage decals) | driven by `thermal.ts` | unit + visual |
| F4.7 | Cockpit view and bridge frame | camera cycle works; no clipping | e2e |
| F4.8 | Optional glTF import path with validation + licence check | rejects models lacking a licence file or over budget | unit |

## F5 — Atmospheres and flight in air (L)

| Id | Ticket | Acceptance | Test |
|---|---|---|---|
| F5.1 | `atmosphere.ts` (Earth/Mars first) with LUT tables | `ρ(0)`, scale heights match `bodies.ts`; monotone | unit |
| F5.2 | `aero.ts` forces and moments, ballistic coefficient tuning | terminal velocities equal `01` §3 table within 1 % | unit |
| F5.3 | `thermal.ts` (Sutton–Graves, wall temp, ablation) | order-of-magnitude calibration against published capsule/Shuttle values (target within 2×) | unit |
| F5.4 | Sky scattering LUTs (Earth, Mars) and sun/sky render | Earth blue/orange sunset, Mars butterscotch/blue sunset | visual + colour-class test on sampled pixels |
| F5.5 | Hover tier 1 and atmospheric tier 2 with buffet + wind v1 | stable trim in still air; gust response measurable | unit |
| F5.6 | Reentry VFX (plasma glow, streaks) | glow intensity tracks `q̇` | unit + visual |
| F5.7 | Warnings (max-Q, g, heat) and recall card | triggers at 100 %, recall > 120 % | unit + e2e |

## F6 — Terrain and landing (XL)

| Id | Ticket | Acceptance | Test |
|---|---|---|---|
| F6.1 | Cube-sphere quadtree + screen-space error + geomorphing + skirts | no cracks; split/merge hysteresis; ≤ 1.0 ms main-thread scheduling | unit + visual |
| F6.2 | Tile workers + LRU with byte budgets | memory stays under tier budget in a 60 s stress run | e2e perf smoke |
| F6.3 | Height function for Moon and Mars (fractal + craters + stamps for named landmarks) | deterministic, seam-exact (< 1 mm) | unit |
| F6.4 | Surface materials/biomes (Moon, Mars) with tri-planar + micro-detail normals | no stretching on slopes; colour classes pass | visual |
| F6.5 | Contact model (legs, friction, sleep) — custom first | rest on 8° slope; stable 5 min without drift | unit |
| F6.6 | Optional Rapier local-world path behind a flag | same acceptance as F6.5 | unit parity test |
| F6.7 | Dust/plume interaction (ballistic vs billowing by ambient pressure) | visual mode matches pressure | unit (mode select) + visual |
| F6.8 | Landing classification + auto-land with terrain scan | lands on a ≤ 8° slope with ≤ 3 m/s vertical | e2e scripted |
| F6.9 | Real-coordinate pads: Tranquility, Jezero | pad coordinates correct to 1 km ⚠ verify | unit (data) |

## F7 — All worlds, v1 environments (XL; ship world by world)

Each world is a self-contained ticket set **7.W.1 data → 7.W.2 atmosphere/sky → 7.W.3 wind/turbulence → 7.W.4 surface/deck → 7.W.5 hazards → 7.W.6 reality panel → 7.W.7 tests**.

Order: **Venus → Mercury → Jupiter (+Io, Europa, Ganymede, Callisto) → Saturn (+rings) → Titan → Enceladus → Uranus (+Miranda) → Neptune (+Triton) → Pluto/Charon → Ceres/Vesta → small bodies.**

Acceptance per world: the dossier's "Approach → Verify" checklist from `03-world-dossiers.md` is satisfied; a screenshot set (orbit, mid-altitude, near-surface) is reviewed by Gee; the hazard recall works and explains itself.

## F8 — Clouds, weather and spectacle (L)

| Id | Ticket | Acceptance | Test |
|---|---|---|---|
| F8.1 | Raymarched cloud volumes with TAA (Earth, Mars) | ≤ 3 ms on `high`; no flicker | perf smoke |
| F8.2 | Gas-giant flow-mapped decks + storm volumes | band motion follows the jet profile | unit (advection) |
| F8.3 | Dust storms tied to `mars.ts` dates | opacity matches `dustLevel(jd)` | unit |
| F8.4 | Lightning (rate/amplitude cap), auroras | ≤ 3 flashes/s default; photosensitivity toggle | unit |
| F8.5 | Eclipses, ring shadows, planet-shine | analytic cones match geometry | unit |
| F8.6 | Eye adaptation, lens flare, film grain | toggles; reduced-motion disables lag | visual |

## F9 — Controls, HUD, map, autopilot (L)

| Id | Ticket | Acceptance | Test |
|---|---|---|---|
| F9.1 | Input layer (keyboard/mouse/gamepad/touch) + remapping + dead zones | all actions reachable per device; remap persists (guarded storage) | unit + e2e |
| F9.2 | Flight HUD and context HUD per `05-ui-hud-spec.md` | layout matches spec at 360 px, 412 px, 1280 px | visual + axe |
| F9.3 | Map view with prediction and `Go to…` autopilot | arrival within 1 s of the plan | e2e |
| F9.4 | Assists: attitude, prograde/retro, hover, auto-orbit, auto-land | each unit-tested on a reference scenario | unit |
| F9.5 | Photo mode (freeze, free-cam, hide HUD, capture the 3D canvas) | file named `fly-<body>-<date>.png` | e2e download |
| F9.6 | Tutorial + practice course | completes in < 3 min; skippable; replayable | e2e |
| F9.7 | Accessibility pass (keyboard-only, screen-reader live regions, reduced motion, comfort, photosensitivity) | axe clean; manual checklist | e2e + manual |

## F10 — Audio (M)

| Id | Ticket | Acceptance | Test |
|---|---|---|---|
| F10.1 | WebAudio graph: engines, wind, reentry, surface, cabin; master limiter | peak < −1 dBFS; no clicks on param change | unit (graph build) + manual |
| F10.2 | Per-world audio presets by ambient density | vacuum silent except structure-borne | unit |
| F10.3 | Opt-in toggle + captions + "reduce loud sounds" | off by default; remembered | e2e |

## F11 — Polish, performance, reality (L)

| Id | Ticket | Acceptance | Test |
|---|---|---|---|
| F11.1 | Quality tiers wired to the governor + `?q=` override | tiers differ in terrain/cloud/shadow detail; fallback to `/stars` on failure | e2e |
| F11.2 | Memory/streaming budgets and load-time tuning | first paint < 3 s on a mid laptop; progressive load | perf smoke |
| F11.3 | Save/load + share link (coarse) | invalid/non-finite input rejected | unit |
| F11.4 | Missions and named sites (§14) | each completes without dead ends | e2e scripted |
| F11.5 | Reality panel complete for every body; `verification.md` current | no `verified:false` without a visible badge | unit |
| F11.6 | SEO, OG, sitemap, header link, `/stars` Fly button | links present | e2e |

## F12 — Release (S)

Checklist: `npx tsc --noEmit`, `npx eslint src`, `npx vitest run`, `next build` (Sanity env unset), Playwright **desktop + mobile** against a production build,
bundle budgets (`/fly` chunk isolated; `/stars` and `/` unchanged within 2 %), `docs/fly/*` and `CHANGELOG.md` updated, then **ask Gee** whether to open a PR.

---

## Ship-roster tickets

The single-ship tickets above (F3.6, F4.*, F6.8, F9.*) are generalised to three hulls by the **S-series** tickets in `docs/fly/11-ship-roster.md` §7 (ShipSpec data, VesselManager, Kestrel and Meridian models, landing rules per ship, hangar select, launch/dock/switch, HUD variants). **Build order: Kestrel → Wayfarer → Meridian**; first playable milestone = *Kestrel: orbit → Moon landing*.

## Parallelisation notes

- F4 (ship) and F5 (atmospheres) can run in parallel after F3 if two sessions work on separate files (`ship/*` vs `atmosphere|aero|thermal|sky/*`).
- F7 worlds are independent after F5/F6 land: each is a sub-branch of work touching `bodies.ts` data plus one dossier-sized set of effects.
- F9 UI can start after F3 with mocked flight data and be wired as phases land.
- Keep **one owner per file group** to avoid merge conflicts: `lib/fly/render/*`, `lib/fly/terrain/*`, `lib/fly/sky/*`, `components/fly/*`, `lib/fly/audio/*`.
