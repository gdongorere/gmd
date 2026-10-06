# `/fly` — fly a big ship through the real Solar System (master plan)

Persona/constraints for whoever builds this: address the user as **Gee**, speak like Jarvis, report honestly what was and was
not verified. Branch rules and PR rules are the repo's (develop on the session branch, **do not open a PR unless Gee asks**).
Sandbox facts that shape the plan are in §19.

**Status of this document:** design only. Nothing in `/fly` exists yet. Every numeric fact about a planet or moon written
below was recalled from memory while planning, because the build sandbox can reach only the npm registry. They are all
tagged **⚠** and must be entered into code with `verified: false` until checked against a source (§18).

## Companion documents (read these with the master plan)

| File | What it holds |
|---|---|
| `docs/fly/01-physics-numbers.md` | derived physics tables (gravity, escape, orbits, SOI, terminal velocity, heating, light-time) that double as unit-test targets |
| `docs/fly/02-data-schemas-and-algorithms.md` | TypeScript data shapes, algorithms and invariants for every module |
| `docs/fly/03-world-dossiers.md` | one dossier per world: approach, sky, surface, wind, hazards, light, audio, sites, gameplay, what to verify |
| `docs/fly/04-roadmap-tickets.md` | ticket-level breakdown of phases F0–F12 with acceptance criteria and tests |
| `docs/fly/05-ui-hud-spec.md` | HUD layout (desktop and mobile), states, copy, interactions, accessibility checklist |
| `docs/fly/06-ship-spec.md` | the Wayfarer: dimensions, thrusters, gear, limits, procedural construction rules, budgets |
| `docs/fly/07-test-matrix.md` | unit/e2e/visual/manual test matrix and quality gates |
| `docs/fly/08-glossary-sources-verification.md` | glossary, where to verify each number, the verification log template, known gaps |
| `docs/fly/10-controller-support.md` | DualShock 4 / any-gamepad support on every device: approach, support matrix, `/stars` and `/fly` control maps, what is verified and what is not |
| `docs/fly/12-streaming-and-loading.md` | **only what is near and needed is loaded**: residency states, interest and priority, eviction, per-asset-class loading table, terrain streaming, code splitting, budgets, streaming-aware speed tiers, load-time budgets, L-series tickets and tests |
| `docs/fly/11-ship-roster.md` | **ship roster**: Kestrel (small), Wayfarer (heavy), Meridian (big expedition ship), hangar select, mothership launch/dock/switch, per-ship flight data, tickets, tests |
| `docs/fly/09-physicality-charter.md` | **binding realism rules**: every effect has a physical driver; ship, fluid, light, sound, terrain and feedback physics; realism tickets, declared departures and acceptance tests |

---

## 1. The idea, in one paragraph

A new page, `/fly`, where Gee pilots a very large, industrial, Matrix-style hovercraft (an original design, §7) through the
real Solar System: every planet, moon and the Sun at **true scale and at their real positions for the real date**; engine
modes that run from walking-pace hover to many times the speed of light so the whole system can be crossed in minutes; and
landings and take-offs whose feel comes from real physics and real planetary data: thin Martian air that barely resists a
wind, Venus's crushing, furnace-hot atmosphere, Jupiter's banded jet streams, Titan's thick orange haze where a ship can
nearly float, airless Moon dust thrown in clean parabolas. The experience matters more than the instruments: the page is a
game-like, full-screen, HUD-overlaid view with a clean "hide interface" mode (already shipped in `/stars`, reuse it).

### Pillars

1. **Honest scale.** 1 unit = 1 metre in the simulation, float64 everywhere. Nothing is enlarged for convenience. The only
   "cheats" are the speed tiers, and they are named and labelled.
2. **Real place, real time.** Planet and moon positions come from `astronomy-engine` for the clock's date, shared with
   `/stars` (`simClock`). Earth's night side is genuinely dark where it really is.
3. **Each world feels like itself.** Atmosphere, gravity, heat, wind, light, sound and terrain are per-body data, not a
   generic skybox. The ship behaves differently in each (§8, §9).
4. **Believable ships, big or small.** Pick a nimble bubble-canopy craft or a heavy expedition ship (or fly both: the big one carries the small one). Weight and momentum, loud when it should be, silent in vacuum; one physics engine, different data.
5. **Always recoverable, never frustrating.** Crushed on Venus or burned at the Sun? The ship is "recalled" to orbit with a
   plain explanation of what killed it. No gore, no dead ends.
6. **Instant everywhere, and only what is near and needed is loaded.** Something moves within a second; the default state of everything is *unloaded*, and an asset is resident only while a defined interest keeps it
   there (in view, within range, on the predicted path, or selected as a destination), then it is evicted. Heavy assets stream behind the scene; a weaker device gets a lower tier, never a broken page. The system is specified in `docs/fly/12-streaming-and-loading.md` and is binding on every ticket.
7. **Everything physical (binding).** Gee's direction is that everything must feel real and physical: every visual, sound, camera motion and haptic is driven by a simulated physical quantity, with no cosmetic-only effects. The rules, systems, tickets and tests are in `docs/fly/09-physicality-charter.md` and override any softer wording elsewhere.
8. **Say what is real and what is invented.** A "reality" panel per body lists which values are measured, modelled or
   artistic, exactly as the time machine does.

### Non-goals (v1)

- Multiplayer, persistence on a server, accounts.
- Real rocket-science fidelity (this is not Orbiter or KSP). Flight is *physically motivated*, assisted, and forgiving.
- Photorealistic ground imagery of places we have no data for. Where data is missing the surface is procedural and labelled.
- Crew, story missions, combat.
- Interstellar travel beyond the Solar System in v1 (the galaxy page stays the place for that; a hand-off is a later phase).

---

## 2. Where it fits in the repo

- Route: `src/app/fly/page.tsx` (server component, metadata, `dynamic(() => import(...), { ssr: false })` for the client app),
  `src/app/fly/opengraph-image.tsx`, entry in `src/app/sitemap.ts`, a link from the header and from `/stars` (Solar System
  overlay gets a **Fly** button). The existing `/stars` page is untouched.
- Code (all new, nothing in `lib/astro` or `lib/solar` is rewritten; they are *consumed*):

```
src/lib/fly/
  units.ts            // constants, c, AU, G, unit helpers
  bodies.ts           // per-body data table (radius, GM, rotation, atmosphere, hazards, sources, verified flags)
  bodiesVerify.ts     // dev-only: prints which fields are unverified
  frames.ts           // inertial / body-fixed / local-horizon frames and transforms (float64)
  ephemeris.ts        // wraps astronomy-engine: planets, Galileans, Moon, others (see §8.3)
  gravity.ts          // point-mass + J2 oblateness, third-body
  integrator.ts       // symplectic / RK4 with sub-stepping and time warp
  patched.ts          // sphere-of-influence selection and frame hand-off
  atmosphere.ts       // piecewise density/pressure/temperature models per body
  wind.ts             // turbulence, shear, jets, dust devils: deterministic noise fields
  aero.ts             // drag, lift, moments, stagnation heating (Sutton–Graves), g-load
  thermal.ts          // hull temperature model, heat shield ablation, failure thresholds
  ship.ts             // mass, thrust, RCS, fuel, assists (SAS), landing gear model
  contact.ts          // ground contact, suspension, friction, rolling/skidding
  modes.ts            // speed tiers and transitions (§4)
  terrain/            // cubed-sphere quadtree, height sources, craters, bake pipeline (§10)
  sky/                // atmospheric scattering LUTs per body, clouds, stars, ring/eclipse shadows (§9)
  audio/              // procedural WebAudio engine/wind/reentry (§12)
  input/              // keyboard, mouse, gamepad, touch maps (§13)
  render/             // three.js passes, floating origin, depth strategy, post (§11)
  state.ts            // single store, save/load of ship state in localStorage (guarded)
src/components/fly/   // FlyApp, Cockpit HUD, Map view, Photo mode, settings, tutorial, reality panel
src/app/fly/          // route
scripts/bake-*.mjs    // optional offline bakes (§10.5)
public/fly/           // baked tiles, LUTs, ship textures (generated, size-budgeted)
docs/fly/             // ship design sheet, body data sheet (generated from bodies.ts), verification log
```

- Tests live next to the code (`__tests__`), e2e in `e2e/fly.spec.ts` (§17).

---

## 3. The experience, moment by moment

