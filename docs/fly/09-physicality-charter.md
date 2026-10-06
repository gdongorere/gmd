# `/fly` — physicality charter: everything real and physical

Companion to `docs/plan-fly.md`. Gee's direction: **"I want everything to feel real and physical."** This charter turns that into binding rules, extra
systems, tickets and tests. It supersedes any place in the other documents where an effect was described as merely cosmetic.

**Honesty first:** "real" means *physically motivated and quantitatively checked against a stated model*, not "indistinguishable from a real spacecraft."
Every departure is listed in §10 and labelled in the UI. Numbers marked ⚠ are recalled from memory and unverified (see `08-…`).

---

## 1. The rules (binding for every ticket)

1. **Physical driver rule.** Every visual, sound, camera motion and haptic must be computed from a simulated physical quantity (pressure, speed, temperature,
   acceleration, irradiance, composition…). **No effect may be driven by a hand-set timer or a distance threshold alone.** If one is needed for a cheat, it is registered in §10.
2. **No magic numbers.** Constants live in `bodies.ts`, `ship.ts`, or `physics-constants.ts` with a unit, a source and a `reality` tag. A lint rule (and a unit test) rejects raw numeric literals above a small allowlist inside `lib/fly/{aero,thermal,atmosphere,wind,contact,gravity}`.
3. **Conservation checks.** Energy, momentum, angular momentum and mass (fuel!) are accounted for in the sim; each has a test that the books balance within a tolerance.
4. **Units and dimensions.** SI throughout, branded types for common quantities (`Meters`, `Pascals`, `Kelvin`, …) in the physics modules so unit mistakes fail at compile time.
5. **Causality.** Cause precedes effect: thrust → acceleration after spool; heating → temperature after thermal lag; impact → sound after propagation delay; plume → dust.
6. **Same laws everywhere.** One physics engine and one atmosphere model drive every world; worlds differ by *data*, not by special-case code.
7. **Determinism.** Reproducible from `(state, date, seed)`; no hidden randomness.
8. **Reality dial.** Settings: **Cinematic** (assisted, forgiving, more dramatic exaggeration within bounds), **Physical** (default: full model, assists on), **Strict** (full model, assists limited, realistic fuel, no recall until after a defined failure). The *physics is the same* in all; the dial changes only assists, tolerances, fuel and drama.
9. **Show the numbers.** A "physics lens" overlay (key `F3`/button) reveals the drivers of what you see: forces, ρ, q, T, g, wind vector, sound speed. Players and testers can verify any effect.
10. **Measured, derived, artistic.** Where something is artistic, it says so in the reality panel and in the code (`reality: 'artistic'`).

---

## 2. The ship as a physical object

| Aspect | Model | Why it feels real |
|---|---|---|
| **Mass properties** | mass, centre of mass and inertia tensor are recomputed from **fuel level, cargo, damage and deployed gear** each step (`ship.ts`) | the ship handles differently half-empty; CoM shift is visible in trim |
| **Propellant** | rocket equation, mass flow `ṁ = F/(Isp·g₀)`; tank layout; **slosh** modelled as a damped pendulum mass that perturbs attitude during hard manoeuvres | burn tails off, wobble after a stop |
| **Rigid vs flexible** | the 90 m hull is not perfectly rigid: a **beam-mode** model (first 2–3 bending modes) adds a small damped oscillation to attitude and camera when thrust or gusts change abruptly | long hull flexes; engines "load" the structure |
| **Landing gear** | six oleo-pneumatic spring-dampers; **sinkage** per surface stiffness; **bottoming-out** and rebound; footpads leave **footprints and skid marks** that persist for the session as decals/height edits | weight is visible and audible |
| **Thrusters** | spool time, minimum throttle, **gimbal limits**, **thrust vs ambient pressure** (`F = ṁ v_e + (p_e − p_a) A_e`), **plume shape from `p_e/p_a`** (over- vs under-expanded) | the plume is fat in vacuum and pinched in air, for a physical reason |
| **Reaction control** | discrete pulses, cross-coupling, **plume impingement** on the hull (small torque/force), gimbal cross-talk | RCS feels like bursts, not a smooth joystick |
| **Thermal** | hull panel temperatures per zone: absorb sunlight (α), emit (ε σ T⁴), conduct between zones, **radiate to space only**: in vacuum a hot hull cools slowly; **engine heat soak**, **heat-shield ablation** | reentry heat lingers; shade vs sun matters |
| **Electrical/propulsion limits** | power budget (kW), radiator capacity: sustained burns can hit a radiator limit (optional in *Strict*) | an extra physical constraint that creates tension |
| **Structural loads** | g-load and dynamic pressure integrate into a **fatigue/damage** measure, not an on/off flag | gentle overloads wear the ship; severe ones break it |
| **Crew/pilot** | g-load drives vision effects (grey-out/tunnel/blackout) from a standard onset curve ⚠ and recovery time; **optional in Cinematic**, comfort-safe (off with reduced motion) | physiological reality without making it uncomfortable |

