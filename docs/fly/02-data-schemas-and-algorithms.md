# `/fly` — data schemas and algorithms

Companion to `docs/plan-fly.md`. This is the contract between the modules in §2/§5 of the master plan: the TypeScript shapes, the
algorithms (pseudocode precise enough to implement and test), and the invariants. Units are **SI (metres, seconds, kilograms, kelvin,
pascals, radians)** inside `lib/fly`; angles are degrees only at data-entry boundaries (`bodies.ts` converts once).

## 1. Body data (`bodies.ts`)

```ts
export type Reality = 'measured' | 'derived' | 'artistic';
export interface Sourced<T> { value: T; unit: string; source: string; reality: Reality; verified: boolean; note?: string }

export interface BodyData {
  id: BodyId;                              // 'Sun' | 'Mercury' | … | 'Moon' | 'Io' | … | 'Ceres'
  kind: 'star' | 'planet' | 'moon' | 'dwarf' | 'asteroid' | 'ring';
  parent: BodyId | null;                   // Sun for planets, planet for moons
  radius: Sourced<number>;                 // mean radius, m
  radii?: { a: number; b: number; c: number };  // triaxial (irregular bodies), m
  gm: Sourced<number>;                     // m³/s²
  j2?: Sourced<number>;                    // oblateness for gravity.ts
  rotation: { poleRaDec: Sourced<[number, number]>; w0: Sourced<number>; rate: Sourced<number>; locked?: boolean };
  atmosphere?: AtmosphereModel;            // §3
  surface?: SurfaceModel;                  // §6 (null for gas/ice giants: has `deck` instead)
  deck?: GasDeckModel;                     // gas giants: cloud-top reference level & layers
  hazards: Hazard[];                       // 'heat' | 'crush' | 'radiation' | 'dust' | 'cold' | 'vacuum' | …
  wind?: WindModel;                        // §4
  sky: SkyModel;                           // scattering coefficients, sun disc, stars visibility
  palette: BiomePalette;                   // artistic surface colours (reality: 'artistic')
  landmarks: Landmark[];                   // named places with lat/lon/size/height (⚠ verify)
  ephemeris: { source: 'astronomy-engine' | 'mean-elements' | 'kepler'; accuracy: 'precise' | 'good' | 'approximate' };
}
```

**Invariants (tested):** every numeric field is `Sourced` (a test fails otherwise); `gm/radius²` is within 1 % of any stated `g`; a moon's
`parent` exists; `rotation.rate` sign encodes retrograde; `verified` defaults to `false` and flips only through `verification.md`.

## 2. State vectors and frames (`frames.ts`)

```ts
export type V3 = [number, number, number];          // float64
export interface State { r: V3; v: V3; q: Quat; w: V3 }  // position, velocity, attitude, angular velocity
export interface FrameRef { body: BodyId | 'Sun'; kind: 'inertial' | 'fixed' }
```

- **Heliocentric inertial (HCI):** ecliptic J2000, metres. **BCI:** body-centred inertial (same axes). **BCBF:** body-fixed, rotated by
  `R_z(W) R_x(90°−δ) R_z(90°+α)` from the IAU pole (α, δ) and prime-meridian angle `W = W0 + rate·d`.
- **ENU (local horizon):** east, north, up at the ship's sub-point on the *reference sphere* (spheroid for Earth; sphere elsewhere).
- Conversions are pure functions `toBCI(state, frames, jd)` etc.; **round-trip error < 1 µm and 1 nm/s** at 1 AU magnitude (tested by
  property tests on random states).

## 3. Atmosphere model (`atmosphere.ts`)

```ts
export interface Layer { h0: number; h1: number; T0: number; lapse: number /*K/m*/; compositionId: string }
export interface AtmosphereModel {
  surfacePressure: Sourced<number>;        // Pa
  layers: Layer[];                         // piecewise T(h); ρ via hydrostatic integration + ideal gas
  molarMass: Sourced<number>;              // kg/mol (mean)
  gamma: number;                           // for speed of sound
  topAltitude: number;                     // above this: vacuum (ρ = 0)
  scattering: { rayleigh: V3; mie: V3; mieG: number; absorbers: Absorber[]; hazeScaleHeight: number };
  clouds?: CloudModel;
}
```

