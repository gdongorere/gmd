# Plan: a world-class Milky Way experience

**Goal:** turn the galaxy from a background into the signature experience of the site. It should feel cinematic and explorable, teach real astronomy, never get in the way of the content, and stay smooth on a budget phone.

**Starting point** (already shipped, see `docs/milky-way-starfield.md`):
- scientifically grounded model
- five quality tiers, a frame-time governor and a CSS fallback
- scroll camera flight with roll, and pointer parallax
- a "Milky Way Controls" panel

---

## 1. Experience principles

1. **Content first.** The galaxy frames the content and never competes with it. Text over the galaxy must always meet WCAG AA contrast.
2. **Every motion means something.** The camera moves because the story moves (section to section), not just because the scroll bar moved.
3. **Real and explained.** Every feature you can see (the bar, an arm, the Sun, the Magellanic Clouds) can be named and explained in one tap.
4. **Calm by default, wild on request.** The default is gentle; cinematic extras are opt-in. Motion-sensitive visitors are fully respected.
5. **Instant everywhere.** Something meaningful appears in under 300ms on any device, there is no layout shift, and scrolling never stutters.

---

## 2. Narrative scroll (sections become waypoints)

**Problem today:** the camera keys off raw scroll percentage. On a long page the "edge-on" moment lands in an arbitrary place, and every page reuses the same flight.

**Plan:**
- **Waypoint API.** Sections declare a camera waypoint, e.g. `<GalaxyWaypoint view="face-on" />` or a `data-galaxy-view="edge-on"` attribute. An `IntersectionObserver` picks the active section, and the camera eases between waypoint poses using the existing catmull-rom spline.
- **Named views** in `camera.ts`:

  | View | Pose |
  | --- | --- |
  | `face-on` | full spiral from above |
  | `tilted` | 60° tilt |
  | `edge-on` | through the disk, dust across the bulge |
  | `arm-flyby` | low pass along an arm |
  | `core` | close to Sgr A* |
  | `home` | at the Sun, looking at the centre |
  | `lmc` | out to the Large Magellanic Cloud |
  | `halo-overview` | wide view including the halo |

- **Per-page stories:**

  | Page | Story |
  | --- | --- |
  | Home | hero `face-on` → Featured projects `arm-flyby` → Skills `tilted` → Experience `edge-on` → Contact/Resume `home` ("this is where I am") |
  | Projects | each project card glides the camera to a different star-forming knot |
  | 404 | the camera drifts out into the halo: "Lost in space" |
  | `/stars` | free explore mode (§4) |

- **Route continuity.** The engine already lives in `providers.tsx`, so it survives navigation. On a route change the camera flies to the new page's first waypoint instead of snapping.
- **Progress rail.** An optional thin vertical rail on desktop shows the section dots and the current view name. It doubles as section navigation (scrollspy).
- **Roll comfort.** Roll becomes per-waypoint (0° by default, 360° only between `edge-on` and `home`). Mobile defaults to 180° maximum, and a "Comfort mode" removes the roll entirely.

**Acceptance:** scrolling the home page always reaches the same view at the same section. Back/forward navigation restores the camera pose. No cut is visible during route changes.

---

## 3. Readability and contrast over the galaxy

- **Adaptive scrim.** Render a soft radial or linear darkening layer behind content blocks: a CSS gradient tied to section bounds, so it adds no GPU cost. Target text contrast ≥ 4.5:1 against the brightest galaxy pixel underneath.
- **Focus dimming.** When a content card is hovered or focused, or the visitor is reading (scroll velocity ≈ 0 for 2 seconds), the galaxy brightness eases to about 70%. It restores on scroll.
- **Exclusion zone.** Pass the content column's screen rect to the shader as a uniform so the bulge glow under paragraphs is attenuated (`uContentRect`, a smooth falloff mask).
- **Contrast check in CI:** a Playwright script screenshots each section and samples the pixels behind text to compute contrast (§10).

---

## 4. Explore mode (`/stars`)

A full-screen, interactive galaxy for the curious visitor, with a clear way back.

| Feature | Detail |
| --- | --- |
| Orbit controls | Drag to orbit, wheel or pinch to zoom, two-finger pan. Inertia and damping. Clamp to sensible distances. |
| Fly-to | Double-click/tap any point to fly there. A **Fly to** menu offers Sgr A*, the Sun, the Orion Spur, the bar ends, the Perseus and Scutum–Centaurus arms, a globular cluster, the LMC and the SMC. |
| Labels | Toggleable HTML labels anchored to world positions (arm names, "Galactic bar 27°", "Sun (you are here)", "LMC 163,000 ly"). They fade with distance, avoid overlapping each other, and use DOM labels kept to 20 or fewer. |
| Info cards | Tapping a labelled feature opens a card: a two-sentence fact, the real measurement, and a "Why it looks like this" note on the artistic approximation. |
| Time controls | Play/pause, speed (×0.25 to ×8), reverse, and an elapsed-time readout ("+46 Myr", "0.2 galactic years"). |
| Scale and orientation | A scale bar (10,000 ly), a compass (galactic north, direction to l = 0°), and a mini-map of the face-on galaxy marking the camera position. |
| Guided tour | A 6-step narrated tour (Next/Back, auto-advance off by default). Each step is a waypoint, a caption and a highlighted feature. |
| Screenshot / share | "Copy link to this view" encodes the camera pose, time and layers in the URL. "Save image" uses `canvas.toBlob` (with `preserveDrawingBuffer` only during capture). |
| Exit | Persistent "Back to site" button. Esc closes panels, then exits. |

