# Milky Way starfield

The site background is a scaled-down, scientifically grounded model of the Milky Way rendered with three.js. It has true 3D parallax and a scroll-driven camera flight with a roll.

## How it fits together

```
providers.tsx
 └─ EnhancedStarfield            CSS galaxy paints instantly; whole show if WebGL is missing
     └─ GalaxyCanvas (lazy)      next/dynamic, ssr:false — three.js never blocks first paint
         └─ engine.ts            renderer, single rAF loop, camera, governor
             ├─ quality.ts       device detection, remembered tier, frame-time governor
             ├─ galaxy.worker.ts → generate.ts   star generation off the main thread
             ├─ camera.ts        scroll keyframes (catmull-rom) + roll
             └─ shaders.ts       rotation / size / twinkle computed on the GPU
StarfieldContext.tsx             config + live stats (separate contexts)
StarfieldControls.tsx            the "Milky Way Controls" panel
```

## Scale and structure (`src/lib/galaxy/constants.ts`)

1 world unit = 100 light-years. The galactic plane is XZ and +Y is the north galactic pole.

| Feature | Real value | Scene value |
| --- | --- | --- |
| Stellar disk diameter | ~100,000 ly | ~1,040 units |
| Thin disk scale length / height | 2.6 kpc / 300 pc | 85 / 10 units |
| Thick disk scale length / height | 2 kpc / 900 pc | 65 / 30 units |
| Long bar half-length, angle to Sun–GC line | 5 kpc, 27° | 163 units, −27° |
| Spiral pitch angle | ~12° | 12° |
| Arms crossing the Sun–GC line | Norma 3.6, Scutum 5, Sagittarius 7, Perseus 9.8, Outer 13.6 kpc | log spirals anchored to these |
| Sun | R₀ 8.2 kpc, 20 pc above the plane | (260, 0.65, 0) |
| Rotation curve | flat ~230 km/s, clockwise from the NGP | ω = v(r)/r in the vertex shader |
| Bar/arm pattern speed | ~40 km/s/kpc | rigid rotation, ≈1.43× the Sun's rate |
| Halo | ρ ∝ r^-3.5, ~150 globular clusters | r^-1.5 radial sampling |
| Magellanic Clouds | LMC 163k ly (l 280.5°, b −32.9°), SMC 206k ly | placed from heliocentric l/b |

Star colours come from blackbody temperatures. Populations:
- **Thin disk:** the real mass-function mix (76% M dwarfs).
- **Arms:** weighted by visibility, so O/B stars make them blue.
- **Bulge, thick disk and halo:** old stars with no O/B/A main-sequence stars.

### Artistic approximations, and why
- **Spiral arms** rotate rigidly as a density-wave pattern; the old disk underneath rotates differentially. Real arms are density waves, and moving the arm stars differentially would wind the spiral into a smear within minutes.
- **The Orion Spur** co-moves with the Sun, so "You are here" stays inside it.
- **The camera co-rotates with the Sun.** The Sun stays fixed on screen while the galaxy turns around it.
- **Sgr A\*** is enormously exaggerated: at true scale it would be far smaller than a pixel.
- **Dust and glow** are soft sprites, not volumetric. Dust darkens whatever was drawn before it, which is the bulge, old disk and haze.

## Performance on every device

Tiers live in `src/lib/galaxy/tiers.ts`:

| Tier | Stars | Glow / dust / nebulae | DPR cap | FPS |
| --- | --- | --- | --- | --- |
| Ultra | ~254k | 5000 / 9000 / 1600 | 2 | 60 |
| High | ~151k | 3600 / 6500 / 1100 | 1.75 | 60 |
| Medium | ~84k | 2400 / 4000 / 650 | 1.5 | 60 |
| Low | ~37k | 1200 / 2000 / 300 | 1.25 | 30 |
| Minimal | ~13k | 600 / 0 / 120 | 1 | 30 |
| Static | CSS only | — | — | — |

- **Detection.** `quality.ts` runs once and caps the starting tier. It looks at:
  - the GPU renderer string (known weak GPUs)
  - WebGL1 vs WebGL2
  - `deviceMemory` and `hardwareConcurrency`
  - mobile, Save-Data and reduced-data settings
- **Same galaxy at every tier.** Each layer is generated with its own seeded RNG, one star at a time, so a lower tier draws a prefix of the same buffers: a random subset of the same galaxy. Changing tier only changes the draw range; nothing is reallocated. Sparser tiers enlarge glow and dust sprites to keep the same coverage.
- **Governor.** It tracks the 90th-percentile frame time. If frames run more than 40% over budget for 2 seconds, it lowers the resolution (100 → 85 → 70 → 60%) and then the tier. It upgrades only after 10 seconds of headroom, and never again for the session once an upgrade has failed. The settled tier is remembered for the next visit.
- **GPU work:**
  - One draw call per layer, about 7 in total.
  - All motion happens in shaders, with no per-frame CPU buffer writes.
  - Sub-pixel stars dim rather than shimmer, and invisible points are culled in the vertex shader.
  - Point-size caps protect the fill rate.
- **Power saving:**
  - Rendering stops in hidden tabs.
  - Frame rate is capped at 30 fps on Low/Minimal tiers, in battery saver and on low battery.
  - Low tiers drop to 20 fps after 8 seconds without input.
  - Reduced motion turns off the roll and parallax and slows rotation tenfold.
- **Resilience.** If the WebGL context is lost, a fresh canvas is mounted. If WebGL is missing or start-up fails, the CSS fallback stays.

## Testing on a fast machine

- `?quality=minimal|low|medium|high|ultra|static` forces a tier.
- **Show Performance Overlay** in the controls displays tier, fps, star count, draw calls, DPR and scroll progress.
- Chrome DevTools → Performance → CPU 6× slowdown shows the governor stepping down.
