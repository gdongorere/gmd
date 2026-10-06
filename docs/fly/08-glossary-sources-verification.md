# `/fly` — glossary, sources to check, and the verification log

Companion to `docs/plan-fly.md` §18. Three parts: terms used across the plan, the public sources that should be used to verify each group of numbers, and
the **verification log** template that must be filled (one line per value) before anything is shown without an "unverified" badge.

## 1. Glossary

| Term | Meaning |
|---|---|
| **AU** | astronomical unit, 149,597,870.7 km |
| **BCI / BCBF / HCI / ENU** | body-centred inertial / body-fixed / heliocentric inertial / east-north-up local frame |
| **Bubble** | altitude region around a body where the speed tier is capped |
| **β (ballistic coefficient)** | `m / (C_D A)` in kg/m²; sets terminal velocity |
| **CDLOD** | continuous distance-dependent level of detail for terrain |
| **CSM** | cascaded shadow maps |
| **DEM** | digital elevation model |
| **Floating origin** | rendering with the camera at the origin; object positions computed relative to it in float64 |
| **GM (μ)** | gravitational parameter, m³/s² |
| **Hover assist** | altitude/vertical-speed hold controller |
| **J2** | second zonal harmonic (oblateness) of a gravity field |
| **LOD / impostor** | level of detail / flat sprite replacement at distance |
| **LUT** | look-up table (here: atmosphere scattering tables) |
| **Mach / max-Q** | speed relative to the speed of sound / maximum dynamic pressure |
| **Patched conics** | gravity treated as one body at a time with hand-offs at spheres of influence |
| **q̇ (stagnation heating)** | convective heat flux at the stagnation point, W/m² |
| **Recall** | the non-punishing recovery to a safe orbit after a fatal event |
| **SOI** | sphere of influence, `a (m/M)^(2/5)` |
| **SAS** | stability augmentation system (attitude assists) |
| **Sub-solar point** | where the Sun is straight overhead (used elsewhere in the repo) |
| **Tier** | a named speed regime (Hover, Atmospheric, Orbital, Transfer, Cruise, Light) |
| **True scale / visible scale** | real sizes vs enlarged for visibility; `/fly` is true scale only, with fixed-size *markers* for far bodies |
| **Reality tags** | measured / derived / artistic, plus `verified` true/false |

## 2. Where to verify each group (public sources; none are reachable from the build sandbox)

| Group | Primary source | Secondary |
|---|---|---|
| Radii, GM, gravity, rotation | JPL SSD physical parameters pages; IAU WGCCRE report | NASA planetary fact sheets |
| Pole orientation, prime meridian | latest IAU WGCCRE report (Archinal et al.) | JPL SPICE `pck` kernels |
| Orbital elements for moons and small bodies | JPL SSD satellite and small-body elements | Meeus, *Astronomical Algorithms* (low precision) |
| Earth atmosphere | US Standard Atmosphere 1976 | NRLMSISE-00 documentation |
| Mars atmosphere | Mars Climate Database; MSL/REMS and Viking/Pathfinder data | NASA Mars fact sheet |
| Venus atmosphere | VIRA (Venus International Reference Atmosphere); Venera/Magellan | Venus Express/Akatsuki papers |
| Titan atmosphere | Huygens HASI profile | Cassini INMS |
| Giant planet atmospheres | Galileo (Jupiter), Cassini (Saturn), Voyager 2 (Uranus/Neptune) probe/occultation papers | Juno results |
| Winds | Cassini/Voyager/Hubble/Juno cloud-tracking papers; Venus cloud-tracking | Mars rover weather |
| Terrain landmarks (coordinates, heights) | USGS Gazetteer of Planetary Nomenclature; MOLA, LOLA, Magellan, Cassini RADAR, New Horizons, Dawn, MESSENGER products | LROC/HiRISE catalogues |
| Heating constants | Sutton & Graves (1971); later Mars-entry updates | reentry textbooks |
| Rings | Cassini ring papers (radii, thickness) | NASA fact sheets |
| Radiation | Galileo/Juno energetic-particle data | Jovian environment models |
| Sky/scattering coefficients | Bruneton & Neyret; Hillaire (2020); atmosphere cross-section tables | planetary haze papers |
| Solar corona/flare descriptions | Parker Solar Probe mission pages; SOHO/SDO | textbooks |

**Optional data to bake (public domain, must be downloaded by Gee):** Mars MOLA global DEM, Moon LOLA global DEM, Venus Magellan DEM, Earth ETOPO (or Natural Earth for coastlines already in the repo), body albedo maps (Viking Mars, LRO Moon).

## 3. Verification log

Location: `docs/fly/verification.md` (created in F0.5). One row per value; the doc generator (`scripts/gen-bodies-doc.mjs`) merges this log with `bodies.ts` and refuses to mark `verified: true` unless a row exists.

```
| Body | Field | Value in code | Source (title, page/section, URL/DOI) | Date checked | Checked by | Result (ok / corrected to X) |
|------|-------|---------------|---------------------------------------|--------------|------------|------------------------------|
| Mars | atmosphere.surfacePressure | 610 Pa | … | … | … | … |
```

Rules:
1. A value stays `verified:false` and carries an "unverified" badge in the reality panel until it has a log row with a primary source.
2. If a value is corrected, record both the old and new values and run the relevant tests (derived tables in `01-physics-numbers.md` are regenerated from the data).
3. Any dataset imported (DEM, texture) records its name, version, licence, download date and processing steps.
4. Artistic values (palettes, shapes, belt density) are labelled **artistic** in the data, not "verified": they are never claimed as real.

## 4. Known gaps and how the UI says so

| Gap | Where it shows | Message |
|---|---|---|
| Moons beyond Earth's and the Galileans use mean elements | reality panel, target card | "Position approximate (mean elements)" |
| No real DEMs bundled | terrain reality tag | "Artistic terrain; famous features are placed at their real coordinates" |
| Earth night lights, clouds, weather are procedural | reality panel | "Artistic: not today's real weather or city lights" |
| Planet interiors/depth profiles are modelled | gas-giant depth gauge | "Modelled from probe profiles; deeper values extrapolated" |
| Light tier exceeds c | tier dial | "Fictional: speeds above the speed of light" |
| Ship is not a real vehicle | start screen | "The Wayfarer is fictional; its numbers are gameplay values" |
