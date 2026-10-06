# `/fly` — streaming, residency and "load only what is near and needed"

Companion to `docs/plan-fly.md`. Gee's direction: **plan the whole game so only near and needed things are loaded.** This document makes that a first-class system
(`lib/fly/stream/`) with rules, budgets, algorithms, tickets and tests. It also changes how the speed tiers behave (§7) because you cannot fly faster than the world can load.

**Principle.** *Nothing is resident unless a defined reason keeps it resident.* Every asset (code, data, texture, mesh, terrain tile, lookup table, sound, ship) has an owner, a
cost, an interest rule (why it is needed now), a hysteresis band (so it does not thrash) and an eviction path. The default state of everything in the universe is **unloaded**.

What exists today and is kept: `/fly` and `/stars` load three.js and the scene code with dynamic `import()` only when the page needs them; the Kestrel is generated in code (zero
downloads); textures are procedural; the 3D system view builds orbit lines lazily; the Solar System overlay loads only when opened. The design below generalises that discipline to
a whole game.

---

## 1. Why this matters here (numbers)

| Concern | Without streaming | With the rules below |
|---|---|---|
| Terrain for one body at 0.25 m spacing | every tile of Mars: `6 × 4^L` tiles (hundreds of millions at the finest level) | only tiles within the screen-space-error budget: **~300–900 tiles** (§4) |
| Planetary textures for 8 planets + ~60 moons | hundreds of MB | far bodies are sprites from a **KB-sized** table; one body's textures resident |
| Atmosphere LUTs | 8–10 worlds × several MB | **one** active set (the current world), the rest not built |
| Ships | 3 hulls + interiors | the **active** hull, plus a docked/nearby one only when in range |
| First paint on `/fly` | whole engine | **shell + hangar only** (budget in §9) |
| Memory on a phone | out-of-memory crash risk | hard budgets per quality tier and automatic downgrade (§8) |

Rough per-tile cost used for sizing (computed): a 65×65 height tile = 4,225 samples × 4 B = **16.9 KB**, plus packed normals 16.9 KB → **~34 KB**; 600 tiles ≈ **20 MB**.
A 256×256 RGBA texture tile with mips ≈ **350 KB** uncompressed; as BC7/ASTC ≈ **87 KB**: 300 tiles ≈ **26 MB** compressed (105 MB if left uncompressed: so compressed
textures are mandatory on the terrain path).

---

## 2. The model: interest → priority → residency

### 2.1 Residency states
```
UNLOADED → REQUESTED → LOADING → RESIDENT → (EVICTING) → UNLOADED
                 ↑          └─ cancelled when interest disappears before it lands
         PINNED (cannot be evicted while a system holds it: e.g. the active ship, the current body's core data)
```
A `Streamable` has: `id`, `kind`, `bytes` (estimated, then actual), `deps` (other streamables), `load(signal)` (cancellable), `unload()` (must free GPU and JS memory),
`priority(ctx)` (≥ 0 when wanted, 0 when not), `hysteresis` (the radius multiplier before eviction, default 1.3), `ownerTier` (which quality tier first needs it).

### 2.2 Interest sources (what makes something "needed")
| Source | Examples |
|---|---|
| **View**: the camera frustum and screen coverage (angular size) | a planet disc 12 px wide needs a sphere + a small texture; 2 px needs only a sprite |
| **Distance and SOI**: where the ship is | the current body's terrain, atmosphere and sky LUTs; its moons only inside its sphere of influence |
| **Predicted path**: where the ship will be in `T` seconds (§6) | tiles ahead along the velocity vector; the destination body when autopilot is set |
| **Intent**: the player's target / map selection / mission | pre-warm the target world's core data when selected |
| **Mode**: hangar, flight, map, photo | the hangar needs the ship and a floor, nothing else |
| **System state**: audio on/off, quality tier, reduced motion | no audio graph when sound is off; fewer LUT bands on `low` |

