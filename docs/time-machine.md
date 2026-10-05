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
| Sun position | `astronomy-engine` (VSOP87, apparent place with nutation) for 1800–2200; Meeus ch. 25 outside | `earth.ts` | ~arcsecond within 1800–2200; Meeus degrades over millennia |
| Equation of time, nutation | Meeus ch. 28 / ch. 22 (largest four terms) | `earth.ts` | ≈ 1 s / ≈ 0.5″ |
| Seasons, perihelion, aphelion, eclipses | `astronomy-engine` search functions (1800–2200 for seasons/apsides; eclipses within JS Date range) | `planets.ts` | minutes (seasons), the eclipse flag is ±36 h around greatest eclipse |
| Axial tilt | Laskar (1986) polynomial, ±10,000 yr; clamped beyond | `earth.ts` | ±~0.01° within range |
| Planets, Moon | `astronomy-engine` (VSOP87-class, MIT) | `planets.ts` | ~1′ for 1800–2200; illustrative beyond ±6,000 yr |
| Mars season (Ls) | Allison & McEwen (2000) | `mars.ts` | ~0.1° for 1874–2100; drifts outside |
| Mars rotation / local time | Allison & McEwen (2000) MSD/MTC/EOT | `globe.ts` | checked against Curiosity landing local time |
| Mars dust storms | Catalogue of 6 spacecraft-observed global storms, dated from Mars Year + Ls | `mars.ts` | storms **cannot be predicted** outside the catalogue |
| Mars surface | Hand-placed albedo features, schematic caps | `marsMap.ts` | schematic — no imagery bundled |
| Ice ages | Piecewise sea-level curve → ice-sheet edges | `climate.ts` | **schematic**: tens of m / thousands of yr uncertain |
| Earth geography | Natural Earth 1:110m land via `world-atlas` (public domain), baked by `scripts/build-land.mjs` | `public/solar/land.json` | today's coastlines at every date; an optional **schematic** exposed shelf widens every coast by ≈ 100–130 km |
| Earth's tilt panel | Laskar (1986) polynomial over ±10,000 yr | `EarthView.tsx` | the polynomial is not valid for the 800,000-yr ice-age curve; eccentricity and precession are **not** shown (no checked series offline) |
| 3D Solar System | three.js scene, positions from `astronomy-engine`, float64 camera-relative, log depth buffer; Earth spin and tilt from GMST + obliquity | `lib/solar/scene.ts`, `earthFrame.ts` | planet/Moon positions as above; Earth orientation checked against `subsolarPoint` in tests; Mars axis is approximate; rings/moons are decorative |
| Sun in the Galaxy | Published constants with uncertainties | `galaxySun.ts` | see below |

`src/lib/astro/accuracy.ts` produces the per-moment report shown in the Time machine dialog, so the UI
never claims more than the model can support.

## Galactic constants — please verify

These were entered from memory of the cited papers (no network access to journals while building) and are
cross-checked only for internal consistency (e.g. Sgr A* proper motion → ~247 km/s, ~203 Myr lap). Before
treating the numbers as final, confirm each against its source:

- R₀ = 8.178 ± 0.013 (stat) ± 0.022 (sys) kpc — GRAVITY Collaboration 2019, A&A 625, L10
- z⊙ = 20.8 ± 0.3 pc — Bennett & Bovy 2019, MNRAS 482, 1417
- Sgr A* proper motion 6.379 ± 0.026 mas/yr — Reid & Brunthaler 2004, ApJ 616, 872 (their 2020 re-analysis, ApJ 892, 39, is not used)
- Θ₀ = 236 ± 7 km/s — Reid et al. 2019, ApJ 885, 131
- Solar motion (U,V,W) = (11.1, 12.24, 7.25) km/s — Schönrich, Binney & Dehnen 2010
- Bar pattern speed 39 ± 3.5 km/s/kpc — Portail et al. 2017; bar angle ~27° — Wegg, Gerhard & Portail 2015
- Spiral pattern speed ~28 km/s/kpc (20–32) — poorly constrained (Gerhard 2011; Dias et al. 2019)
- Vertical oscillation period ~84 Myr — harmonic approximation

Also worth checking: the Mars storm onsets (Mars Year / Ls) and the ice-age sea-level anchor points. The UI labels
both as approximate. `CONSTANTS_VERIFIED` in `galaxySun.ts` stays `false` until every constant has been checked.

## Datasets that were looked for and are not available

Searched on npm from the build sandbox (the only reachable host): global bathymetry (GEBCO/ETOPO) and Mars albedo
or elevation maps. Nothing usable exists there (`@basemaps/bathymetry` is a tile-processing tool, not data), and
NASA/USGS/GEBCO hosts are unreachable. So the exposed continental shelf and Mars's surface stay schematic and
are labelled as such. If you can supply a public-domain equirectangular grid, `scripts/` is the place to bake it.

## The 3D Solar System and "Take me home"

`/stars` → **O** (or the Sun button) opens the overlay on the **3D system** tab; **H** or the home button starts
the descent: Solar System → inner planets → Earth–Moon → low Earth orbit (about 1,400 km up), 2–8 s per
chapter, with Pause / Skip / Exit always visible. Under `prefers-reduced-motion` the chapters are cuts with
Next/Back buttons. The scale ladder jumps between the same stops and shows distance and light-time.

- *Visible scale* enlarges bodies just enough to be found; *True scale* shows real radii. The badge always says which.
- The galaxy → Sun hand-off is still a zoom-and-fade into the overlay, not a continuous 3D descent through
  interstellar space; within the Solar System the descent is continuous.
- Devices without WebGL or with very low memory/cores get the top-down map. A frame governor lowers the pixel
  ratio step by step and falls back to the top-down map if the scene still runs below ~4 fps. Software renderers
  (SwiftShader, llvmpipe) start at half resolution, and the scene only redraws continuously while something is changing.

## Keyboard

`,` `.` step the clock back/forward one unit, `[` `]` halve/double the speed, `N` real time now, `J` open the
time machine, `Space` pause, `O` Solar System, `H` take me home, `B` bookmark this moment.

## Range and limits

- The clock spans ±2 billion years. Calendar dates are labels beyond ~±10,000 years; time of day is hidden
  where Earth's spin is unknowable.
- Planets/Moon need a JavaScript `Date` (±273,790 years); beyond that the solar views show only the date.
- Spiral-arm drift uncertainty grows ~0.5° per Myr because the pattern speed is uncertain.

## Fullscreen

The clock panel's fullscreen button uses the browser Fullscreen API on the whole page. iPhone Safari does not
support it for pages, so the button is hidden there.