**Algorithm — density at altitude h (m):**
```
T(h) = piecewise linear from layers (clamped)
p(h): integrate dp/dh = −(p M g(h) / (R_u T(h)))  over layer boundaries analytically (isothermal or constant-lapse closed forms)
ρ(h) = p M / (R_u T)       // ideal gas; Venus/Titan: multiply by compressibility factor Z(p,T) from a small table
a(h) = √(γ R_u T / M)      // speed of sound, for Mach and sonic boom
```
`g(h) = GM/(R+h)²`. Tables are precomputed once into 1,024-entry arrays per body for O(1) lookup with linear interpolation.

**Invariants:** ρ continuous and strictly decreasing with altitude (except in inversions: tested per body), `p(0) == surfacePressure`,
`ρ(topAltitude) → 0`. For gas giants the reference level is **1 bar** (documented), with depth below it integrated to the crush limit.

## 4. Wind and turbulence (`wind.ts`)

```ts
export interface WindModel {
  jets?: { lat: number /*rad*/; speed: number /*m/s, + = prograde*/; width: number }[];      // zonal profile
  superRotation?: { speedAtTop: number; profile: (h: number) => number };                       // Venus
  surface: { mean: number; gustFactor: number; diurnal?: number };
  turbulence: { intensity: number /*0..1*/; integralScale: number /*m*/; roughness: number };
  vortices?: { kind: 'dustDevil' | 'storm' | 'spot'; rate: number; radius: [number, number]; strength: number }[];
}
```

**Algorithm — wind vector `w(x, t)`** (deterministic from `(bodyId, seedDate, x, t)`):
```
w = zonal(lat, h)                                  // jets × altitude profile, east-west
  + boundaryLayer(h, surfaceRoughness)             // log-law shear near ground
  + curlNoise(x / L1, t / T1) · σ_large            // coherent eddies, divergence-free
  + curlNoise(x / L2, t / T2) · σ_small            // finer eddies (Kolmogorov-ish −5/3 spectrum via 3 octaves)
  + Σ vortices (Rankine/Lamb–Oseen profiles placed by a seeded Poisson process on a lat/lon/day grid)
σ_* scale with `turbulence.intensity` and with local convective heating (day side, surface type).
```
Time dependence uses **domain-warped phase advection** so fields evolve smoothly; `x` is body-fixed so the same place on the same
date is repeatable. **Cost target** < 0.1 ms per query batch (ship hull sample points, 8 per frame).

**Outputs:** (a) velocity for aero forces, (b) turbulence kinetic energy for camera shake and buffet, (c) visual advection fields (dust, cloud streaks).

## 5. Aerodynamics and heating (`aero.ts`, `thermal.ts`)

```
v_rel = v_ship − (w(x, t) + Ω_body × r)           // air-relative; Ω×r removes the rotating-atmosphere speed
M = |v_rel| / a(h);   q = ½ ρ |v_rel|²
α, β = angle of attack, sideslip in body axes
F_aero = q · S · ( C_D(M, α)·(−v̂) + C_L(M, α)·l̂ + C_Y(β)·ŷ )                      // coefficients from tables, §below
M_aero = q · S · c · ( C_m(α) + C_mq·(q̂·c/2v) ) + r_cp × F_aero                    // pitch stability from centre-of-pressure offset
q̇_stag = k_gas · √(ρ/R_n) · |v_rel|³                                                // Sutton–Graves (W/m²)
T_wall:  C_th · dT/dt = ε_abs·q̇_stag·A_eff − ε σ T⁴ − h_c (T − T_amb)             // radiative equilibrium + convective term (Venus)
shield:  dm_ablated/dt = max(0, (q̇ − q̇_crit)) / H_abl ; shield thickness reduces insulation until 0 → hull exposed
```
**Coefficient tables (v1, tuned to feel):** `C_D` rises from ≈ 0.8 (subsonic) to 1.3 (transonic) and falls to ≈ 1.0 (hypersonic); `C_L` peaks at
α ≈ 25–35°; `C_m` gives a restoring moment for belly-first pitch; low-speed handling uses a lift-curve slope scaled so the ship *can* fly at 150 m/s (it is a hover-freighter,
not a glider). **All coefficients live in `ship.ts` as data** and are exercised by terminal-velocity and trim tests.

