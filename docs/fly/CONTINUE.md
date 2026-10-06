# `/fly` — continuation note (read this first in a new session)

Written so a fresh session can say **"continue fly"** and pick up without re-deriving anything. Keep it current: update the status table whenever a phase moves.

## Persona and rules
- Address the user as **Gee** and talk like Jarvis; be honest about what was and was not verified. Never claim more than was checked.
- Branch: `ccr-da26c508-iddj0b` (push only here). **PR #6** is open for it (`gee-highness/gmd`); do **not** open another unless Gee asks. If #6 gets merged, restart the branch from `origin/main` and keep any unmerged commits.
- Sandbox: only the npm registry is reachable (no NASA/Wikimedia/journals/model sites). Playwright needs `PW_CHROMIUM=/opt/pw-browsers/chromium`. Run e2e against a **production build** (`next build` then `next start -p 3217`, Sanity env unset: `env -u NEXT_PUBLIC_SANITY_PROJECT_ID -u SANITY_API_READ_TOKEN`).
- Never `pkill -f "next dev"` or `pgrep -f "next-server"` without brackets: it matches your own shell. Use `pgrep -f "[n]ext-server"` and kill by pid.
- Software GL (SwiftShader) is slow: e2e must wait on state (poll/`expect`), not fixed sleeps; hold keys until the page reacts.
- Never skip/weaken a test to get green. Commit and push after each unit of work (a stop hook insists on a clean tree). Commits end with the attribution lines the harness gives.

## What Gee asked for (the product)
`/fly`: fly a ship through the **real Solar System** at **true scale and real positions**, with speed tiers up to many times light speed, landings with physical, realistic environments; ships to choose from: **big** (Mass Effect Andromeda-style expedition ship) or **small** (Oblivion-style bubble craft); **first- and third-person views**; **everything feels real and physical**; **DualShock 4 works on any device**; **only what is near and needed is loaded**. Ships are **original designs** (language only, no copying).

## The plan (all committed)
`docs/plan-fly.md` (master) + `docs/fly/01…12`: physics numbers, schemas and algorithms, world dossiers, ticket roadmap F0–F12, HUD spec, ship spec, test matrix, glossary/verification log, **09 physicality charter (binding)**, 10 controller support, 11 ship roster, **12 streaming/loading (binding)**. Every planetary number in the docs is **from memory and unverified** (⚠); keep `verified:false` until `docs/fly/verification.md` says otherwise.

## What exists in code (all tested; none of it verified on a real GPU, phone or physical DS4)

| Area | Where | Status |
|---|---|---|
| `/stars` Milky Way + time machine + 3D Solar System + Take me home + HUD | `src/components/galaxy`, `solar`, `lib/astro`, `lib/solar` | done, merged via PR #5 (plus follow-ups in #6) |
| Universal gamepad layer (DS4 standard/raw profiles, learned mapping wizard, rumble), `/controller` page | `src/lib/input`, `components/input`, `app/controller` | done, mocked-pad tests only |
| Kestrel ship data + derived performance | `src/lib/fly/ships/specs.ts` | done (Δv 14.9 km/s, TWR 2.64 Earth) |
| Kestrel procedural model (dragonfly-style: glass bubble + ring frame, white engine sphere, spine, tail turbine, wing blades, 4 legs) | `src/lib/fly/ship/{kestrel,loft}.ts` | done, 27 k tris |
| Hangar viewer | `components/fly/Hangar.tsx` | done |
| Flight sim (gravity, drag, propellant mass flow, hover/level assists, touchdown classes) | `src/lib/fly/sim/{flight,terrain}.ts` | done, simplified arena sim |
| Camera rig: first person (pilot eye, head lean) + third person (chase spring), blended | `src/lib/fly/camera.ts` | done |
| Flight arena (keyboard + DS4, HUD, V/1/3 views, G gear, H assist, R reset, I hide) | `components/fly/FlightArena.tsx`, `FlyApp.tsx`, route `/fly` (`?mode=arena`) | done |
| Meridian (big ship), Wayfarer, mothership launch/dock | — | **not started** |
| Real worlds (Moon, Mars…), atmospheres, terrain streaming, heating, audio | — | **not started** |
| Streaming foundation L0: `ResourceTracker`, byte `Budget`, pressure levels, tier table, `trackObject` for three.js scenes (Hangar and Arena now dispose through it) | `src/lib/fly/stream/{types,budget,resource,three}.ts` | done, 12 unit tests incl. leak test; `npm run check:bundle` enforces `/fly` first load ≤ 350 KB gz (now 139 KB by that script; Next reports 262 KB) |
| Residency manager, scheduler, interest, predict, readiness, workers, cache | `lib/fly/stream/` | **not started** (design only, doc 12) |

Counts at last check: 144+ unit tests passing; `/fly` e2e 7/7; controller e2e 5/5; full e2e (desktop+mobile) last passed 49/49 before the controller and `/fly` work, so run the **full suite** before any release.