**First 30 seconds.** `/fly` opens inside the ship's hangar-bay door looking out at Earth (low orbit, real night side and
city-free dark, the real Moon at its real place). The throttle is idle, the sun is behind. One caption: "Wayfarer, Earth orbit.
Press **W** to burn, **1–6** to change speed." A hint chip (dismissible, remembered) explains the HUD toggle `I`.

**Typical session.**
1. Take off from a pad on Earth (or start in orbit), reach space, switch to a cruise tier, aim at Mars.
2. Cross the system, watch planets slide past at true scale (dots, then discs, then worlds), the Sun's glare hits the cockpit glass.
3. Drop into Mars: speed tiers lock down automatically near a body (§4.3), the sky turns butterscotch, the ship shakes
   as thin air pushes on the hull, dust streams from the thrusters at landing.
4. Land at a named site or anywhere; walk the ramp view (v2), take a photo (reuse `/stars` capture).
5. Take off, dive into Jupiter's cloud tops (survivable only to a depth, then the crush warning), skim Io's plumes, thread
   Saturn's rings, land on Titan where the air is so thick the ship barely needs engines to hover.

**Camera.** Default is a **chase camera** behind and above the ship (the big hull is the star); `C` cycles chase, cockpit
(inside the bridge looking through the glass), orbit-around-ship (photo/inspect), and free-cam (detached for screenshots).
Camera shake and FOV kick scale with speed and turbulence and are disabled under `prefers-reduced-motion`.

**HUD and the clean view.** Two layers: a **flight HUD** (speed, altitude, throttle, mode, hull temperature, g-load, fuel, a
nav sphere) and a **context HUD** (target, distance, light-time, "reality" notes, map). Both fade when idle, both can be
hidden entirely with `I` (the same toggle as `/stars`). Pause, Skip, Exit-style controls from the descent design are
**always visible during guided sequences** (WCAG 2.2.2).

**Moments to design deliberately:** leaving atmosphere (sky fades to stars, sound fades out), first sight of a planet disc
growing from a point, aero-braking glow, thruster dust at touchdown, the silence of the Moon, Jupiter's lightning flicker in
the cloud deck, ring shadow sweeping across Saturn's clouds, an eclipse (Moon or Galilean shadow crossing the ship).

---

## 4. Modes of speed (the heart of "see everything")

Space is mostly empty; a believable-speed ship needs weeks to cross the system. So `/fly` has **named speed tiers**, each with
its own physics fidelity, camera behaviour and sound. The tiers are an explicit game contract, shown on screen.

### 4.1 The tiers

| # | Tier | Speed range | Physics | Purpose |
|---|---|---|---|---|
| 1 | **Hover** | 0–150 m/s | full contact + rotor/thruster hover | landing, taking off, low flying, moving near the ground |
| 2 | **Atmospheric** | up to Mach ~25 (Earth, ≈ 8 km/s) or planet-specific equivalent | full aero + heating | entry, exit, fast flight in air |
| 3 | **Orbital** | up to ~20 km/s | real gravity, patched conics, real orbits | learn orbital mechanics, rendezvous, parking orbits |
| 4 | **Transfer** | 20 km/s – 0.01 c (≈ 3,000 km/s) | gravity kept, drag zero, thrust scaled | planet to planet in hours-days of play |
| 5 | **Cruise** | 0.01 c – 0.1 c | gravity of the dominant body only | quick hops between neighbouring worlds |
| 6 | **Light** | 1 c – 1000 c (steps 1, 10, 100, 1000) | **no gravity, no collisions with bodies**, straight-line autopilot with a safety bubble | see the system in minutes (named clearly as fictional) |

A **speed dial** (`1`–`6`) selects a tier; within a tier `W/S` or the throttle sets the speed up to the cap. Tiers 4–6
have an **auto-brake bubble** around every body (radius scales with body size and with speed) so the pilot cannot fly into
a planet at 0.1 c; the ship drops one tier and lines up with the nearest body instead.

### 4.2 What the tiers cost to cross (computed, not guessed)

Times are straight-line at constant speed; c = 299,792.458 km/s, 1 AU = 149,597,870.7 km. Distances use typical separations.

| Trip | 7.8 km/s (LEO speed) | 100 km/s | 0.01 c | 0.1 c | 1 c | 10 c | 100 c | 1000 c |
|---|---|---|---|---|---|---|---|---|
| Earth → Moon (384,400 km) | 13.7 h | 64 min | 2.1 min | 12.8 s | 1.3 s | 128 ms | 13 ms | 1 ms |
| Earth → Sun (1 AU) | 222 d | 17.3 d | 13.9 h | 83 min | 8.3 min | 50 s | 5.0 s | 0.5 s |
| Earth → Mars at closest (0.37 AU) | 82 d | 6.4 d | 5.1 h | 31 min | 3.1 min | 18.5 s | 1.8 s | 0.19 s |
| Earth → Jupiter (≈ 4.2 AU) | 932 d | 73 d | 2.4 d | 5.8 h | 35 min | 3.5 min | 21 s | 2.1 s |
| Earth → Neptune (≈ 29 AU) | 17.6 y | 1.4 y | 16.7 d | 40 h | 4.0 h | 24 min | 2.4 min | 14.5 s |
| Earth → Pluto (≈ 39.5 AU avg) | 24 y | 1.9 y | 22.8 d | 2.3 d | 5.5 h | 33 min | 3.3 min | 19.7 s |
| Sun → heliopause (≈ 120 AU) | 73 y | 5.7 y | 69 d | 6.9 d | 16.6 h | 100 min | 10 min | 60 s |

Design reading: tiers 1–3 are *playing*, 4–5 are *travelling in a sitting*, 6 is *sightseeing*. The default for a
planet-to-planet hop is **0.1 c** (Earth → Mars in about 31 minutes at the closest approach, Neptune in 40 hours: too long,
so Light-1c/10c is the practical way to Neptune, about 4 hours and 24 minutes). A **"Go to…" autopilot** picks the tier,
speeds through the empty part and brakes at the target (the player may take back control at any time).

### 4.3 Transitions and rules

- Entering a body's **atmospheric or surface bubble** (altitude < ~1 body radius for rocky worlds, < ~3 radii for gas giants)
  caps the tier to 3 and below, with a clear "slowing for Mars" caption and a short ease so it never feels like a hard stop.
- Leaving the bubble allows climbing back up the tiers.
- **Time:** at tiers ≥ 3 the *simulation clock* can run fast too (planets move), but ship-local physics always runs in real
  time; a separate "world time rate" control exists (default 1×, because 1× is the real current sky).
- **Floating-point safety** at 1000 c (≈ 3×10⁸ km/s) is handled by integrating position in float64 AU with the camera-relative
  render path from `lib/solar/scene.ts` and clamping the per-frame step to the target distance (never overshoot).
- **Motion sickness:** FOV changes and streaking effects are tied to speed and have a *comfort* setting (off / reduced / full).
  Reduced-motion users get instant-cut transitions between tiers and no streaks.

---

## 5. Architecture and the scale problem

The Solar System spans ~10¹³ m while a landing pad needs millimetres of precision. That is a 10¹⁶ dynamic range. Doubles
give ~15–16 digits, so **simulation is float64 everywhere** and **rendering is camera-relative float32** (already proven in
`lib/solar/scene.ts`).

### 5.1 Coordinate frames

- **Heliocentric inertial (ecliptic J2000)**: ephemerides, long-range travel. Units: metres (float64). Scene axes follow the
  existing mapping (x, z, −y) so ecliptic north is up.
- **Body-centred inertial (BCI)**: used inside a body's sphere of influence; avoids losing precision on the huge heliocentric
  offset. Hand-off at the SOI boundary uses frame difference of position and velocity at that instant (`patched.ts`).
- **Body-fixed (BCBF)**: rotates with the body; the ground, terrain, wind and landing pads live here. Rotation from
  IAU pole/prime-meridian models (Earth: GMST already in `lib/astro/time.ts`; Mars: `marsOrientation`; others: IAU rotational
  elements, §18, as polynomial/linear terms).
- **Local horizon (ENU)** at the ship: what the cockpit instruments and the landing logic read.

### 5.2 Floating origin and rendering

- The renderer's origin is always the **camera focus** (the ship). Every object position = (object − ship) computed in float64
  then cast. Terrain tiles are positioned relative to the ship the same way; their vertex data is stored in tile-local metres.
- **Depth:** keep the logarithmic depth buffer (works in WebGL2 and across 10⁻² … 10¹³ m) and add a **two-pass split**: a "far"
  pass for planets/stars (no depth precision need; rendered with a big near/far and depth cleared) and a "near" pass for ship,
  terrain and effects. This is the standard fix for z-fighting between a ship and a planet behind it, and avoids the log-depth
  fragment-shader cost on everything. (Reverse-Z with a 32-bit float depth is available if the extension is present; fall back.)