**Limits and damage:** `q_max` (max-Q), `n_max` (g), `T_wall_max`, `p_crush` (external pressure rating) as in `ship.ts`; each has a **warning band** (80 %), a
**damage band** (100–120 %, hull damage accrues) and a **recall band** (> 120 %). Damage state is monotone until repaired by a safe landing or recall.

## 6. Gravity, orbits and the tier controller

**Gravity (`gravity.ts`):** `a = −GM r̂/r² + a_J2 + Σ third-body tidal`; J2 term `a_J2 = (3/2) J2 GM R²/r⁴ [ (5 z²/r² − 1) x/r, (5 z²/r² − 1) y/r, (5 z²/r² − 3) z/r ]` in body-fixed axes.

**Integrator (`integrator.ts`):** velocity-Verlet (symplectic) for coasting; RK4 when thrusters or aero are active; sub-step `dt = min(1/120 s, ε·√(r³/GM), time to SOI/contact)`. Total energy drift in an unpowered, unperturbed orbit
must stay `< 1e-9` relative per orbit (test).

**SOI hand-off (`patched.ts`):**
```
for each candidate body B near the ship (parent chain first, then children whose SOI contains r):
  if |r − r_B| < 0.98·SOI_B and currently outside   → enter B   (r_B, v_B from ephemeris at this instant)
  if |r − r_B| > 1.02·SOI_B and currently inside    → leave B → parent
hand-off:  r' = r − r_B ,  v' = v − v_B   (enter)    |    r = r' + r_B ,  v = v' + v_B   (leave)
```
Hysteresis (2 %) prevents chattering. **Test:** a ship in a circular Earth orbit hands off to the Sun and back with position error < 1 mm and velocity error < 1 µm/s.

**Tier controller (`modes.ts`):**
```
interface Tier { id: 1..6; cap: (ctx) => m/s; gravity: 'full' | 'dominant' | 'off'; collisions: boolean; step: 'fixed' | 'adaptive' }
effectiveCap = min( tier.cap, bubbleCap(nearestBody, altitude), userLimit )
bubbleCap(B, h) = interp( log h ; [surface:  150 m/s,  1·R: 8 km/s,  3·R: 3,000 km/s,  10·R: 0.1 c ] ) // smooth, per-body radius scaled
autoBrake: if (distance_to_surface / speed) < t_brake(speed) then drop tier & command retro-burn along −v̂ (never < 0.3 × g)
```
**Light tier (6)** moves the ship along a *straight chord* with the speed profile `v(s)` (ease-in/out) and an **exclusion sphere** `r_ex = max(3 R_B, 1,000 km)` around each body the chord would pass inside: the path **bends** around it
(great-circle detour) instead of colliding. **Tests:** no path from any start to any `Go to…` target intersects a body; arrival time within one frame of `d/v`; position stays finite at 1000 c for a 120 AU trip.

## 7. Ship model (`ship.ts`) and contact (`contact.ts`)

```ts
export interface Thruster { id: string; pos: V3; dir: V3; thrust: number /*N, vacuum*/; isp: number; throttle: [number, number]; spool: number; plume: PlumeSpec; kind: 'main'|'rcs'|'hover'|'retro' }
export interface Leg { attach: V3; axis: V3; length: number; k: number; c: number; footRadius: number; mu: number }
export interface ShipSpec { mass: number; inertia: M3; cog: V3; thrusters: Thruster[]; legs: Leg[]; area: number; refLength: number; limits: Limits; shield: ShieldSpec; fuel: { mass: number } }
```
**Contact algorithm (per sub-step):** for each leg foot, sample terrain height and normal (`terrain/sample(lat, lon)` in the local tile); penetration `d`; force `F_n = max(0, k d − c ḋ)`; friction `F_t = −μ F_n · tanh(|v_t|/v_ε) v̂_t` (regularised Coulomb) with `μ` from the surface material; torque from `r × F`; **rest/sleep** when |v|, |w| < thresholds for 0.5 s on four feet (reduces CPU and jitter).
Optional **Rapier** local world (§6.2 of the master plan): same inputs/outputs; selected by a flag so both paths share tests.

## 8. Terrain (`terrain/*`)