---

## 3. Atmosphere and fluid behaviour (as physical as WebGL allows)

- **Compressible aero effects:** Mach-dependent drag rise, **shock stand-off distance** (empirical, `Δ/R_n ≈ 0.78 ρ₁/ρ₂`) for the reentry shock layer glow; **bow shock** cone visible in dusty air (Mars) and in the plasma.
- **Plasma sheath and blackout:** above ~Mach 12 in Earth air a plasma sheath forms: the glow colour follows **radiating temperature** (blackbody ramp + sodium/N₂ lines for Earth, CO₂/CN lines for Mars/Venus ⚠), and an optional **comms blackout** timer is tied to electron density ⚠ (simplified).
- **Boundary layer and wake:** near the hull, a thin turbulent boundary layer drives *streaking* (particles advected along the surface flow field); behind the ship, a **wake** with vortex shedding scaled by Reynolds-like number (visualised by dust/vapour/steam).
- **Wind as a field:** the same `w(x, t)` that moves the ship moves **dust, cloud streaks, plume gases and sound** (sound is carried downwind: speed-of-sound plus wind component).
- **Buoyancy and thick atmospheres:** Venus and Titan use real density (and compressibility) so lift, drag and **thruster performance** change; a hover on Titan costs less than on Mars for a physical reason (density × gravity).
- **Dust and particles obey physics:**
  - **Vacuum (Moon, Mercury, asteroids):** ballistic parabolas `r(t) = r₀ + v t − ½ g t²`, **no drag, no billowing, no spreading beyond ballistic range**; lofted dust shows a sharp ballistic "skirt".
  - **Thin air (Mars):** grains of radius a have a Stokes terminal speed `v_t = (2/9)(ρ_p − ρ_f) g a²/μ` ⚠ with `μ` of CO₂; fine grains stay aloft and **billow**, coarse grains fall ballistically; plume spreads by entrainment.
  - **Dense air (Venus, Titan):** high drag and buoyancy; dust is smothered and rises slowly.
  - **Plume–ground interaction:** erosion rate grows with exhaust dynamic pressure; **blast craters and scoured pads** modify the local heightfield (small, bounded edits) and persist for the session.
- **Clouds as thermodynamics:** convective cloud cover relates to surface heating and humidity (Earth), dust loading and storms (Mars, tied to `mars.ts`), cloud-deck structure (giants).
- **Real horizon and refraction:** dense atmospheres bend light: horizon dip and "lifted" horizons (Venus) follow the refraction integral, not a cheat.
- **Weather is a state, not a texture:** storms advance, vortices move with the flow, and their motion is the same field the ship feels.

---

## 4. Light, exposure and colour (radiometric rendering)