- **Objects at true scale are sub-pixel at range.** Render them as: a **point/glow sprite** with correct *apparent
  magnitude-like* brightness, then a **billboarded disc with phase** once the angular size exceeds ~1.5 px, then a **full lit sphere
  with atmosphere shell** once larger than ~8 px, then **terrain LOD** when within ~3 body radii. All four are driven by
  angular size, never by a hand-set distance.
- Large bodies need **analytic shadows** (planet and moon shadow cones over the ship, ring shadows over a planet) because
  shadow maps cannot span them. Near the ship, **cascaded shadow maps** shadow the hull and landed objects.

### 5.3 Time stepping

- Physics runs at a **fixed 120 Hz sub-step** accumulator (60 Hz on the low tier), decoupled from render. Slow frames cannot
  change the outcome.
- At tiers 4–6 the step becomes **adaptive in distance** (large steps far from bodies, small near), with the autopilot's
  target-clamp from §4.3.
- **Ephemeris** is sampled each render frame at the clock's JD and *interpolated linearly in between* (a 10–60 s window)
  for speed; positions are re-queried exactly on tier changes and every second. Cost target: all bodies < 1 ms/frame (§11.4).

### 5.3b Streaming and residency (summary; full design in `docs/fly/12-streaming-and-loading.md`)

Every asset (code chunk, data table, texture, mesh, terrain tile, LUT, ship, audio graph) is a `Streamable` with an owner, a byte cost, an **interest rule** (frustum/angular size, distance and sphere of influence, **predicted path**, player intent, mode), a hysteresis band and an eviction path. A `ResidencyManager` and `Scheduler` (priority = interest × urgency ÷ cost, per-kind concurrency, cancellation, ≤ 2 ms/frame of main-thread work) keep the resident set inside per-tier budgets; a `ResourceTracker` owns every GPU object so eviction truly frees memory. Consequences that shape the rest of the plan:

- **Far bodies are KB-sized sprites** from a core table that is always resident; a body's detail (atmosphere, wind, palette, landmarks) is a lazy chunk loaded on approach or when it is selected as a target; terrain, LUTs and clouds exist only for the **current** body.
- **Terrain** is a quadtree whose resident set is the tiles the screen-space-error budget needs (≈ 300–900 tiles), generated in workers, with parents kept until children land (no holes).
- **Ships:** only the selected/active hull is resident (a second one only when docked or within physics range).
- **Speed tiers obey streaming readiness:** `v_max = min(tier cap, bubble cap, ready radius ÷ measured load time)`; "Slowing for Mars" doubles as "streaming ahead", and there is never a blocking load screen in flight.
- **Code splitting:** shell → hangar → flight → per-world chunks → audio → map, each a dynamic `import()`; a Moon-only session never fetches Mars, Jupiter or Saturn code or data.

### 5.4 Module boundaries (so work can parallelise)

`bodies.ts` (core table always resident; per-body detail lazy) → `stream/*` (what is loaded) → `ephemeris`/`frames` (where things are) → `gravity`/`integrator` (how the ship moves) → `atmosphere`/`wind`/
`aero`/`thermal` (what the air does) → `ship`/`contact` (what the ship does) → `render/*` and `audio/*` (what you see and hear).
Each layer is pure TypeScript with unit tests; only `render/*`, `audio/*`, `input/*` and `components/fly/*` touch the browser.

---

## 6. Physics, in detail

### 6.1 Gravity and orbits
- Point mass GM per body (⚠ values in §8 and `bodies.ts`), plus **J2** oblateness for Earth, Mars, Jupiter, Saturn so low
  orbits precess correctly; plus **third-body perturbation** from the Sun/Jupiter inside the heliocentric phase.
- **Patched conics** for orbit *display and prediction* (the familiar map-view ellipse); the **actual motion** is numerically
  integrated (RK4 sub-stepped, symplectic Leapfrog for the long coasts) so the display is a prediction, not a rail. This is
  the honest alternative to "on rails" and costs little.
- **Sphere of influence** switch uses the Laplace radius `r ≈ a (m/M)^(2/5)` with hysteresis.
- Orbital elements readout and a **prograde/retrograde/normal/radial** marker set on the nav sphere.