### 2.3 Priority function (deterministic, unit-tested)
```
priority = interest × urgency × (1 / (1 + cost_penalty))
interest  = max over sources of  s_i · w_i                      (0 when out of range, with hysteresis)
urgency   = 1 / max(t_arrive, t_min)  (seconds until it would be visible / needed, from the predicted path; t_min = 0.25 s)
cost_pen  = bytes / bytes_ref  (large assets must be needed more to be worth it)
```
The scheduler pops the highest priority, respects **per-kind concurrency** (e.g. 6 tile fetches, 2 texture decodes, 1 LUT build, 1 code chunk) and the **frame budget**
(≤ 2 ms main-thread time per frame spent on uploads/binding; heavy work goes to workers). In-flight loads are **cancelled** when interest drops to zero (AbortController).

### 2.4 Eviction
- Evict when over budget **or** when interest has been below the hysteresis threshold for `grace` seconds (default 5 s; 20 s for cold data kept for fast revisit).
- Order: lowest `priority × recency` first; never evict `PINNED`; prefer evicting *large, cheap-to-reload* items before *small, expensive* ones (cost-aware LRU).
- Eviction **frees real memory**: `geometry.dispose()`, `texture.dispose()`, render targets, workers' buffers, `ImageBitmap.close()`, `URL.revokeObjectURL`, and removes references so the JS
  GC can collect. A `ResourceTracker` (§5.2) owns every GPU object so nothing leaks.

---

## 3. What is loaded, and when (asset taxonomy)

Residency levels per asset class. "Far proxy" means a few bytes/KB of data and a sprite.

| Asset class | Not needed | Far proxy | Mid | Near / needed |
|---|---|---|---|---|
| **App code** | `/fly` route not opened | — | shell + hangar chunk | flight chunk (lazy `import()`), per-world chunk (`worlds/<body>.ts`) loaded on approach |
| **Body data table** (`bodies.ts`) | — | **core table (~10–15 KB)**: id, radius, GM, orbit, colour, rotation: always resident | `BodyDetail` (atmosphere, wind, palette, landmarks) loaded per body on approach/target | the same, pinned while inside its SOI |
| **Planet/moon rendering** | angular size < 0.5 px | point/glow sprite | billboard disc with phase (angular size 0.5–8 px) | lit sphere + atmosphere shell (> 8 px); terrain LOD inside ~3 radii |
| **Atmosphere LUTs** | not in a body's atmosphere influence | analytic rim shell (no LUT) | — | LUT set for the **current** body only (built in a worker), previous set kept until the new one is ready |
| **Clouds / weather** | outside atmosphere | baked low-res texture on the sphere | volumetric only in-atmosphere on `high`/`ultra` | the current world's cloud state; others not generated |
| **Terrain (quadtree)** | beyond ~4 body radii | sphere only | coarse tiles (levels 0–6) | tiles by screen-space error (§4) |
| **Surface textures / materials** | not within the surface bubble | albedo colour only | per-body biome atlas (small) | detail normal tiles near the ship |
| **Rocks, dust, vegetation** | not near ground | — | — | instanced within ~200 m of the ship only |
| **Ships** | not selected | — | hangar: the **selected** hull | in flight: **active** hull only; a second hull only while docked or within ~2.5 km (physics range) |
| **Interiors** (v2) | outside | — | — | only when the camera is inside / hangar view |
| **Stars / Milky Way backdrop** | — | one small baked star buffer (always) | — | — |
| **Audio** | sound off | — | — | procedural graph for the **current** medium (vacuum/atmosphere preset); nothing preloaded |
| **Physics/sim data** | — | analytic ephemeris for visible/targeted bodies | — | active vessel full fidelity; background vessels coarse (1 s steps); wind/turbulence fields only near the ship |
| **UI** | hangar HUD only in the hangar | — | — | flight HUD, map view, settings: separate lazy chunks |

---

