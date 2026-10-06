# `/fly` — derived physics numbers (design inputs and test targets)

Companion to `docs/plan-fly.md`. Everything here is **computed by script from recalled inputs** (GM, radii, a few densities), so the
*arithmetic* is checked but the *inputs* are **⚠ unverified** until `docs/fly/verification.md` says otherwise. These tables double as
**unit-test targets**: the code in `src/lib/fly/` must reproduce them (within the stated tolerance) from `bodies.ts`.

Inputs used (GM in km³/s², R in km): Sun 1.32712440018×10¹¹ / 695,700; Mercury 22,031.78 / 2,439.7; Venus 324,858.59 / 6,051.8;
Earth 398,600.44 / 6,371.0; Moon 4,902.80 / 1,737.4; Mars 42,828.37 / 3,389.5; Jupiter 1.26686534×10⁸ / 69,911; Saturn 3.7931187×10⁷ / 58,232;
Uranus 5.793939×10⁶ / 25,362; Neptune 6.836529×10⁶ / 24,622; Io 5,959.916 / 1,821.6; Europa 3,202.739 / 1,560.8; Ganymede 9,887.834 / 2,634.1;
Callisto 7,179.289 / 2,410.3; Titan 8,978.14 / 2,574.7; Enceladus 7.21 / 252.1; Triton 1,427.6 / 1,353.4; Pluto 869.6 / 1,188.3; Charon 105.9 / 606;
Ceres 62.63 / 469.7; Vesta 17.29 / 262.7.

## 1. Gravity, escape, low orbits, spheres of influence

Surface gravity `g = GM/R²`; escape `v_e = √(2GM/R)`; circular `v_c = √(GM/r)` with `r = R + 100 km` for rocky/icy bodies and `r = 1.1 R` for
gas giants and the Sun; period `T = 2πr/v_c`; Laplace SOI `r_SOI = a (m/M)^(2/5)` for planets about the Sun.
(Gravity here is the mean value; the equatorial "effective" value differs by rotation and oblateness: modelled with J2 in `gravity.ts`.)

| Body | g (m/s²) | Escape (km/s) | Circular speed (km/s) | at r | Period | SOI (10³ km) |
|---|---|---|---|---|---|---|
| Mercury | 3.70 | 4.25 | 2.95 | 2,540 km | 90 min | 112 |
| Venus | 8.87 | 10.36 | 7.27 | 6,152 km | 89 min | 616 |
| Earth | 9.82 | 11.19 | 7.85 | 6,471 km | 86 min | 925 |
| Moon | 1.62 | 2.38 | 1.63 | 1,837 km | 118 min | — |
| Mars | 3.73 | 5.03 | 3.50 | 3,490 km | 104 min | 577 |
| Jupiter | 25.92 | 60.20 | 40.59 | 76,902 km | 198 min | 48,207 |
| Saturn | 11.19 | 36.09 | 24.33 | 64,055 km | 276 min | 54,547 |
| Uranus | 9.01 | 21.38 | 14.41 | 27,898 km | 203 min | 51,764 |
| Neptune | 11.28 | 23.57 | 15.89 | 27,084 km | 179 min | 86,662 |
| Io | 1.80 | 2.56 | 1.76 | 1,922 km | 114 min | — |
| Europa | 1.31 | 2.03 | 1.39 | 1,661 km | 125 min | — |
| Ganymede | 1.43 | 2.74 | 1.90 | 2,734 km | 151 min | — |
| Callisto | 1.24 | 2.44 | 1.69 | 2,510 km | 155 min | — |
| Titan | 1.35 | 2.64 | 1.83 | 2,675 km | 153 min | — |
| Enceladus | 0.11 | 0.24 | 0.16 | 277 km | 180 min | — |
| Triton | 0.78 | 1.45 | 0.99 | 1,453 km | 154 min | — |
| Pluto | 0.62 | 1.21 | 0.82 | 1,288 km | 164 min | — |
| Charon | 0.29 | 0.59 | 0.40 | 667 km | 175 min | — |
| Ceres | 0.28 | 0.52 | 0.35 | 517 km | 155 min | — |
| Vesta | 0.25 | 0.36 | 0.24 | 289 km | 124 min | — |
| Sun | 274.2 | 617.7 | 416.4 | 765,270 km | 192 min | — |

**Reading it as design:**
- Jupiter's escape speed (60 km/s) is why Tier 4 (Transfer, up to 3,000 km/s) is needed to leave it at all in a play-sized time;
  the Sun's (618 km/s) sets the lowest sensible "Sun Skimmer" speed band.
- Moons around Jupiter and Saturn all have circular speeds of 1–2 km/s: low orbits are *slow and long* (2–2.5 h), so the Orbital tier
  should show **time-to-next-event** (pass over target, shadow entry) rather than make players wait.
- Enceladus, Vesta, Ceres and Charon have escape speeds under 0.6 km/s: the **hover tier alone can leave them**. Gameplay: "touch
  and go" landings, jump-launch.

**Tests:** `g`, `v_e`, `v_c`, `T`, SOI recomputed from `bodies.ts` match this table within 0.5 % (inputs identical) and within 2 % of any
later-verified reference values.

## 2. Surface rotation speeds (take-off assist)

| Body | Equatorial speed | Note |
|---|---|---|
| Earth | 465 m/s | launch east for the bonus |
| Mars | 241 m/s | |
| Jupiter (1 bar, equator) | ≈ 12.6 km/s | rotation matters for orbital insertion |
| Saturn (1 bar, equator) | ≈ 9.9 km/s | |

## 3. Terminal velocity of the Wayfarer (ballistic coefficient)