**Tile addressing:** `(face 0–5, level L, x, y)`; tile centre in unit-sphere coordinates via the standard cube→sphere mapping `p = c / |c|` (use the *equi-angular* mapping `tan(π/4 · u)` to even out area).
**Screen-space error:** `ε = (geometricError / distance) · (viewportHeight / (2 tan(FOV/2)))`; split when `ε > τ` (τ = 2 px on `high`, 4 px on `low`); merge with hysteresis (`τ/1.5`).
**Height function** `H(lat, lon)` = `DEM(lat, lon)` (if present at that level) `+` `Stamps(lat, lon)` `+` `Fractal(lat, lon; spectrum)` `+` `Craters(lat, lon; SFD, age)`:
```
Fractal: Σ_{i<N} A·gain^i · ridged/billow(domainWarp(p·freq·lac^i)) , N depends on level, amplitude spectrum from SurfaceModel.roughness
Craters: seeded Poisson in lat/lon cells per size bin; depth d = α D^β (simple→complex transition at D_t); rim height and ejecta falloff; degradation f(age) smooths the profile
Stamps:  analytic features (Olympus Mons, Valles Marineris profile, Hellas basin, Maxwell Montes, …) blended with smoothstep masks
```
**Seams:** shared edge samples derive from the same function at the same lat/lon so adjacent tiles match exactly; skirts hide LOD differences; geomorph `lerp(coarse, fine, t)` over the final 30 % of the split range.
**Worker protocol:** `postMessage({ id, face, level, x, y, resolution })` → `{ id, heights: Float32Array, normals: Int8Array(pack), min, max }` transferable; a main-thread LRU holds the tiles with a byte budget.
**Determinism test:** same inputs ⇒ byte-identical output across runs and platforms (no `Math.random`; seeded integer hash).

## 9. Sky and atmosphere rendering (`sky/*`)

- **Precompute** (per active world, at load or tier change): transmittance LUT (256×64), multiple-scattering LUT (32×32), sky-view LUT (192×108) per frame, aerial-perspective froxel volume (32×32×32) at low resolution.
- **Inputs:** `AtmosphereModel.scattering` (Rayleigh `β_R(λ)`, Mie `β_M` and asymmetry `g`, absorber cross-sections), planetary radius, atmosphere top, sun direction and angular radius, ground albedo.
- **Sun disc:** angular radius `asin(R_sun/d)`; limb darkening; irradiance `E = E_earth/(d_AU²)`. Venus's and Titan's dense haze scales the sun to an ambient glow (no disc at the surface).
- **Colour per world is an output**, not an input; the test checks *qualitative* results: Earth zenith blue/horizon pale; Mars zenith butterscotch with blue near the sun at sunset; Venus orange diffuse; Titan orange-brown.
- **Cloud decks:** 2-D scrolling flow textures on gas giants (advected by the zonal profile), raymarched noise volumes on Earth/Mars (≤ 32 steps with blue-noise jitter + TAA).

## 10. Input, assists and the control law

`input/*` normalises devices into `ControlState { pitch, yaw, roll, tx, ty, tz, throttle, tierDelta, buttons }` in [-1, 1] with dead zones, expo curves and per-device sensitivity.
**Assist controllers** are PD loops on attitude error (`τ = Kp e + Kd ė`, saturated by RCS torque), hover assist is a PI on `(h_target − h)` feeding vertical thrust with feed-forward `m g`, auto-land is the suicide-burn solver of `01-physics-numbers.md` §6
with a **terrain scan** (3×3 grid ahead of the descent path, flatness metric `σ_h`, slope limit 8°) choosing the touchdown point.

## 11. Save/load and settings

`state.ts` stores a versioned JSON `{ v, bodyId, state, tier, fuel, damage, settings, dateMode }` in `localStorage` (**every access wrapped in try/catch**; the page must work with storage blocked). Validation on load rejects non-finite numbers
(same lesson as `?t=` and bookmarks). A **share link** carries only coarse state (body, altitude band, date as a Julian Date, tier) — never the whole save.

## 12. Determinism and reproducibility rules

All random content derives from `hash(bodyId, seedDate, tileId, featureId)` with a documented integer hash; no `Date.now()` or `Math.random()` inside generators. Ephemeris queries take an explicit JD. This makes screenshots, e2e and bug reports reproducible.