## 4. Terrain streaming (the biggest consumer)

- **Cube-sphere quadtree** (see `02` §8): 6 faces; a tile is *wanted* when its screen-space error `ε > τ`; children are wanted when the parent's `ε > τ`; a parent is kept while any child is
  loading (so there is never a hole).
- **Resident set size** (design target): `≈ 6·(visible face fraction)·(screen_px / tile_px)` per level summed over levels. With τ = 2 px, a 1280×720 view and 65-sample tiles,
  **300–900 tiles** are resident (`high`); τ = 4 px on `low` halves it. These are the numbers the budget in §8 is built around.
- **Generation vs fetch:** with no downloadable DEM, tiles are *generated* in workers from the height function (cost ≈ 1–3 ms per tile): the "load" is CPU, not network, so latency is predictable.
  With baked DEM pyramids (optional), tiles are fetched (`public/fly/dem/<body>/<level>/<x>_<y>.bin`, ~34 KB) and cached.
- **Priority:** by `ε`, by distance to the predicted path (§6), and by whether it is *under the ship* (landing safety first: the 3×3 tiles under and ahead of the ship are `urgent`).
- **Texture tiles** mirror height tiles (same quadtree), compressed (KTX2/BC7/ASTC). Mip bias by screen coverage; never upload a level finer than the camera can resolve.
- **Geomorph and skirts** hide LOD seams; **cracks are never visible** because parents stay resident until all four children are ready.
- **Unload:** tiles outside `1.3 × ε`-radius for 5 s are disposed; a tile LRU holds recently used tiles (revisit cache) up to the byte budget.

---

## 5. Architecture (`src/lib/fly/stream/`)

```
stream/
  types.ts         // Streamable, State, Budget, Interest, Kind
  resource.ts      // ResourceTracker: owns GL objects; dispose-all; leak counters
  budget.ts        // byte accounting per kind and per tier; pressure levels (ok / high / critical)
  interest.ts      // interest sources → per-asset scores; hysteresis
  scheduler.ts     // priority queue; per-kind concurrency; cancellation; frame budget
  residency.ts     // ResidencyManager: states, pins, eviction (cost-aware LRU)
  predict.ts       // predicted path samples from the ship state and the autopilot target
  readiness.ts     // "is it loaded enough?" per body and per altitude: feeds the speed-tier controller (§7)
  workers/         // terrain tile worker, LUT builder, texture decoder (transferables only)
  cache.ts         // HTTP cache hints, Cache API + IndexedDB wrapper (guarded; works if storage is blocked)
  debug.ts         // the streaming lens overlay (§10)
worlds/<body>.ts   // per-world lazy chunks: BodyDetail, palette, landmarks, hazards (dynamic import)
```

### 5.1 Code splitting
- **Route chunks:** `/fly` shell → **hangar** chunk → **flight** chunk (sim, camera, input) → **world** chunks (one per body family) → **audio** chunk → **map** chunk. Each boundary is a dynamic `import()`.
- The initial `/fly` chunk contains only the shell and a hangar loader (today `/fly` is ~7 KB of route code plus shared three.js).
- World chunks are **prefetched** with `<link rel="modulepreload">`/`import()` when the destination is selected or the predicted path enters the body's *interest radius* (e.g. 20 body radii).

### 5.2 ResourceTracker (no leaks, ever)
Every `BufferGeometry`, `Texture`, `Material`, `RenderTarget`, `ImageBitmap`, worker and object URL is created through the tracker with an owner id. `unloadOwner(id)` disposes everything it owns.
A dev-only counter exposes **live GL objects per kind** and a test asserts that flying away from a world returns the counts to baseline (no growth).

### 5.3 Workers
A small pool (`min(4, hardwareConcurrency − 1)`): terrain tiles, atmosphere LUT builds, texture decode/transcode, ephemeris batches. Messages use **transferables** (`ArrayBuffer`, `ImageBitmap`) to avoid copies. Workers are
terminated when idle for 30 s on `low` tiers.