Assume the gameplay ship: mass ≈ 600 t, reference drag area `C_D·A` ≈ 1,600 m² (blunt lifting body ~ 90 m × 40 m, `C_D` ≈ 0.8, belly-first):
ballistic coefficient **β = m / (C_D A) ≈ 375 kg/m²**. Terminal velocity `v_t = √(2 β g / ρ)` for a free fall in uniform density:

| Place | ρ (kg/m³) ⚠ | g (m/s²) | Terminal speed |
|---|---|---|---|
| Earth, sea level | 1.225 | 9.81 | **77 m/s** |
| Earth, 10 km | 0.4135 | 9.78 | 133 m/s |
| Mars surface | ≈ 0.020 | 3.71 | **373 m/s** |
| Mars, 10 km | ≈ 0.0028 | 3.71 | 997 m/s |
| Venus surface | ≈ 65 | 8.87 | **10 m/s** |
| Titan surface | ≈ 5.3 | 1.35 | **14 m/s** |

> **Note:** this β uses the Wayfarer's *dry* mass (600 t). With full propellant (1,000 t) β = 625 kg/m² and the terminal speeds are ×1.29 (Earth 100 m/s, Mars 482 m/s). Per-ship values for the whole roster are in `11-ship-roster.md` §1.1.

**Design reading:** a falling Wayfarer is gently arrested by thick air (Venus, Titan: ~10–14 m/s, survivable without engines in principle) and
barely arrested on Mars (373 m/s at the surface: the engines must do the work, exactly Mars's real "thin air but not nothing" problem).
These are the *feel* anchors for aero tuning. **Tests:** `aero.ts` terminal velocity under a constant-ρ atmosphere equals the table within 1 %.

## 4. Stagnation-point heating (Sutton–Graves) sanity values

`q̇ = k √(ρ/R_n) v³`, k ≈ 1.7415×10⁻⁴ (Earth air, SI) ⚠; Mars CO₂ k ≈ 1.9×10⁻⁴ ⚠; nose radius `R_n` = 20 m for the Wayfarer's blunt belly.

| Case | ρ (kg/m³) | v (m/s) | R_n | q̇ (W/cm²) |
|---|---|---|---|---|
| Earth, LEO return, 75 km | 4×10⁻⁵ | 7,800 | 20 m | ≈ 12 |
| Earth, 60 km | 3×10⁻⁴ | 7,000 | 20 m | ≈ 23 |
| Mars, 20 km, 5 km/s | 1×10⁻⁴ | 5,000 | 20 m | ≈ 5 |

These are **small** (a 20 m blunt body sheds heat well: the large nose radius is the point of a blunt reentry vehicle). **Calibration target
(F5):** reproduce the order of magnitude of published Apollo/Shuttle values (tens to a few hundred W/cm² for small-radius capsules; the Shuttle
~ 1 m effective radius) by running the same function with their `R_n` and speeds; if `thermal.ts` is off by more than a factor of two, fix
the constants before shipping. Total heat load (integral) and the radiative-equilibrium wall temperature `T = (q̇/(εσ))^(1/4)` drive the
**hull temperature** gauge: e.g. 23 W/cm² with ε = 0.8 gives ≈ 1,900 K for a few seconds of equilibrium, hence a heat shield.

## 5. Light, distance and the speed tiers (computed)

c = 299,792.458 km/s = 0.002004 AU/s. **1 AU ≈ 499.005 light-seconds.**

| Tier cap | AU/s | Cross 1 AU | Cross 30 AU |
|---|---|---|---|
| 0.01 c | 2.0×10⁻⁵ | 13.9 h | 17.3 d |
| 0.1 c | 2.0×10⁻⁴ | 83 min | 1.7 d |
| 1 c | 0.002 | 8.3 min | 4.2 h |
| 10 c | 0.020 | 50 s | 25 min |
| 100 c | 0.200 | 5.0 s | 2.5 min |
| 1000 c | 2.004 | 0.5 s | 15 s |

The full trip table is in `docs/plan-fly.md` §4.2. **Tests:** the autopilot's predicted arrival time for any (distance, tier) equals `d/v` within 1 frame.

## 6. Orbital mechanics quick references used by the autopilot and tests

- Vis-viva: `v² = GM (2/r − 1/a)`.
- Hohmann ΔV (circular r₁ → r₂): `Δv₁ = √(μ/r₁)(√(2r₂/(r₁+r₂)) − 1)`, `Δv₂ = √(μ/r₂)(1 − √(2r₁/(r₁+r₂)))`.
  Earth LEO (r = 6,571 km) → Moon distance (384,400 km): Δv₁ ≈ 3.13 km/s ⚠ (computed from the formula in the unit test, not recalled).
- Suicide-burn solver (airless): burn altitude `h = v²/(2(a_max − g))`; with thrust margins and terrain scan lead (§ `ship.ts`).
- Gravity turn guidance (take-off): pitch over from vertical at `v ≈ 60–120 m/s` toward the local horizon so that the velocity vector leads the nose.

## 7. Terrain scale checks

| Body | Cube-sphere face edge (πR/2) | Level-0 vertex spacing (65 samples) | Level for ~0.25 m |
|---|---|---|---|
| Moon | 2,729 km | 42.6 km | 18 (≈ 0.26 m at level 18: `log₂(2,729 km / 16 m) = 17.4`, rounded up) |
| Mars | 5,324 km | 83 km | 19 |
| Earth | 10,008 km | 156 km | 20 |
| Jupiter (cloud deck, not terrain) | 109,813 km | — | n/a (2-D flow textures) |

(`levels ≈ log₂(edge / (64 × 0.25 m))`; the table is for sizing the tile cache and worker budget, and a test asserts the formula.)