- **Physical units:** sun irradiance `E = 1361 W/m² · (1 AU/d)²` ⚠ at the top of each atmosphere; **radiance** through the scattering model; surface **albedo** from `bodies.ts`; the **camera** applies an exposure derived from a simulated lens (ISO/shutter/aperture) plus **auto-exposure with eye-adaptation lag** that matches photographic EV ranges (Earth noon EV ≈ 15 vs. Titan surface ≈ ~EV 1–3 ⚠ by irradiance ratio).
- **Sun disc:** angular size from `asin(R☉/d)` with limb darkening; **colour temperature ≈ 5,772 K** ⚠ blackbody; atmospheric reddening only from the scattering model (no art-directed tint).
- **Shadows:** no ambient fudge in vacuum: **shadow side is black** except for physically computed **planet-shine, earth-shine, ring-shine** and **star-light**; the terminator is sharp (angular sun size gives realistic penumbra widths).
- **Eclipses:** analytic umbra/penumbra from real geometry; brightness dips with the covered fraction of the solar disc; Earth-shine and Jupiter-shine fill.
- **Specularity and opposition surge:** regolith brightens near zero phase (opposition effect) via a simple Hapke-style term ⚠; wet/liquid surfaces use Fresnel + wave spectrum.
- **Atmospheric colour as output:** sky colour **emerges** from Rayleigh/Mie coefficients and the absorber content of each atmosphere (Earth blue, Mars butterscotch with blue sunsets, Venus orange diffuse, Titan orange-brown); nothing is painted.
- **Star field:** real positions and magnitudes (the repo's starfield, or a bright-star catalogue ⚠) so the sky is the real sky from the ship's position; **parallax** for nearby stars is negligible and omitted (stated).
- **Lens and cockpit glass:** dirt/dust accumulation on the canopy from lofted dust and plume exposure; **veiling glare** near the Sun; **bloom** physically keyed to over-range radiance, not a fixed strength.

---

## 5. Sound as physics

(Audio remains opt-in; when on, it must obey the following.)

- **Medium rules:** vacuum carries no airborne sound. The pilot hears only **structure-borne** vibration (engines through the hull, gear, hits) and cabin systems. In atmosphere, **speed of sound `a = √(γ R_u T/M)`**, propagation delay for external sources (`distance/a`) and **Doppler shift** for passing objects; **absorption** by gas and frequency (dense CO₂ attenuates highs; hydrogen shifts pitch up because `a` is ~3–4× air's).
- **Source models:** engine noise from **exhaust power** `~ ½ ṁ v_e² η` ⚠ (jet noise scales ~ v_e⁸ in practice; clamp for comfort) with spectral shape by plume expansion; rotor/hover jets by thrust; **reentry plasma roar** by `q̇`; **wind roar** by dynamic pressure and turbulence; **sonic boom** (N-wave) when crossing Mach 1 in a medium that supports it; **ground contact** via leg force impulses; **dust patter** by particle flux.
- **Room acoustics:** cabin reverberation (RT60 by volume/absorption), canopy filtering, and **outside→inside transmission loss** (a low-pass whose cutoff depends on hull mass law).
- **Spatial:** HRTF panner for external sources; doppler and delay from true geometry.
- **Safety:** master limiter, loudness cap, "reduce loud sounds", captions for key events.

---

## 6. Gravity, orbits and the large-scale physical world

- **Real positions at the real time** (already in `/stars`); the **Sun's apparent motion across a world's sky follows its rotation and tilt**; day length and seasons are right for the date (Mars: `marsOrientation`, Earth: GMST/obliquity).
- **Tidal and J2 effects** shape low orbits (precession), **third-body perturbation** shifts long coasts; **gravity gradient** torque on the long hull in low orbit (a tiny, real effect; enable in *Strict*).
- **Rotating frames:** take-off from a rotating body inherits its surface velocity; **Coriolis** acts on long, fast atmospheric flights (modelled through the rotating-frame wind); **launch azimuth matters.**
- **Radiation environments:** dose from the Jovian belts and solar events follow simple physical shapes (belt L-shell structure, inverse-square for flares) ⚠ qualitative.
- **Time is real:** the clock is the real current time (reuse `simClock`); time acceleration is explicit and labelled; physics never silently changes timestep outcomes (fixed sub-steps, deterministic).

---

## 7. Terrain that reads as a physical surface

- **Geologic plausibility:** crater morphology (simple/complex/basin), degradation with age, ejecta blankets and rays; **fluvial/aeolian** shapes where physical (dunes aligned with prevailing wind on Mars/Titan/Venus ⚠, channels on Titan/Mars); **ice tectonics** on icy moons (cracks, ridges); **volcanic** forms (shield volcano slopes, calderas, lava flows) with plausible profiles.
- **Slope and rock physics:** angle of repose limits on loose material (~30–35° ⚠ for regolith), **bearing capacity** (soft dust vs rock) feeding the gear sinkage; boulders with size-frequency distributions; shadows and normal-map detail consistent with sun angle.
- **Thermal behaviour of surfaces:** day/night surface temperature from albedo, thermal inertia and insolation (regolith cools very quickly; ice slowly) feeding the hull's ambient heat exchange and visual **frost lines**.
- **Disturbance persistence:** footprints, skid marks, scoured pads and thruster blast patterns remain for the session (and, with storage, optionally across sessions in a bounded, local store).
- **Honesty:** terrain is *procedural* without DEMs (artistic), but obeys these physical rules so it *reads* as geology. Landmarks are placed at real coordinates ⚠ and said so.

---

## 8. Physical feedback to the player

- **Camera:** driven by the **accelerometer-equivalent** (ship acceleration in the cockpit frame) through a damped mass-spring head model (lean into turns, push back in burns), **buffet shake** from turbulent kinetic energy, **landing jolt** from gear impulses. All scaled by **comfort settings** and disabled under `prefers-reduced-motion`.
- **Haptics:** Gamepad `vibrationActuator` (and `navigator.vibrate` on phones) mapped to **engine thrust**, **turbulence**, **touchdown impacts**, **warnings**; strength/enable in settings; off by default on mobile to save battery.
- **Instruments are physical readouts:** the HUD shows the *same* variables the physics uses (no separate fake gauges). The **physics lens** (F3) plots forces and fields live so anything can be verified.
- **Controls have physical lag and limits:** gimbal rate limits, RCS minimum impulse bit, throttle spool; no instant response.
- **Failure is physical:** overheating warps glow and then structural damage; over-g adds fatigue; crush depth deforms; fuel starvation cuts thrust gradually (feed-line pressure model optional).

---

## 9. What this adds to the roadmap (tickets)

New or changed tickets (merge into `04-roadmap-tickets.md` ordering):

| Id | Phase | Ticket | Acceptance | Test |
|---|---|---|---|---|
| R0.1 | F0 | `physics-constants.ts`, branded unit types, lint rule against magic numbers | rule active in physics folders | lint + unit |
| R1.1 | F1 | `reality dial` (Cinematic/Physical/Strict) in settings and `ship.ts` | dial changes assists/tolerances only, not the equations | unit (same trajectory across dials with assists off) |
| R3.1 | F3 | mass-property recompute (fuel, cargo, damage), CoM/inertia | CoM shifts as fuel burns; attitude response changes | unit |
| R3.2 | F3 | rocket equation with mass flow and tank slosh pendulum | Δv within 0.5 %; slosh decays with damping ratio | unit |
| R3.3 | F3 | thrust vs ambient pressure; plume expansion state | `F` matches `ṁ v_e + (p_e−p_a)A_e`; plume angle monotone with `p_a` | unit + visual |
| R3.4 | F3 | beam-mode flexibility and RCS plume impingement | first-mode frequency/damping as specified; torque from impingement bounded | unit |
| R3.5 | F3 | gravity-gradient torque and J2 (Strict) | torque matches `3μ/r³ (I_z − I_x)` formula | unit |
| R5.1 | F5 | compressible effects: shock stand-off, bow shock visual, plasma sheath temperature ramp | glow colour matches blackbody ramp vs `T` | unit + visual |
| R5.2 | F5 | plume–ground erosion and blast scoring | erosion monotone in dynamic pressure; edits bounded | unit |
| R5.3 | F5 | physical dust: ballistic (vacuum), Stokes (thin air), smothered (dense) | trajectories match analytic parabola/terminal speed | unit |
| R5.4 | F5 | thermal zones: absorb/emit/conduct, radiate-only cooling in vacuum | cooling curve matches `dT/dt = −εσT⁴A/(mc)` | unit |
| R6.1 | F6 | bearing capacity and sinkage; footprints/skid marks as decals + height edits | sinkage proportional to load/stiffness; marks persist | unit + e2e |
| R6.2 | F6 | thermal surface model (albedo, inertia, insolation) | day/night curve matches analytic for a test body | unit |
| R8.1 | F8 | radiometric exposure + eye adaptation; physical bloom | EV by place matches irradiance ratios within 0.3 stops | unit |
| R8.2 | F8 | planet-shine/earth-shine/ring-shine and eclipse penumbra | shadow-side radiance matches albedo × irradiance × geometry | unit |
| R8.3 | F8 | opposition surge, Fresnel water/lake surfaces | brightness vs phase curve monotone | unit |
| R9.1 | F9 | physics lens overlay (forces, ρ, q, T, g, wind, `a`) | numbers equal the sim's internal values | e2e |
| R9.2 | F9 | accelerometer-driven camera, buffet, landing jolt; comfort scaling; reduced-motion off | camera displacement ∝ acceleration × comfort factor | unit |
| R9.3 | F9 | haptics via Gamepad/vibrate | patterns follow thrust/turbulence/impact | unit (mapping) |
| R10.1 | F10 | acoustic model: medium rules, delay, Doppler, absorption, structure-borne path | vacuum silent airborne; Doppler matches `f(c/(c−v))` | unit |
| R10.2 | F10 | cabin acoustics and hull transmission loss | low-pass cutoff follows the mass-law formula | unit |

## 10. Declared departures from reality (the honest list)

| Departure | Why | Where shown |
|---|---|---|
| **Light tier (up to 1000 c)** | the system is too big to cross at believable speeds | tier dial: "Fictional" |
| **Ship performance** (thrust, Isp, mass, limits) | no real vehicle; gameplay values | start screen, ship spec |
| **Recall** after fatal events | non-punishing play (*Strict* delays or disables) | recall card |
| **Procedural terrain** where no DEM exists | no data offline | reality tag: artistic |
| **Simplified plasma/blackout, aero tables** | not CFD | physics lens notes |
| **Radiation dose scale** | arbitrary units | HUD tooltip |
| **Earth clouds/city lights** | no live data offline | reality panel |
| **Real belt/ring emptiness vs "artistic density"** | visual legibility (toggle) | View menu |
| **Camera conveniences** (chase cam, photo mode) | usability | — |
| **Sound in space cockpit** only structure-borne by design | realism and comfort balance | audio settings |

## 11. Realism acceptance tests (extend `07-test-matrix.md`)

| Test | Pass condition |
|---|---|
| **Conservation** | unpowered vacuum orbit: energy and angular momentum drift < 1e-9 per orbit; fuel mass accounting equals integral of `ṁ` within 1e-6 |
| **Rocket equation** | Δv from simulated burn = `Isp g₀ ln(m₀/m₁)` within 0.5 % |
| **Plume** | exit pressure vs ambient: plume half-angle monotone decreasing with ambient pressure; vacuum > sea level |
| **Dust** | in vacuum, particle apex height and range equal `v²sin²θ/2g` and `v² sin2θ/g` within 1 % |
| **Terminal speed** | Stokes grain terminal speed and ship terminal velocity match formulas within 1 % |
| **Thermal** | radiative cooling curve of an isolated hot panel matches the analytic solution within 2 %; equilibrium temperature `(α S /(4 ε σ))^{1/4}` for a sphere matches ⚠ |
| **Exposure** | auto-exposure EV difference between Earth noon and Titan surface equals `log₂(irradiance ratio × albedo/haze factor)` within 0.5 stops |
| **Sound** | airborne sound absent in vacuum; delay equals `d/a`; Doppler matches formula |
| **Camera** | head-motion amplitude scales linearly with acceleration up to the comfort clamp; zero under reduced motion |
| **Gear** | static sinkage = `W/k`; bottoming limit respected; footprints persist for the session |
| **Determinism** | same state + seed ⇒ identical trajectory and tile bytes across two runs |
| **Dial equivalence** | with assists off and identical inputs, Cinematic/Physical/Strict produce identical trajectories |
| **Physics lens** | displayed numbers equal the simulation's values (read through a test hook) |

## 12. Definition of "feels real" for v1

A first-time player, without reading anything, should be able to *predict* the ship's behaviour from experience of the real world: heavy things take time to turn and stop; thin air barely pushes, thick air pushes hard; dust flies in parabolas on the Moon and billows on Mars; hot things glow and stay hot until they radiate away; shadows are black in vacuum; the Sun is the only real light; sound exists only where there is air; and when something goes wrong, the cause is **visible, audible and explained in physical terms**.