### 5.4 Caching and offline (all optional, all guarded)
- **HTTP:** immutable, content-hashed assets with long `Cache-Control`; Brotli; HTTP/2 multiplexing; `Range` requests for large packed tile files.
- **Cache API / IndexedDB:** cache generated or fetched tiles and LUTs keyed by `(body, version, tile)`; **bounded** (default 128 MB, LRU) and wiped when `version` changes. If storage is blocked or full, the game
  simply regenerates: **nothing depends on a cache hit.**
- **Service worker (later):** precache the shell + hangar; runtime-cache world chunks; never block navigation.

### 5.5 Context loss and recovery
On `webglcontextlost` the manager marks all GPU residents `UNLOADED` (CPU-side data kept), pauses, then on `webglcontextrestored` re-requests by priority (view first). Tested with `WEBGL_lose_context`.

---

## 6. Looking ahead (prefetch) without loading the world

- **Predicted path:** from `(pos, vel)` integrate forward `T = clamp(2 × measured_load_latency, 4 s, 20 s)` using the same gravity model (cheap, 8–16 samples); for autopilot, follow the planned path.
- **Cone of interest:** assets whose bounding volume intersects a cone around the path (half-angle grows with time) get a boost proportional to `1/t_arrive`.
- **Distance caps:** prefetch never reaches beyond the **tier's useful horizon** (e.g. at tier 1–2, ≤ 3 km of terrain; at tier 4–6 it concerns *bodies*, not tiles).
- **Target warm-up:** selecting a destination preloads its **core detail** (BodyDetail + world chunk + LUT build) in the background; the **terrain** is requested only when the path enters the approach radius.
- **Turn-aware:** if the ship's angular velocity is high, widen the cone (the view will sweep) but lower the per-tile priority to avoid wasting bandwidth.

---

## 7. Streaming-aware speed tiers (the part that changes gameplay)

You cannot arrive faster than the world can be made. The tier controller (`modes.ts`, `02` §6) now consults `readiness.ts`:

```
v_max(h) = min( tier.cap , bubbleCap(h) , R_ready(h) / T_load )
R_ready(h)   : the radius around the ship (at altitude h) for which the terrain tiles needed at this altitude are RESIDENT
T_load       : measured p90 time to bring a missing tile ring into residency (EMA, clamped 0.3–3 s)
```
- Descending, the allowed speed shrinks as the camera approaches the ground **only as fast as the finer tiles become ready**: a ship at 2 km altitude with a ready radius of 2 km and `T_load = 1.5 s` may move at ≤ ~1.3 km/s horizontally; at 50 m with a ready radius of 200 m it may move ≤ ~130 m/s.
- If the world is *not* ready (cold start on a fast device or a slow one), the existing **auto-brake bubble** engages with the caption **"Slowing for Mars"**, which now means "streaming ahead"; the pilot sees a progress hint ("Mars surface 82 %") only when the wait exceeds 1.5 s.
- **Never a blocking loading screen** during flight: the world is always rendered at the finest *resident* detail. Holes are impossible (parents stay resident); popping is hidden by geomorphing and cross-fade (disabled under reduced motion: instant swap).
- **Light tier (6)** moves between bodies only; it requires the destination's **far proxy + core detail** to be resident before it will commit to the final approach, otherwise it holds at the exclusion radius and waits (usually already warm thanks to target warm-up).

---

## 8. Budgets and automatic downgrade

| Quality tier | GPU memory | JS heap (assets) | Tile cache (RAM) | Terrain τ | Textures | Workers |
|---|---|---|---|---|---|---|
| `ultra` | ≤ 600 MB | ≤ 400 MB | ≤ 160 MB | 1.5 px | 2k atlases | 4 |
| `high` | ≤ 400 MB | ≤ 260 MB | ≤ 96 MB | 2 px | 2k atlases | 3 |
| `medium` | ≤ 250 MB | ≤ 180 MB | ≤ 64 MB | 3 px | 1k atlases | 2 |
| `low` | ≤ 120 MB | ≤ 100 MB | ≤ 32 MB | 4 px | 512 px atlases | 1–2 |
| `minimal` | ≤ 64 MB | ≤ 60 MB | ≤ 16 MB | 6 px | colour only | 1 |

