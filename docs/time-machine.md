# Time machine — sources, accuracy and what to verify

Explore mode (`/stars`) boots at the **real current instant** and lets the visitor run time forwards or
backwards, or jump to any date. Everything (Earth's rotation and seasons, planets, Moon, Mars, the galaxy's
rotation) is computed from that one clock (`src/lib/astro/clock.ts`).

## What each part uses

| Part | Method | Where | Honest accuracy |
|---|---|---|---|
| Calendar / Julian Date | Meeus ch. 7, proleptic Gregorian, astronomical year numbering (year 0 = 1 BCE) | `julian.ts` | exact |
| ΔT (TT − UT) | Espenak & Meeus (2006) polynomials; parabola outside −500…2150 | `time.ts` | ±0.1 s today, ±hours by 1 CE, ~±50 days at 19,000 BCE |
| Earth rotation | GMST (Meeus 12.4); sub-solar point = Sun RA − GMST | `earth.ts` | < 0.1° today; time of day meaningless before ~10,000 BCE |
| Sun position | Meeus ch. 25 (checked against astronomy-engine to 0.02°, 1900–2100) | `earth.ts` | degrades over millennia |
| Axial tilt | Laskar (1986) polynomial, ±10,000 yr; clamped beyond | `earth.ts` | ±~0.01° within range |
| Planets, Moon | `astronomy-engine` (VSOP87-class, MIT) | `planets.ts` | ~1′ for 1800–2200; illustrative beyond ±6,000 yr |
| Mars season (Ls) | Allison & McEwen (2000) | `mars.ts` | ~0.1° for 1874–2100; drifts outside |
| Mars rotation / local time | Allison & McEwen (2000) MSD/MTC/EOT | `globe.ts` | checked against Curiosity landing local time |
| Mars dust storms | Catalogue of 6 spacecraft-observed global storms, dated from Mars Year + Ls | `mars.ts` | storms **cannot be predicted** outside the catalogue |
| Mars surface | Hand-placed albedo features, schematic caps | `marsMap.ts` | schematic — no imagery bundled |
| Ice ages | Piecewise sea-level curve → ice-sheet edges | `climate.ts` | **schematic**: tens of m / thousands of yr uncertain |
| Earth geography | Natural Earth 1:110m land via `world-atlas` (public domain), baked by `scripts/build-land.mjs` | `public/solar/land.json` | today's coastlines at every date |
| Sun in the Galaxy | Published constants with uncertainties | `galaxySun.ts` | see below |

`src/lib/astro/accuracy.ts` produces the per-moment report shown in the Time machine dialog, so the UI
never claims more than the model can support.

## Galactic constants — please verify

These were entered from memory of the cited papers (no network access to journals while building) and are
cross-checked only for internal consistency (e.g. Sgr A* proper motion → ~247 km/s, ~203 Myr lap). Before
treating the numbers as final, confirm each against its source:

- R₀ = 8.178 ± 0.013 (stat) ± 0.022 (sys) kpc — GRAVITY Collaboration 2019, A&A 625, L10
- z⊙ = 20.8 ± 0.3 pc — Bennett & Bovy 2019, MNRAS 482, 1417
- Sgr A* proper motion 6.379 ± 0.026 mas/yr — Reid & Brunthaler 2020, ApJ 892, 39
- Θ₀ = 236 ± 7 km/s — Reid et al. 2019, ApJ 885, 131
- Solar motion (U,V,W) = (11.1, 12.24, 7.25) km/s — Schönrich, Binney & Dehnen 2010
- Bar pattern speed 39 ± 3.5 km/s/kpc — Portail et al. 2017; bar angle ~27° — Wegg, Gerhard & Portail 2015
- Spiral pattern speed ~28 km/s/kpc (20–32) — poorly constrained (Gerhard 2011; Dias et al. 2019)
- Vertical oscillation period ~84 Myr — harmonic approximation

Also worth checking: the Mars storm onsets (Mars Year / Ls) and the ice-age sea-level anchor points.

## Range and limits

- The clock spans ±2 billion years. Calendar dates are labels beyond ~±10,000 years; time of day is hidden
  where Earth's spin is unknowable.
- Planets/Moon need a JavaScript `Date` (±273,790 years); beyond that the solar views show only the date.
- Spiral-arm drift uncertainty grows ~0.5° per Myr because the pattern speed is uncertain.

## Fullscreen

The clock panel's fullscreen button uses the browser Fullscreen API on the whole page. iPhone Safari does not
support it for pages, so the button is hidden there.