**Keyboard:**

| Key | Action |
| --- | --- |
| Arrow keys / WASD | orbit |
| + / − | zoom |
| Space | play/pause |
| 1–8 | fly-to presets |
| L | labels |
| T | tour |
| ? | help |

**Acceptance:** everything above works by touch, mouse and keyboard. Labels never overlap. The tour completes on a mid-range phone at 30fps or better.

---

## 5. Controls panel 2.0

**Current issues:**
- 20+ controls are always visible.
- No presets, and settings are lost on reload.
- The panel is fixed bottom-right, covering content on phones.
- Slider labels aren't programmatically tied to the slider thumb.

**Plan:**
- **Presets** (segmented control at the top):

  | Preset | Settings |
  | --- | --- |
  | **Cinematic** | full roll, twinkle, bloom on capable tiers |
  | **Scientific** | labels, no twinkle, true-ish colours, Sun marker |
  | **Calm** | no roll, slow rotation, low parallax |
  | **Battery saver** | Low tier, 30fps cap, no glow |
  | **Custom** | appears automatically when any setting changes |

- **Progressive disclosure:** "Essentials" (preset, brightness, motion, quality) are open by default. "Advanced" (layers, black hole, orbit speed, density) is collapsed.
- **Persistence:** save settings to `localStorage` (schema-versioned, wrapped in try/catch), plus a "Reset this section" control and a global reset with **Undo** (toast with a 6-second window).
- **Layout:**
  - Desktop: a floating panel that can be docked left/right.
  - Mobile: a Chakra `Drawer` bottom sheet with a drag handle and snap points (peek / half / full). It never covers the hero CTA.
- **Discoverability:**
  - A small galaxy FAB with a tooltip.
  - A one-time coach mark ("Tune the galaxy ✦") after 10 seconds on the first visit, dismissed forever on interaction.
  - Keyboard shortcut **G**.
- **Live feedback:**
  - The status pill shows tier and fps, with a ⚠ when the governor stepped down, plus a "Why?" popover listing `stats.reasons`.
  - A "Try higher quality" button runs a 5-second benchmark and keeps the higher tier only if it holds.
- **Accessibility:**
  - Every slider gets an `aria-label` / `aria-valuetext` with units ("4 minutes per solar orbit").
  - Every switch has a visible label.
  - Panel focus is trapped while it's open as a drawer.
  - An **"Override OS reduced-motion"** switch, off by default.

---

## 6. Visual fidelity roadmap (by tier)

| Upgrade | Tiers | Approach | Cost guard |
| --- | --- | --- | --- |
| HDR + tone mapping | High, Ultra | Render to a `HalfFloatType` target, then an ACES filmic pass. This fixes the overexposed bulge in the "home" view. | Skipped where `EXT_color_buffer_half_float` is missing |
| Bloom | Ultra (High optional) | Dual-Kawase downsample/upsample at ¼ resolution on bright pixels only | Under 1.5ms on a desktop iGPU |
| Gravitational lensing | High, Ultra | A screen-space distortion ring around the Sgr A* billboard samples the scene texture (requires the HDR target) | Pixels within the BH quad only |
| Accretion disk tilt | All | Orient the disk to a fixed spin axis rather than a billboard; keep the Doppler side consistent | — |
| Diffraction spikes | Ultra | A 4-spike sprite only for the brightest 0.5% of young stars | Separate small draw |
| Volumetric-looking dust | Medium+ | Render dust to a ¼-resolution absorption buffer, blur, then multiply. This replaces the beaded sprites. | One extra low-res pass |
| Nebula detail | High+ | Procedural fbm noise inside the HII sprite fragment shader; varied Hα/[OIII] tint | Small sprites only |
| Star colour realism | All | Calibrate the blackbody→sRGB curve against Gaia colour–magnitude data; slightly desaturate M dwarfs | — |
| Distant galaxies | Medium+ | A sparse skybox of faint background galaxies (Andromeda at its real direction and 2.5 Mly) | ≤ 200 sprites |
| Motion blur on fast fly-to | Ultra | Accumulation blend while the camera's angular velocity is high | Auto-off below 55fps |

All upgrades go through the existing governor. Each feature registers a cost estimate, and the governor disables the most expensive first before dropping the tier.

---

## 7. Performance and loading UX

- **Loading choreography:**
  1. The CSS galaxy appears (0ms).
  2. Stars fade in progressively: the worker posts the glow layer first, then old stars, then young stars.
  3. The canvas cross-fades in.
  4. No spinner, ever.