- **Pressure levels:** `ok` (< 70 % of a budget), `high` (70–90 %: stop prefetching, shorten grace times), `critical` (> 90 %: evict aggressively, drop one quality tier, reduce τ).
- **Signals:** accounted bytes, `navigator.deviceMemory` (where present) to pick the *starting* tier, `performance.memory`/`measureUserAgentSpecificMemory` (where available) to confirm, frame time (the existing governor),
  `webglcontextlost`, and the `onmemorypressure`-style cues some browsers expose. None is required; the byte accounting alone is sufficient.
- **iOS Safari:** caps the budget harder (it kills tabs that exceed ~1–1.5 GB total): defaults to `medium` on phones.

---

## 9. Load-time and payload budgets (checked in CI)

| Moment | Budget |
|---|---|
| `/fly` first load (shell + hangar, procedural ship) | **≤ 350 KB gzip JS total** (three.js dominates), no image/data downloads, first paint ≤ 1.5 s on a mid laptop on fast 4G |
| Hangar → arena/flight | ≤ 150 KB additional JS (flight chunk), ≤ 1 s to first frame |
| First world (Earth/Moon) cold | ≤ 400 KB data + ≤ 1.5 s to a flyable ground |
| Each additional world chunk | ≤ 250 KB JS/data (core detail + palette + landmarks), loaded on approach |
| Per-frame streaming work | ≤ 2 ms main thread; uploads ≤ 4 MB per frame (spread over frames) |
| Steady-state memory growth over 10 minutes of flight | ≤ 10 % above the first minute (no leaks) |
| Total bytes for a Moon-only session | **no Mars/Jupiter/Saturn data or code is fetched** (asserted by the network log) |

---

## 10. The streaming lens (debug overlay)

Toggled with `F4` (dev and a "Show streaming" setting): counts per state and kind, bytes against budget, queue length, p50/p90 load time, tile hit rate, worker utilisation, the **predicted path** and
**ready radius** drawn in the world, and a list of "why is this loaded?" (the interest source and score) and "why was this evicted?". It reads the same numbers the manager uses, so it is a true view, not a separate model
(compare the physics lens in `09`).

---

## 11. Tickets (add to `04-roadmap-tickets.md`; the **L-series**)