### 6.2 Rigid body, ship and landing
- A single rigid body with a **hand-written 6-DOF integrator** in float64 (position, velocity, quaternion, angular velocity,
  inertia tensor from the ship's mass model, §7). No general physics engine is used for flight: engines such as Rapier/Cannon
  are float32/small-world and fight a floating origin. **Option (decided in F6):** use **Rapier (`@dimforge/rapier3d-compat`,
  WASM, on npm)** *only* for local ground contact in a small, ship-centred, tangent-plane world, fed with the local terrain
  heightfield; everything else stays custom. This gives rubble/rock contact for free without compromising scale.
- **Thrusters:** main engines (large, along the ship axis), **RCS** (small, translation + rotation), **hover jets** (down-facing,
  used under 150 m/s and near ground), **retro** engines. Each has thrust, ISP (so fuel lasts), min throttle, spool time, and
  **plume model** that depends on ambient pressure (fat in vacuum, thin and pinched in dense air) feeding VFX and sound.
- **Fuel:** a single "reaction mass" budget per tier family with a generous allowance so the *experience* is not a fuel puzzle
  (setting: **Realistic fuel / Relaxed / Unlimited**), because Gee asked for freedom to see everything.
- **Assists (SAS-like):** attitude hold, prograde/retrograde lock, radial/normal, target-point, **hover assist** (altitude and
  vertical-speed hold), **auto-land** (suicide-burn solver with terrain scan), **auto-orbit** (circularise at altitude). All
  assists are toggles with a plain explanation, and manual flight stays fully possible.

### 6.3 Landing and take-off
- **Landing gear** model: 4–6 hydraulic legs with spring-damper, each a contact sample point; foot pads sink into regolith/
  dust by a per-body stiffness (⚠ soft dust on the Moon, hard on rock, soft powder on Titan's dunes, none on gas giants).
- **Touchdown rules:** max vertical speed ~ 3 m/s, tilt < 12°, horizontal speed < 1.5 m/s for a "clean" landing; harder is a
  "rough landing" (damage state that is visible and repairable by "recall"); much harder is a "crash" → recall.
- **Take-off:** on a rotating body the surface speed is added automatically (Earth equator ≈ 465 m/s ⚠; Mars ≈ 240 m/s ⚠).
  A pad **countdown** is optional; a "quick launch" button exists. Gravity turn guidance on the HUD.
- **Dust and plume interaction:** regolith/dust thrown by exhaust within ~2–3 nozzle diameters of the ground; on the Moon
  (no air) it flies in clean ballistic arcs and covers the camera lens slightly; on Mars it forms a billowing cloud that hangs
  in the thin air; on Venus and Titan the dense air smothers it.

### 6.4 Flight in an atmosphere (the heart of the feel)
- **Density** from `atmosphere.ts` (piecewise exponential per layer, with a temperature profile; Earth uses a standard-
  atmosphere-style table; others use scale-height-based layers) → dynamic pressure `q = ½ ρ v²`.
- **Drag/lift/moments**: a simplified aero model of a *blunt lifting body*: `C_D(M, α)`, `C_L(α)` tables (Mach-dependent
  transonic rise) and a centre-of-pressure offset that gives **stability** (the ship wants to point nose-first) and
  **buffet**. Parameters are tuned so the ship is stable in reentry and sluggish but controllable at low speed.
- **Wind and turbulence** (§8.2) add a velocity field `w(x,t)` to the air-relative velocity: the aero forces use `v − w`, so
  gusts, shear and jet streams push the ship realistically. Turbulence intensity scales with convective activity, terrain
  roughness, and Reynolds-like depth.
- **Heating:** stagnation heating **Sutton–Graves** `q̇ = k √(ρ/R_n) v³` (k per atmosphere composition, ⚠ Earth ≈ 1.74×10⁻⁴,
  Mars ≈ 1.9×10⁻⁴ SI), integrated into a **hull temperature** model with radiative cooling and a **heat shield** that ablates
  (a visible resource, failure when exhausted). Plasma glow in the shader scales with `q̇`. Convective heating on Venus is
  dominated by the **ambient temperature** (≈ 737 K ⚠) rather than by speed.
- **Structural limits:** g-load (long-term and impulsive), dynamic-pressure limit ("max-Q"), and **crush depth** in gas giants
  (set by ship pressure rating). Exceed and the damage state advances; extreme exceedance → recall.
- **Buoyancy** in thick atmospheres: with a large envelope the ship can **float** on Venus's upper-cloud layer (where
  pressure and temperature are Earth-like at ~50–55 km ⚠) and wallow on Titan. An optional "aerostat" module (later phase) is
  the physical reason you can hover long there. The Wayfarer itself uses thrust.

---

## 7. The ships (roster: Kestrel, Wayfarer, Meridian)

> **Update (Gee):** the pilot must be able to fly **either a big ship (Mass Effect Andromeda-style expedition ship) or a small craft (Oblivion-style bubble-canopy VTOL)**. The single-ship design below is now one of three hulls; the roster, hangar, mothership mode (the big ship carries the small one), per-ship flight data and tickets are in **`docs/fly/11-ship-roster.md`**. Designs are original (language and role only). A correction found while doing this: the first Wayfarer drive numbers could not reach orbit, so propulsion values were raised to a fictional torch (Δv ≈ 15–19 km/s).

### 7.0 The original single-ship design (now the Wayfarer)

(an original design in the spirit of a Matrix-era hovercraft)

The brief asks for a big spaceship "almost like the crafts in the Matrix, or a cool 3D asset you can find." Two important
facts: **(a)** the sandbox cannot download assets, and **(b)** the Matrix craft are a third party's design, so `/fly` should ship
an **original** ship with the same *language* (industrial, riveted, exposed pipes and vents, ring-shaped engine pods, a
low flattened hull, hard-working rather than sleek), not a copy.

### 7.1 Design sheet
- **Class:** "heavy hover-freighter". Length ≈ **90 m**, beam ≈ 40 m, height ≈ 18 m (so a 1:1 hangar fits a house; big enough to feel
  massive when parked next to a base and tiny against a planet). Dry mass ⚠ **~600 t** as a gameplay value.
- **Silhouette:** a long **spine** with a forward **bridge/cockpit blister** with a wide glass band; a central **hab/cargo
  block**; a rear **engine cluster**: three large **ring-shaped nacelles** (inspired by industrial drive coils) around a
  central main nozzle, plus two angled outrigger **hover-pod** wings with down-facing jets; a short **ramp** at the rear;
  exposed **cabling, vents, radiators** and **panel lines**; hazard stripes and numbered hull plates.
- **Details that sell scale:** tiny windows in a row (people-sized), a maintenance ladder, running lights (red/green/white),
  landing lights with real cones, **steam/coolant venting**, a rotating **radar dish**, **heat tiles** underneath that darken
  and glow after reentry (driven by `thermal.ts`), and **damage decals** that accrue with rough landings (soot, scratches).
- **States:** parked (engines cooling, ticking sounds), hover, cruise, reentry plasma, damaged. Each has visual and audio parts.

### 7.2 How it is built without downloadable assets (primary path)
Procedural modelling in TypeScript (`src/lib/fly/ship/`): a small **parametric hull builder** (lofted cross-sections,
chamfered panels, extruded greebles by seeded rules, instanced rivets and pipes), producing **merged BufferGeometry** with
tangents; **procedural PBR textures** (panel lines, scratches, soot, rust, hazard stripes, emissive windows) drawn into
CanvasTextures at load and cached as KTX2 only if a bake is ever added; **MeshStandard/Physical** materials with environment lighting. LOD:
**LOD0 ≈ 150–200 k triangles** (hero), **LOD1 ≈ 30 k**, **LOD2 ≈ 3 k**, **impostor** beyond ~2 km. Instance repeated parts to
keep draw calls < 60.

### 7.3 Optional asset path (if Gee supplies a model)
- Accept **glTF/GLB** dropped into `public/fly/ship/` with a **licence file** (CC0 / CC-BY with attribution recorded in
  `docs/fly/credits.md`). Pipeline: validate, `gltf-transform` (npm) to **Draco/Meshopt + KTX2** compress, check the
  triangle/texture budgets, and map named nodes (`NOZZLE_MAIN`, `GEAR_FL`, `LIGHT_NAV_L`, `WINDOW_EMIT`…) to the flight model.
- The procedural ship remains the fallback so `/fly` never depends on an external file.
- **Rule:** no model is committed without a recorded licence.

### 7.4 Interior / cockpit
Cockpit view looks out through the glass at a modelled **bridge interior**: instrument panels (the *same* flight HUD data
rendered as in-world screens in a later phase), a throttle quadrant, window frame with subtle **glass reflections**,
dust motes. v1 can be a simple frame plus the HUD; v2 adds a walkable ramp/airlock.

---

## 8. Worlds: what to simulate for each (and why)

All numbers are **⚠ recalled from memory** and must be verified (§18). They are *design inputs* for `bodies.ts`, each with a
`source` and `verified: false`. "Reality tag": **M** measured, **D** derived/modelled, **A** artistic.

### 8.1 Master data table (per body)

Columns: mean radius R, surface gravity g, rotation (sidereal), axial tilt, atmosphere, surface temp, notes for flight.

| Body | R (km) | g (m/s²) | Day | Tilt | Atmosphere | Temp | Flight/landing notes |
|---|---|---|---|---|---|---|---|
| **Sun** | 695,700 | 274 | ~25 d (eq) | 7.25° | plasma; photosphere ~5,772 K; corona > 10⁶ K | — | not landable; heat limit; flares; coronal streamers |
| **Mercury** | 2,439.7 | 3.70 | 58.6 d (3:2 spin-orbit) | ~0° | exosphere only | −180…+430 °C | no air, huge day/night shear, tiny polar ice in craters |
| **Venus** | 6,051.8 | 8.87 | −243 d (retrograde) | 177° | 92 bar CO₂ 96.5 %, H₂SO₄ clouds 48–70 km | ~737 K (464 °C) | crushing, furnace, super-rotating clouds (~100 m/s) |
| **Earth** | 6,371.0 | 9.81 | 23 h 56 m | 23.44° | 1 atm N₂/O₂, H ≈ 8.5 km | −90…+55 °C | real weather as texture; jet streams |
| **Moon** | 1,737.4 | 1.62 | tidally locked (27.3 d) | 6.7° | none | −170…+120 °C | dust, earthshine, 1.3 s light delay to Earth |
| **Mars** | 3,389.5 | 3.71 | 24 h 37 m | 25.19° | 0.6 kPa CO₂ 95 %, H ≈ 11 km | −125…+20 °C | thin: low wind force but dusty; dust devils; big relief |
| **Phobos** | ~11.1 | ~0.006 | locked (7.7 h orbit) | — | none | −4…−112 °C | near-zero gravity, "land" by touching |
| **Deimos** | ~6.2 | ~0.003 | locked | — | none | ≈ −40 °C | same |
| **Jupiter** | 69,911 | 24.8 at 1 bar | 9 h 56 m | 3.1° | H₂/He, H ≈ 27 km; NH₃/NH₄SH/H₂O clouds | 165 K at 1 bar | no surface; bands with ~100 m/s jets; lightning; radiation |
| **Io** | 1,821.6 | 1.80 | locked | — | trace SO₂ | −130 °C (hot spots > 1,500 K) | volcanic plumes to ~300 km; sulfur colours; Jupiter looms |
| **Europa** | 1,560.8 | 1.31 | locked | — | trace O₂ | −170 °C | cracked ice (lineae), brown stains, plume candidates |
| **Ganymede** | 2,634.1 | 1.43 | locked | — | trace O₂ | −160 °C | own magnetosphere (auroras), grooved terrain |
| **Callisto** | 2,410.3 | 1.24 | locked | — | trace CO₂ | −140 °C | ancient cratered ice and rock |
| **Saturn** | 58,232 | 10.4 at 1 bar | 10 h 33 m | 26.7° | H₂/He, H ≈ 60 km | 134 K at 1 bar | hexagon, 500 m/s equatorial winds, rings |
| **Rings** | 74,500–140,220 (main) | — | — | — | — | ~80–100 K | particles cm–m, vertical thickness ~10 m–1 km, spokes |
| **Titan** | 2,574.7 | 1.35 | locked | — | **1.47 bar** N₂ 95 %, CH₄ 5 %; H ≈ 20 km | **94 K** | thick orange haze, methane lakes and rain, dunes; flight is easy |
| **Enceladus** | 252.1 | 0.11 | locked | — | plume water vapour | −200 °C | geysers from "tiger stripes" |
| **Rhea / Iapetus / others** | 764 / 735 | 0.26 / 0.22 | locked | — | none | −175 °C | Iapetus two-tone, equatorial ridge |
| **Uranus** | 25,362 | 8.69 | −17 h 14 m | **97.77°** | H₂/He/CH₄, H ≈ 28 km | 76 K at 1 bar | extreme tilt: polar day/night seasons; faint rings; blue-green |
| **Miranda** | 235.8 | 0.08 | locked | — | none | −187 °C | huge cliffs (Verona Rupes ~20 km) |
| **Neptune** | 24,622 | 11.2 at 1 bar | 16 h 6 m | 28.3° | H₂/He/CH₄, H ≈ 20 km | 72 K at 1 bar | fastest winds (~580 m/s), Great Dark Spot analogue, faint rings |
| **Triton** | 1,353.4 | 0.78 | locked, retrograde | — | thin N₂ (~1.4 Pa) | −235 °C | nitrogen geysers, cantaloupe terrain |
| **Pluto** | 1,188.3 | 0.62 | −6.39 d | 122.5° | thin N₂ (~1 Pa), layered haze | −230 °C | nitrogen glaciers (Sputnik Planitia), water-ice mountains ~3.5 km |
| **Charon** | 606 | 0.29 | locked | — | none | −220 °C | red polar cap (Mordor Macula), canyons |
| **Ceres** | 469.7 | 0.28 | 9 h | ~4° | none | −105 °C | bright salt spots (Occator), cryovolcano Ahuna Mons |
| **Vesta** | ~262 | 0.25 | 5.3 h | — | none | −60…−190 °C | giant south-pole crater, equatorial troughs |

(Phobos/Deimos/asteroid radii are mean/equivalent; shapes are irregular and handled in §10.4.)

### 8.2 What the air does, per world (weather and turbulence)

`wind.ts` is a deterministic, seeded field `w(position, time)` made of layers so it is cheap and reproducible.

| World | Model components | Gameplay effect |
|---|---|---|
| Earth | zonal jet streams (~±50 m/s ⚠ near 10 km), boundary-layer shear, convective cells over land, orographic gusts | strong buffet in the jet and over mountains, calm high up |
| Mars | thin atmosphere (low force), **dust devils** (vortices 100 m–km), katabatic winds, **global dust storms** (reuse `lib/astro/mars.ts` storm catalogue: dust opacity, brown-out visibility) | gentle push but the dust is the hazard: sensor/vision loss, drag from suspended grains |
| Venus | super-rotation (~100 m/s at cloud tops ⚠), sluggish surface wind (~1 m/s ⚠), acid cloud layers, lightning (debated; artistic) | steady drift east at altitude; heat and crush dominate |
| Jupiter | **zonal jets** alternating by latitude (±~100 m/s ⚠), cloud decks at different depths (white NH₃, brown NH₄SH, blue H₂O), **Great Red Spot** anticyclone (≈ 1.3 Earth diameters ⚠), **lightning flashes** | big shear at band boundaries; GRS rim buffet; depth-limited by pressure |
| Saturn | broad equatorial jet (~500 m/s ⚠), north-pole **hexagon** jet, ring shadow | long fast streaming winds, calmer high latitudes |
| Uranus | modest jets (±~250 m/s ⚠), seasonal polar cap haze | quiet, cold, featureless |
| Neptune | fastest winds (~580 m/s ⚠), dark spots, bright methane clouds | violent, with rare high clouds |
| Titan | low-speed winds near surface (~1 m/s ⚠), upper-atmosphere super-rotation, methane clouds and rain, dune fields | thick air: lift is generous, ride is smooth |
| Pluto/Triton | very thin N₂, plume deposits, haze layers | negligible force; scenic haze layers and nitrogen plumes |

Turbulence is generated as **(a) a coherent large-scale field** (curl-noise advected by time) **plus (b) a small-scale
Kolmogorov-style spectrum** scaled by a per-world *roughness* coefficient; **(c) event vortices** (dust devils, storm cells) are
placed deterministically from the date and location so a visit on the same date shows the same storm. Output also drives
visuals (streaking dust, cloud motion) and **audio** (wind roar).

### 8.3 Ephemeris coverage (what `astronomy-engine` gives and what is missing)

| Need | Source | Status |
|---|---|---|
| Sun, Mercury–Neptune, Earth's Moon, Pluto | `astronomy-engine` (`HelioVector`, `GeoMoon`, Pluto supported) | available |
| Galilean moons (Io, Europa, Ganymede, Callisto) | `JupiterMoons()` in astronomy-engine | available (verify API in F2) |
| Saturn's moons, Uranian moons, Neptune's Triton, Mars's moons, Charon | **not in the library** | **gap**: implement low-precision mean-element models (Kepler orbits with node/periapsis precession) from published mean elements ⚠; label "approximate position" in the reality panel |
| Asteroids/comets (Ceres, Vesta…) | none offline | gap: osculating Kepler elements (⚠), epoch-limited accuracy, labelled |
| Rotation (pole RA/Dec, prime meridian W₀, rate) | IAU report values ⚠ | implement as `bodies.ts` fields; Earth/Mars already exist in the repo |
| Ring geometry | static (inner/outer radii, thickness, opacity profile) ⚠ | data entry |

Everything marked gap is tagged **approximate** in the UI; positions of the principal planets and the Moon stay "precise".

### 8.4 Light, sky and sound per world

- **Sun size/brightness** by distance (true inverse-square): Mercury's Sun is ~2.5× wider than ours; Neptune's is a bright dot.
- **Sky colour** from Rayleigh/Mie coefficients per atmosphere (§9.1): Earth blue, Mars butterscotch (blue sunsets), Venus
  yellow-orange and dim, Titan orange-brown, Jupiter/Saturn from cloud-top albedo, Uranus/Neptune cyan-blue from methane.
- **Planetshine and eclipses:** Earth-shine on the Moon, Jupiter-shine on Galilean moons, moon shadows crossing planets,
  planetary shadows crossing moons and the ship.
- **Sound** (§12): only where air exists; vacuum is silent except for cabin and a low engine "structure-borne" rumble.

---

## 9. Visual systems

### 9.1 Atmospheres
- **Scattering LUTs** (transmittance, multiple scattering, sky-view, aerial perspective) in the **Hillaire (2020)/Bruneton**
  style, precomputed on load in a worker/GPU pass per atmosphere from `bodies.ts` coefficients (Rayleigh, Mie, ozone/
  absorber layers, scale heights). One LUT set per *active* world only (the others are cheap analytic rim shells at range).
- **Planet-from-space look:** atmosphere rim glow, terminator softening, ring shadow, specular ocean glint (Earth).
- **Reentry/aero VFX:** shock layer glow, boundary-layer streaks, ablation sparks, wake turbulence, heat shimmer.

### 9.2 Clouds and weather visuals
- **Volumetric clouds** (raymarched, low steps with temporal reprojection) on Earth, Mars (thin water-ice cirrus and dust
  haze), Venus (thick opaque deck seen from above, shades of yellow and ochre; **UV contrast bands** artistic), Jupiter/Saturn
  (banded **2-D flow-mapped textures** animated by shear, with a few 3-D storm volumes at the spots), Titan (haze layers).
- **Particles:** dust, snow, rain (methane on Titan is artistic ⚠), sulphur plumes (Io), water geysers (Enceladus), lightning
  (additive flash + distant glow).

### 9.3 Terrain look (tri-planar, procedural, per-body palette)
Albedo and normals from biome-like rules per world (§10.3), **micro-detail normal maps** at the pad scale, **parallax**
on rock, **dust accumulation** in lows, **ice/frost lines**; **no baked photographs** (none are available offline).

### 9.4 Post-processing
Tone mapping (ACES/filmic), bloom keyed to the Sun and engines, auto-exposure with **eye adaptation** (the transition from
Venus's gloom to open space should feel physical), lens flares and ghosting on the Sun, **film grain** (subtle), vignette
and **heat distortion** behind exhausts. All toggles; **reduced-motion** disables shake, adaptation lag and streaks.

### 9.5 Quality tiers (reuse `lib/galaxy/tiers.ts` ideas)
`ultra / high / medium / low / minimal / static`: tiers change terrain detail, cloud steps, shadow cascades, particle caps,
pixel ratio (the governor from `System3D` is reused: 1.75 → 1 → 0.75 → 0.5 → 0.35), LUT resolution, and post stack. A device with
no WebGL, or too slow at the lowest step, gets the **`/stars` Solar System tab** with a "this device can't fly" message and a
link — never a broken page.

---

## 10. Terrain at planetary scale

### 10.1 Structure
**Cubed-sphere quadtree (CDLOD / chunked LOD)**: 6 root faces, each subdivided by screen-space error, tiles of 65×65 height
samples, skirts to hide cracks, geomorphing to remove popping. Level 0 ≈ a whole face; the deepest level targets **~0.25 m**
vertex spacing on the ground near the ship (level count depends on body radius; the Moon ≈ 22 levels). Tiles are generated in
**Web Workers** from a deterministic height function and cached (LRU) with a hard memory budget per tier.

### 10.2 Height sources (in priority order)
1. **Analytic landmarks** per world encoded as *stamps* (known lat/lon, size, height profile) so famous places are *there*,
   e.g. Olympus Mons (~22 km high, ≈ 600 km across ⚠), Valles Marineris (~4,000 km long ⚠), Hellas basin (~7 km deep ⚠), Maxwell
   Montes (~11 km ⚠), Tycho and Copernicus craters, Verona Rupes (~20 km ⚠), Sputnik Planitia (~1,000 km ⚠), Occator Crater.
2. **Statistical terrain**: fractal noise (ridged + billow + domain-warped) shaped by a **per-world spectrum** (rough old
   Moon, smooth Mars lowlands, wrinkled Venus plains), **crater populations** drawn from a size–frequency distribution and
   degraded by age (fresh/rimmed → eroded), rift/graben fields, dune fields (Titan, Mars, Venus), plus **lava flows** and
   **ice cracks** where the world warrants.
3. **Optional real DEMs** (best fidelity): if Gee supplies public-domain NASA/USGS grids (MOLA/Mars, LOLA/Moon, Magellan/Venus,
   ETOPO/Earth) the **bake pipeline** (§10.5) converts them to tile pyramids that replace layer 2 at coarse levels, with the
   statistical detail added on top below the data's resolution.

### 10.3 Surface materials and colour
Per-world palette and rules (⚠ artistic, labelled **A**): lunar greys with bright young ejecta; Mars iron-oxide reds with dark
basalts and bright dust; Venus basalt browns under orange haze; Titan orange-brown dunes with dark organic lowlands and
methane lakes (specular liquid); Europa white-blue ice with brown lineae; Io yellow-orange sulfur, white SO₂ frost, black silicate
and red-orange plume deposits; Pluto cream nitrogen ice, red tholins and dark patches; Ceres dark grey with bright salts.
Liquid surfaces (Earth oceans, Titan lakes) have a simple wave spectrum and Fresnel reflection.

### 10.4 Small and irregular bodies
Phobos, Deimos, Enceladus, Vesta and the like use **spherical harmonics or low-poly shape models + displacement** (no real shape
data offline: generate plausible potato shapes with seeded noise, scaled to the real mean radii and axis ratios ⚠) and
**gravity from a mascon-free ellipsoid** approximation. Landing here is slow, gentle and strange (escape velocities of tens of
m/s). Mark as **A** (shape not real).

### 10.5 Bake pipeline (optional, offline)
`scripts/bake-dem.mjs`: reads a user-provided GeoTIFF/PDS img, reprojects to the cube-sphere, builds a mip/tile pyramid in a
compact format (16-bit height PNG or custom), writes `public/fly/dem/<body>/…` and a manifest; `scripts/bake-textures.mjs` does the
same for albedo. **No dataset is bundled or fetched at build time**; the doc lists the public-domain sources to download (§18).
Size budget: **≤ 25 MB per body** compressed, lazy-loaded per tile.

---

## 11. Rendering engineering

### 11.1 Passes (per frame)
1. **Far pass:** stars (reuse the starfield buffers where sensible), Milky Way backdrop, Sun, planets/moons as sprites/discs/spheres,
   rings, orbit hints (optional). Clear depth.
2. **Atmosphere pre-pass** for the *current* world (sky-view LUT lookup).
3. **Near pass:** terrain tiles, ship, effects, with CSM for the near field and analytic shadows for planetary-scale casters.
4. **Volumetrics/particles**, then **post**.

### 11.2 Depth and precision
Far pass: standard depth with near=1 km, far=10¹⁴ m after scaling. Near pass: reverse-Z where `EXT_clip_control` exists, else log depth.
Every transform is camera-relative double→float; terrain tile vertices are tile-local metres (< 2¹⁸ m, safe in float32).

### 11.3 Memory and draw-call budgets (residency budgets per tier are in `docs/fly/12-streaming-and-loading.md` §8)
Target ≤ 600 MB GPU on `ultra`, ≤ 250 MB on `medium`, ≤ 120 MB on `low`; ≤ 400 draw calls; ≤ 1.5 M triangles on screen
(`high`). Texture compression (KTX2/Basis) for baked assets; procedural textures are small (≤ 2k).

### 11.4 CPU budget (60 fps = 16.6 ms)
Physics ≤ 1.5 ms, ephemeris ≤ 1.0 ms, terrain scheduling ≤ 1.0 ms main thread (generation in workers), audio ≤ 0.5 ms, render
submit ≤ 6 ms, input/HUD ≤ 1.5 ms. The governor measures these; breaching two in a row drops a tier.

### 11.5 WebGPU
Not assumed. If `navigator.gpu` is present later, the same module boundaries allow a WebGPU renderer for terrain/cloud compute.
v1 is **WebGL2 + three.js** to match the repo.

---

## 12. Audio (procedural, off by default)

Per the project principle, **audio is opt-in** (one toggle, never autoplays, state remembered, works if storage is blocked).
`audio/` builds everything with WebAudio nodes, no samples required:
- **Engines:** low-pass filtered noise + sub-oscillators, pitch/volume from throttle, thrust and ambient pressure; ring-nacelle
  "hum" harmonics; spool-up and cut-off transients; **vacuum:** only structure-borne low rumble and cabin.
- **Atmosphere:** wind roar scaled by dynamic pressure and turbulence; reentry **plasma roar**; sonic boom shock when crossing
  Mach 1 in a medium that supports it; **dense air** (Venus, Titan) muffles highs.
- **Surface:** touchdown thump (spring-damper impulse), skid, dust patter, gear servo.
- **Cabin:** hull ticks as it cools, warning tones (heat, g, crush), soft UI blips; **comms** voice lines are out of scope (text).
- **Spatialisation:** HRTF panner for external sources in the chase camera; none inside the cockpit except engine direction cues.
- A master **loudness limiter** and a "reduce loud sounds" setting; captions for key sounds for accessibility.

---

## 13. Controls and UX

### 13.1 Default map (all remappable, stored locally)
| Action | Keyboard / mouse | Gamepad | Touch |
|---|---|---|---|
| Pitch / yaw | mouse drag (look) or `↑↓←→` | right stick | right virtual stick |
| Roll | `Q` / `E` | triggers/shoulders | twist two-finger |
| Translate (RCS/hover) | `W A S D`, `Space` up, `C`/`Ctrl` down | left stick + triggers | left virtual stick |
| Throttle | `Shift` up / `Ctrl` down or wheel; `X` cut; `Z` full | triggers | slider |
| Speed tier | `1`–`6`, `[ ]` step | D-pad L/R | tier chips |
| Assists | `T` attitude hold, `R` retro, `G` gear, `H` hover assist, `L` autoland | face buttons | HUD buttons |
| Camera | `V` cycle, `F` free-cam | click right stick | button |
| Map / Go to… | `M` | Select | button |
| Time machine | `J`, `,`/`.` steps (shared with `/stars`) | — | clock panel |
| Photo mode | `P` (freezes the world, free camera, hides HUD) | — | button |
| Hide interface | `I` | — | eye button |
| Pause | `Esc` or `Pause` | Start | button |

### 13.2 Screens and flows
- **Start screen:** where you are (Earth orbit by default), date, three starter missions (Orbit → Moon landing, Mars landing,
  Grand tour), tier help. No account, no login.
- **Pause menu:** resume, controls, quality, comfort, audio, reality panel, exit to `/stars`.
- **Map view:** an orrery mode (reuse `Orrery`/`System3D` rendering) with the ship, orbit prediction and a destination picker;
  "Go to…" computes a straight-line or transfer path and the tier plan.
- **Reality panel:** per-body list "what is measured, modelled, artistic, unverified" with sources (fed from `bodies.ts`).
- **Tutorial:** four short steps (turn, burn, change tier, land) skippable and replayable, with a **practice hover course**.

### 13.3 Accessibility and comfort
Full keyboard operation of all UI; screen-reader announcements for tier, mode, warnings (`aria-live`, throttled);
**reduced motion** (no shake/streaks, instant tier cuts), **colour-blind-safe** warnings (shape + colour), adjustable text size,
captions for audio cues, one-handed/assist presets, **photosensitivity**: lightning/flash intensity capped (< 3 flashes per second, lower amplitude option).

---

## 14. Landing sites and "missions" (content)

Named, pre-built destinations to make the first hour delightful (positions from published coordinates ⚠; coordinates are data entry
and must be verified): Tranquility Base (Moon), Tycho rim, Shackleton (south pole); **Jezero** and **Gale** (Mars), Olympus Mons
summit approach, Valles Marineris flight line; **Maxwell Montes** (Venus, aerial); Io's Pele plume; Europa's Conamara; Titan's
Kraken Mare shore and Huygens landing region; Enceladus's tiger stripes; Pluto's Sputnik Planitia; Triton's geysers;
Ceres's Occator; Earth: a runway-free pad at a real lighthouse-like coordinates (no real addresses). Each has a one-line
caption, a difficulty tag, and a "why it looks like this" note, like the cards in `/stars`.

**Missions (soft goals, no fail-state spam):** First Orbit, Moon Landing, Mars Descent, Dive the Great Red Spot rim, Thread the
Rings, Titan Glide, Sun Skimmer (survive N seconds at a safe corona distance), Grand Tour (touch every planet). Completion is
local only.

---

## 15. Failure, recall and difficulty

- **Difficulty presets:** *Explorer* (relaxed fuel, forgiving landings, assists on), *Pilot* (realistic fuel, assists optional),
  *Veteran* (assists limited, full heating/structural model).
- **Hazards:** overheat, over-g, over-q, crush depth, radiation (Jupiter's belts: dose meter, ship shielding rating), running out
  of reaction mass, rough/crash landing, **collision** with moons/rings at tiers ≤ 3 (rings are *very* thin and sparse at ship scale: contact is
  a rare, dust-rattling event, not a wall).
- **Recall:** the ship returns to a safe orbit around the last body with a plain-language **"what happened"** card and the
  option to keep or restore the pre-event state. Never a hard fail screen.

---

## 16. Roadmap (do in order; each ends committed, pushed, tests green)

Effort: S ≈ ½–1 day, M ≈ 1–3 days, L ≈ 3–7 days, XL ≈ 1–3 weeks (focused sessions).

**F0 — Orientation and skeleton (S).** Read `docs/time-machine.md`, `docs/plan-solar-system-zoom.md`, `src/lib/solar/*`, `src/lib/astro/*`.
Add `/fly` route behind a feature flag, a bare three.js canvas reusing `SolarScene` ideas, sitemap/OG, and `docs/fly/` stubs.
*Done when:* `/fly` loads, shows the Solar System at true scale, tests/build green.

**F1 — Data layer (M).** `bodies.ts` with every field in §8.1 tagged `verified:false` and a `source` string; generator for `docs/fly/bodies.md`; unit tests
for shape/units/consistency (e.g. g = GM/R² within ±1 % of the stated g, escape speed formula, synodic/sidereal checks).
*Done when:* every body renders its radius at true scale and the reality panel lists unverified fields.

**F2 — Ephemeris and frames (M).** Wrap astronomy-engine incl. Galileans; implement mean-element models for the missing moons and
dwarf bodies; IAU rotation models; `frames.ts` with round-trip tests (inertial↔body-fixed↔ENU to < 1 mm at 1 AU relative error budget).
*Done when:* positions match astronomy-engine within tolerance and rotation phases match Earth's GMST and Mars's `marsOrientation`.

**F3 — Ship flight model v1 in vacuum (L).** 6-DOF integrator, thrusters/RCS, gravity with SOI hand-off, patched-conic *display*, the
speed tiers 3–6 with auto-brake bubbles, nav sphere + minimal HUD, procedural placeholder hull (box + nacelles).
*Done when:* a circular LEO has the right period within 0.1 % (test), the ship can fly Earth→Moon at 0.1 c without losing precision, and tier changes are smooth.

**F4 — The ship, properly (L).** Procedural Wayfarer (§7.2), LODs, lights, materials, hull states, plume VFX; optional glTF path (§7.3).
*Done when:* ship passes the triangle/draw-call budgets, looks right in chase and cockpit views, screenshots reviewed.

**F5 — Atmospheres and flight in air (L).** `atmosphere.ts`, `aero.ts`, `thermal.ts`, scattering LUTs for Earth and Mars, sky/sunset, reentry glow, hover tier 1 and atmospheric tier 2,
buffet and wind v1 (jets, shear). *Done when:* an Earth reentry heats, brakes and survives with the heat shield; Mars descent has a butterscotch sky and a chute-free powered landing is possible.

**F6 — Terrain and landing (XL).** Cubed-sphere CDLOD, workers, procedural + stamp heights for Moon and Mars, craters, albedo/normal rules,
contact model (custom, optionally Rapier locally), landing gear, dust/plume VFX, auto-land assist.
*Done when:* you can land on the Moon at Tranquility and Mars at Jezero at the real coordinates ⚠, with stable contact and 60 fps on `high`.

**F7 — All worlds, v1 environments (XL).** Venus (heat, crush, super-rotation, deck), Mercury, Jupiter (bands, GRS, depth limit, lightning, radiation dose), Saturn (rings, hexagon),
Titan (haze, lakes, dense air flight), Io/Europa/Ganymede/Callisto, Uranus/Neptune, Pluto/Charon/Triton, Ceres/Vesta, small bodies (§10.4).
*Done when:* each body has its sky, light, wind/turbulence layer, material palette and hazard set from §8, with the reality panel complete.

**F8 — Clouds, weather and spectacle (L).** Volumetric clouds, dust storms (tied to `mars.ts`), lightning, auroras on Jupiter/Ganymede/Earth, eclipses and ring shadows, eye adaptation, lens flares.

**F9 — Controls, HUD, map, autopilot (L).** All inputs (§13), gamepad, touch, "Go to…" autopilot, auto-orbit/land, map view, photo mode, hide-interface, tutorial.
*Done when:* a new player completes Orbit → Moon landing without help; reduced-motion and keyboard-only passes.

**F10 — Audio (M).** Procedural engines/wind/reentry/surface, opt-in, loudness limiter, captions.

**F11 — Polish, performance, reality (L).** Tier tuning on real devices (needs Gee's phone/PC feedback), memory budgets, load-time streaming, save/load, missions and sites (§14), reality panel text, OG image, docs.

**F12 — Release (S).** Full CI-equivalent: `tsc`, `eslint src`, `vitest`, `next build` with Sanity vars unset, Playwright desktop + mobile, bundle-size check (the `/fly` chunk
must not enlarge `/stars` or the home page). Ask Gee whether to open a PR (use the repo PR template if present).

### Later (v2+)
Walkable ramp and interior; aerostat/airship module for Venus and Titan; moons orbiting Jupiter/Saturn rendered with accurate small-moon swarm; WebGPU terrain/cloud compute;
galaxy hand-off ("leave the Solar System"); real **DEM imports** for Earth/Moon/Mars; replays and ghost runs; a shareable "flight card" image with date, place and speed; mod hooks for ship skins.

---

## 17. Testing and verification

**Unit (Vitest, pure code):**
- Orbital mechanics: circular LEO period vs analytic (≤ 0.1 %); energy and angular-momentum drift < 10⁻⁶ over 10 orbits; Hohmann transfer reaches target apoapsis within 1 %; SOI hand-off conserves
  heliocentric position/velocity within 1 mm and 1 µm/s.
- Frames: round-trip identities, pole/rotation values vs known (Earth GMST, Mars MTC from the repo), local-horizon vectors.
- Atmosphere: density(h) monotone and continuous; surface values match the tables; scale heights reproduce the exponentials; Sutton–Graves matches a hand calculation.
- Aero/thermal: terminal velocity on Earth/Mars/Venus/Titan from drag balance vs analytic; peak heating ordering (Earth > Mars for the same entry).
- Landing: contact model energy-dissipation bounds; touchdown classification table.
- Speed tiers: tier caps, auto-brake never overshoots, step clamps near bodies, 1000 c stays finite and ends at the target.
- Terrain: determinism (same seed ⇒ same tile), edge-matching between neighbours (< 1 mm), height ranges per world, LOD error monotone.
- Wind: deterministic by (seed, date, place); statistics (mean/variance) match configured intensities.
- Data: **every `bodies.ts` field has a unit and a `verified` flag; a test fails if a numeric field lacks a `source`.**

**Integration/e2e (Playwright, software GL, `PW_CHROMIUM=/opt/pw-browsers/chromium`):**
- `/fly` boots, shows the ship and the tier dial, no console errors; keyboard flight changes speed; tier switch captions appear.
- Land on the Moon (scripted assists) and see "landed"; Mars entry survives with a heat shield; Venus without enough shielding triggers the recall card.
- Hide-interface and pause flow; reduced-motion run; gamepad via the mocked API; touch layout on a Pixel 7 profile; **axe** on the HUD/menus.
- **Performance smoke:** frame time budget checked on the software renderer *relative to baseline* (not absolute), memory growth over 60 s.
- **Visual regression:** curated screenshots (Earth orbit, Mars sky, Venus deck, Jupiter bands, Saturn rings, Titan haze, Moon pad) compared with a tolerance; updated only deliberately.

**Manual checklist for Gee (needs real hardware):** feel of controls, motion comfort, thermals/battery on a phone, loudness, whether the ship "reads" as big.

---

## 18. Data to verify, and where to verify it

Nothing in §8 may be presented as fact until checked. The verification log is `docs/fly/verification.md`; each line: value, source, date checked, who.

| Group | Needs checking against |
|---|---|
| Radii, masses (GM), gravity, rotation periods | IAU/NASA planetary fact sheets, IAU WGCCRE report; JPL SSD physical parameters |
| Pole orientation, prime meridian | IAU Working Group on Cartographic Coordinates and Rotational Elements (latest report) |
| Atmosphere composition, pressure, scale height, temperature profiles | NASA planetary fact sheets; Earth: US Standard Atmosphere 1976; Venus: VIRA; Mars: Mars Climate Database / Viking-Pathfinder-MSL data; Titan: Huygens HASI; Jupiter/Saturn: Galileo/Cassini probes |
| Wind speeds and jet structure | Voyager/Cassini/Juno/Hubble literature, MSL/Perseverance weather (Mars), Venus Express/Akatsuki |
| Terrain landmark coordinates and heights | USGS gazetteer of planetary nomenclature; MOLA, LOLA, Magellan, Cassini RADAR, New Horizons |
| Heating constants (Sutton–Graves k) | Sutton & Graves (1971) and later Mars-entry updates |
| Moon/dwarf orbital elements | JPL SSD satellite and small-body databases; Meeus (low-precision) |
| Ring radii and thickness | Cassini ring papers, NASA fact sheets |
| Radiation dose around Jupiter | Galileo/Juno energetic particle data (qualitative only in v1) |

Policy: **while a value is unverified, the reality panel shows an "unverified" badge** and the doc names the check still owed. DEM or texture
imports record their dataset name and licence. Any value Gee confirms flips `verified` to true in one commit.

---

## 19. Constraints, risks and how each is handled

| Risk | Impact | Mitigation |
|---|---|---|
| **Sandbox reaches only npm** (no NASA, no model sites, no papers) | cannot download ships, textures, DEMs, or verify data | procedural ship and surfaces; **bake pipeline ready for Gee-supplied data**; verification log; unverified badges |
| Float precision across 10¹⁶ range | jitter, z-fighting, lost precision at 1000 c | float64 sim, camera-relative render, two-pass depth, adaptive steps (§5) |
| Planetary-scale terrain performance | pop-in, cracks, memory | CDLOD with geomorphing, worker generation, LRU budgets, tier governor |
| Mobile GPUs and memory | crashes, overheating | quality tiers, pixel-ratio governor (already proven), no volumetrics on `low`, texture caps, `static` fallback |
| Software-GL CI and sandbox (slow) | flaky e2e | e2e uses small viewport, low tier, `?q=minimal` query, relative perf checks, long timeouts |
| Scope: this is a very large project | never finishes | strict phases F0–F12, every phase shippable; v1 = F0–F9 core worlds, F7 can ship world by world |
| Licensing of assets | legal | original procedural ship; any model requires a recorded licence; Matrix craft are not copied |
| "KSP-style" expectations vs forgiving game | disappointment | clear difficulty presets; assisted by default; realistic fuel optional |
| Motion sickness / photosensitivity | harm | comfort settings, flash limits, reduced-motion path (§13.3) |
| Audio annoyance | UX | opt-in, limiter, captions |
| Streaming misses (holes, popping, outrunning the loader) | broken world, frustration | parents stay resident; geomorphing; readiness-gated speed tiers; hysteresis; the streaming lens; tests in `12` §12 |
| Memory growth / leaks over long sessions | crashes on phones | ResourceTracker, per-tier byte budgets, pressure levels with automatic downgrade, 10-minute soak test in CI |
| Bundle size | slow `/stars` and `/` | `/fly` is a separate route chunk, lazy imports for workers/WASM, no shared growth; size checked in F12 |
| Data wrongly presented as fact | trust | verified flags, reality panel, doc log, tests that require a `source` |
| Browser limits (`requestFullscreen`, gamepad, pointer lock) | partial features | feature detection with graceful fallbacks, documented per browser |
| iOS Safari quirks (WebGL memory, no fullscreen) | crash | cap resolution and textures on iOS, hide unsupported buttons |

**Sandbox facts to remember:** only npm is reachable; never `pkill -f "next dev"` (kills your own shell; use `pgrep -f "[n]ext dev -p PORT"` and
kill by pid); Playwright needs `PW_CHROMIUM=/opt/pw-browsers/chromium`; run e2e against a **production build** (`next build` then `next start`) for
stable timing; software WebGL is slow, so the 3D scene already starts at half pixel ratio on SwiftShader.

---

## 20. Definition of done (v1)

- `/fly` is a route; the page boots in under 3 s on a mid-range laptop (shell) and streams the rest.
- A new player can: take off or start in orbit, change speed tiers, fly to the Moon, land, take off, fly to Mars, descend through its
  sky and land, then cross to Jupiter and Saturn and feel their atmospheres, all at true scale and for the real date.
- Every body from §8.1 exists, at its real size and place, with its own sky/light, wind/turbulence and surface palette.
- The Wayfarer is large, believable, damage-aware and works in chase and cockpit views; the ship is original or has a recorded licence.
- Heat, g-load, crush depth, radiation and fuel behave as specified and recall instead of hard failing.
- Hide-interface, pause, reduced-motion, keyboard-only, gamepad and touch all work; accessibility checks pass.
- Only what is near and needed is loaded: a Moon-only session fetches no other world's code or data, `/fly` first load meets the §9 budgets in `docs/fly/12-streaming-and-loading.md`, resident memory stays under the tier budget in a 10-minute soak, and flying away from a world returns GPU object counts to baseline.
- Unit + e2e (desktop + mobile) green; build and lint clean; no console errors; performance tiers behave; bundle budgets respected.
- Every number shown to the player has a source or is labelled approximate/unverified/artistic, and the verification log is current.

---

## 21. Questions for Gee (they change the build)

1. **Ship:** are you happy with an original, procedurally built heavy hover-freighter, or will you supply a licensed glTF? (If you have a specific one, send the file and licence.)
2. **Data:** can you supply public-domain DEMs/textures (Moon, Mars, Earth at least) for the bake pipeline, or is fully procedural terrain acceptable for v1?
3. **Realism dial:** default to *Explorer* (assisted, relaxed fuel) or *Pilot*?
4. **Speed above c:** is the "Light 1–1000 c" sightseeing tier acceptable as a clearly-fictional mode, with a toggle to hide it?
5. **Scope order:** which worlds first after Earth–Moon–Mars? (Suggested: Venus, Jupiter, Saturn/Titan.)
6. **Devices:** primary target phone, laptop, or both? (This sets the default quality tier and the touch-control effort.)
7. **Audio:** procedural-only is the plan; do you want licensed music later?
8. **Persistence:** local-only save (recommended) or a server-side profile later?
9. **Name:** keep *Wayfarer* or choose another?

---

## 22. Pitfalls carried over from `/stars` (do not repeat)

- Hydration: anything time-dependent in SSR'd components must render only after mount.
- A disposed WebGL context cannot be reused (React StrictMode mounts twice in dev): **create a fresh canvas per scene**.
- A hidden fixed layer can sit above header controls: give header elements `position: relative; z-index: 1`.
- Chakra `Tab`/`Button` roles: do not put `role="listitem"` on buttons; give icon-only/short-label buttons an `aria-label` that matches the full name.
- Software GL stalls the main thread: start at a lower pixel ratio, redraw only when something changes.
- `pgrep -f "next-server"` matches its own shell command: use `[n]ext-server`.
- The `?t=` share parameter is a **Julian Date**, not an ISO string.
- Never skip or disable a failing test to get green; fix the cause.