- **Generation streaming.** The worker sends layers in priority order, so the first stars appear in under 150ms on Low.
- **Idle cost:** pause rendering entirely when the galaxy is fully covered (modal open, explore panel full-screen) or the page has been static for 30 seconds on Low/Minimal. Resume on any input.
- **Real-user telemetry (privacy-safe):** report the settled tier, median fps, governor downgrades and time-to-first-star through Vercel Analytics custom events. No identifiers. This tells us whether thresholds need tuning.
- **Budgets:**

  | Metric | Budget |
  | --- | --- |
  | Galaxy JS chunk | ≤ 180 KB gzipped |
  | Time to first star | ≤ 300ms after hydration |
  | Main-thread blocking | 0 long tasks > 50ms from the galaxy |
  | GPU frame time | Medium 8ms, Low 12ms, Minimal 16ms (reference devices in §10) |

---

## 8. Accessibility

- The canvas stays `aria-hidden`. Add a visually hidden description ("Animated 3D model of the Milky Way; decorative") and, in explore mode, an `aria-live` region announcing fly-to destinations and info-card titles.
- Full keyboard parity (§4). Visible focus rings on all controls (fixes the near-invisible theme focus style).
- **Reduced motion:**
  - no roll, no auto camera flights (instant cross-fade between waypoints instead)
  - rotation ×0.1, no twinkle
  - Explore mode still works
- No flashing above 3Hz (twinkle amplitude is already 0.12; enforce in review).
- Colour-blind check of labels and info-card accents (do not rely on red/green).

---

## 9. Code architecture changes

- `src/lib/galaxy/views.ts`: named poses and per-page story definitions.
- `src/components/galaxy/GalaxyWaypoint.tsx`: a section marker with an IntersectionObserver.
- `src/lib/galaxy/engine.ts`: add a command API (`flyTo(view | pose, opts)`, `setTime`, `pause`, `setFocusDim`, `pickFeature(x, y)`), exposed through a `useGalaxy()` hook in context.
- `src/lib/galaxy/features.ts`: a catalogue of named features (position, label, fact, source).
- `src/lib/galaxy/postfx.ts`: HDR target, tone map, bloom, lensing; tier-gated and lazy-imported.
- Settings persistence: `useStarfield` gains `presets`, `applyPreset`, `undoReset`, and a localStorage sync.
- **Tests:**
  - Vitest unit tests for `generate.ts` (determinism, no NaN, prefix property), `quality.ts` (governor hysteresis), and `camera.ts` (spline continuity).
  - Playwright visual snapshots per waypoint at the Low tier (SwiftShader).

---

## 10. QA and device matrix

| Class | Reference devices | Expected tier |
| --- | --- | --- |
| Flagship desktop | RTX / Apple M-series | Ultra 60fps |
| Office laptop | Intel Iris Xe / UHD 620 | High or Medium 60fps |
| Recent phone | iPhone 13+, Pixel 7 | High or Medium |
| Budget phone | 2–3 GB RAM, Mali-G52 / Adreno 610 | Low 30fps |
| Very old | Mali-T8xx, 2 cores | Minimal 30fps |
| No WebGL | — | Static CSS |

**Checklist per release:**
- Lighthouse performance ≥ 90 on mobile.
- CLS 0, INP < 200ms.
- Waypoint snapshots match.
- Contrast script passes.
- Keyboard-only walkthrough of explore mode.
- Reduced-motion walkthrough.
- 10-minute soak test with no memory growth.

---

## 11. Phased roadmap

| Phase | Scope | Size | Done when |
| --- | --- | --- | --- |
| G1 | Waypoint API, named views, home story, route continuity, per-waypoint roll | M | §2 acceptance passes |
| G2 | Readability: scrims, focus dimming, content exclusion mask, contrast CI | S | All sections ≥ 4.5:1 |
| G3 | Controls 2.0: presets, persistence, drawer on mobile, coach mark, a11y fixes | M | Usability check with 3 people finds no blockers |
| G4 | Explore mode: orbit controls, fly-to, labels, info cards, time controls, share link | L | §4 acceptance passes |
| G5 | Guided tour + feature catalogue + 404 "lost in space" | M | Tour completes on a budget phone |
| G6 | Fidelity: HDR/tone mapping, Kawase bloom, dust absorption buffer, tilted accretion disk | L | No tier loses fps versus G5 baseline |
| G7 | Lensing, diffraction spikes, Andromeda/background galaxies, motion blur | M | Ultra only, governor-gated |
| G8 | Telemetry, tests, device-lab pass, docs | S | Budgets in §7 met on the §10 matrix |

---

## 12. Open questions (recommended defaults)

| Question | Recommended default |
| --- | --- |
| Should the roll stay at 360°? | Yes, but only between `edge-on` and `home`; 180° on mobile; 0° in Comfort mode |
| Sgr A* size | Keep 26px exaggerated, with an "Astronomically accurate scale" toggle in explore mode |
| Labels on by default in explore mode? | Yes, the major ones (arms, Sun, Sgr A*); minor ones on zoom |
| Telemetry | Enable aggregated, anonymous events via Vercel Analytics |
| Tour voice-over? | No audio by default; captions only |