## Earth world (built this session; `?mode=earth`, button "Fly over Earth" in the hangar)
Real globe: WGS84 ECEF flight sim (`sim/earthflight.ts`: J2 gravity, Coriolis/centrifugal, ISA atmosphere with transonic drag, RK4, slopes/friction, take off and land anywhere), terrain from Terrarium elevation tiles streamed through `earth/manager.ts` (quadtree LOD, coarse lane, ancestors, pinned ground under the ship, offline flat fallback), sky/atmosphere shader + CPU twin and lighting (`earth/skyShader.ts`, `atmosphere.ts`, `lighting.ts`), real Sun/stars (`sun.ts`), cities as OSM-footprint boxes (`buildings*.ts`), imagery provider chain (`imagery.ts`, `loaders.ts`), 18 start places. ~180 unit tests. Screenshots checked in a real Chromium (software GL) with real tiles: Alps, cockpit view, orbit limb.
**Verified in sandbox:** elevation tiles (real data), unit tests, build, rendering. **NOT verified (hosts blocked here):** EOX/NASA imagery URLs, Overpass buildings live, real GPU/phone performance. Known gaps: no wind/weather/clouds, no ocean waves, poles beyond 85.05° have no terrain, geoid ignored, buildings are flat-roofed boxes without collision, terrain mesh is 32×32 per tile (coarse close up: raise it next), dark speckles seen on flat ground (suspect ancestor/skirt overlap), Earth is not yet in the e2e suite, the Oblivion YouTube video the user linked could not be watched (blocked), model follows the five reference images.

**Update (phone performance + gear):** on touch / `?q=low` the Earth view uses a normal depth buffer with altitude-fitted near/far (log depth defeats mobile tile GPUs), no MSAA, no shadows, Lambert terrain/buildings, plain-PBR ship, lighter sky shader (8+3 steps, depth-tested after terrain), a 1-tile/frame build queue and a frame-time resolution governor (0.45×…device ratio). Profile in the sandbox showed the main thread ~71 % idle, so the cost is GPU. Landing gear is automatic (down below 15 m AGL, up and hidden above 30 m); no gear button. Skirt seams fixed (double winding + back-face culling). Not measured on a real phone.

## Suggested next steps (pick in this order unless Gee says otherwise)
1. ~~**Foundation for streaming (L0)**~~ DONE (see table). Remaining bit: wire `check:bundle` into CI and compare `/stars` and `/` against a recorded baseline. Original text: `src/lib/fly/stream/{types,resource,budget}.ts` (ResourceTracker, byte budgets), bundle-size check in CI (`/fly` first load ≤ 350 KB gz; `/stars` and `/` unchanged within 2 %), tests. Route the existing `Hangar`/`FlightArena` GL objects through the tracker and add a leak test (create/destroy returns object counts to baseline).
2. **NEXT:** Core/detail data split (F1/L1):** `src/lib/fly/bodies/` with `BodyCore` (always resident, ≤ 15 KB) and lazy `BodyDetail`; every numeric field `Sourced` with `verified:false`; derived-table tests against `docs/fly/01-physics-numbers.md`.
3. **ResidencyManager + Scheduler (L1.2/L1.3)** with property tests (priority, cancellation, hysteresis, eviction).
4. **First real world: the Moon landing** with the Kestrel (orbit → descent → land): patched-conic/SOI handoff, airless physics (ballistic dust), terrain quadtree for the Moon with tile streaming in workers, speed tiers 1–3 gated by readiness.
5. Then Mars (thin atmosphere, entry heating), then the Meridian + mothership mode, per `04-roadmap-tickets.md`.

## Open questions still owed to Gee (they change the build)
Ship names/seats/interior scope; whether Gee can supply real DEM/texture data (else terrain is procedural and labelled artistic); default difficulty; which worlds after Moon/Mars; primary device (phone vs laptop); procedural vs supplied ship models.

## Pitfalls learned (do not repeat)
- The controller wizard e2e takes ~1 min under software GL and can time out when run in parallel with the `/fly` e2e; run it with `--workers=1` to judge it.
- A disposed WebGL context cannot be reused: create a **fresh canvas per scene**.
- Hidden fixed layers can sit above header controls: give header elements `position: relative; z-index: 1`.
- `?t=` is a **Julian Date**. The `/stars` Sun overlay swallows keys unless allow-listed (`I`, `H`, `O` are).
- Chakra `Tab`/`Button` roles: no `role="listitem"` on buttons; icon-only or short-label buttons need an `aria-label` matching the full name.
- Controller e2e: hold inputs until the page reacts; the wizard arms on elapsed time as well as frames.
- Software rendering stalls the main thread: start at a low pixel ratio; the flight sim clamps long frames, so sim time runs slower than real time there.
- Chakra `transition` prop collides with framer-motion; hydration: anything time-dependent in SSR'd components must render after mount.