| Id | Phase | Ticket | Acceptance | Test |
|---|---|---|---|---|
| L0.1 | F0 | `stream/types`, `ResourceTracker`, `Budget` accounting | every GL object created via the tracker; counters exposed | unit |
| L0.2 | F0 | route/code splitting plan: shell → hangar → flight → world chunks; bundle check in CI | `/fly` first-load JS ≤ 350 KB gz; `/stars` and `/` unchanged within 2 % | build script + CI |
| L1.1 | F1 | split `bodies.ts` into **core** (always) and `BodyDetail` (lazy per body) | core ≤ 15 KB; detail chunks load on demand | unit + build |
| L1.2 | F1 | `ResidencyManager` + `Scheduler` (priority, concurrency, cancellation) | deterministic ordering; cancellation frees the slot | unit |
| L1.3 | F1 | eviction: hysteresis, grace, cost-aware LRU, pins | no thrash around the threshold; pinned never evicted | property tests |
| L2.1 | F2 | ephemeris LOD: compute only visible/targeted bodies; far bodies from the core table | planets cheap; unvisited systems cost ~0 | unit (counts) |
| L3.1 | F3 | `predict.ts` (path samples) and interest from the predicted path | prefetch ranks the path ahead above behind | unit |
| L3.2 | F3 | `readiness.ts` and the speed-tier coupling (§7) | v_max respects the ready radius; no overshoot into unloaded space | unit + property |
| L5.1 | F5 | LUT builds in a worker for the **current** world only; swap when ready | no frame stall > 8 ms; old set kept until new one ready | perf smoke |
| L6.1 | F6 | terrain tile quadtree on the residency manager (generation in workers) | resident set ≤ budget; no holes; seams exact | unit + visual |
| L6.2 | F6 | tile cache (RAM LRU) + optional IndexedDB cache with bounded size and version wipe | works with storage blocked | unit + e2e |
| L6.3 | F6 | texture tile streaming with compressed formats; mip bias by coverage | upload ≤ 4 MB/frame | unit + perf |
| L7.1 | F7 | per-world lazy chunks (`worlds/<body>.ts`), modulepreload on approach | Moon-only session fetches no other world's chunk | e2e network assertion |
| L7.2 | F7 | target warm-up (selecting a destination preloads core detail, not terrain) | ready before arrival at 0.1 c | e2e |
| L9.1 | F9 | flight HUD, map, settings as lazy chunks | not loaded in the hangar | e2e network assertion |
| L10.1 | F10 | audio graph built on demand per medium; none when sound is off | no audio nodes with sound off | unit |
| L11.1 | F11 | pressure levels, automatic tier downgrade, context-loss recovery | recovers from `WEBGL_lose_context` | e2e |
| L11.2 | F11 | streaming lens overlay (F4) | numbers match the manager's | e2e |
| L12.1 | F12 | CI budgets: first-load bytes, per-world chunk sizes, steady-state memory (10-min soak) | thresholds in §9 | CI soak test |

---

## 12. Tests (extend `07-test-matrix.md`)

| Test | Pass condition |
|---|---|
| Priority function | monotone in interest and urgency; larger assets need more interest; deterministic |
| Scheduler | respects per-kind concurrency; cancels lost interest; never starves a high-priority item |
| Eviction | no thrash (an item oscillating around the threshold is loaded/unloaded at most once per grace period); pinned items survive; byte budget is never exceeded after eviction |
| Tile set | for random camera poses, resident tiles cover the view with **no holes** and ≤ budget; seams equal within 1 mm |
| Predicted path | tiles ahead of the velocity vector are requested earlier than tiles behind |
| Readiness coupling | the controller never allows a speed above `R_ready/T_load` (property test over random states) |
| Leak check | fly to Mars and away: live GL object counts return to within 2 % of baseline; JS heap growth over a 10-minute soak ≤ 10 % |
| Network | a Moon-only session requests no Mars/Jupiter/Saturn chunks or data; `/fly` first load meets §9 |
| Cache | works with IndexedDB blocked/full; version change wipes; no functionality depends on a hit |
| Context loss | after `WEBGL_lose_context`, the scene recovers and re-streams the view first |
| Reduced motion | LOD swaps are instant (no cross-fade) |
| Mobile profile | on the `low` budget the resident set stays under the cap and the game remains playable (software GL smoke test) |

---

## 13. Risks and answers

| Risk | Answer |
|---|---|
| Streaming bugs show up as holes/popping | parents stay resident; geomorph; property tests for coverage; the streaming lens shows exactly what is missing |
| Fast flight outruns loading | readiness-gated speed (§7); never a blocking load screen |
| Thrashing at an interest boundary | hysteresis bands + grace times; tested |
| Memory leaks over a long session | ResourceTracker + leak tests + soak test in CI |
| Storage blocked / full | everything works without caches; caches are bounded and optional |
| Cold start feels slow | shell + hangar need no downloads; the first world is small; target warm-up and modulepreload hide the rest |
| Complexity | the manager is small, pure and test-heavy; every consumer (terrain, ships, LUTs, audio) uses the same three calls: `request(interest)`, `pin/unpin`, `release` |
