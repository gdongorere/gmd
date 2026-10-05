# Plan: "Take me home" — from the galaxy down to your front door

**Goal:** add a mode to `/stars` that starts at the Milky Way, flies to the Sun, crosses the real solar system, arrives at Earth and lands on the visitor's own location. At every stop the visitor can stop and explore: orbit the planets, step through time, or spin the globe.

**Starting point** (already shipped, see `plan-galaxy-ux.md` and `ux-implementation.md`):
- Explore mode with orbit, pan and zoom, fly-to places, fact cards with a "why it looks like this" note, labels, scale bar, time controls, guided tour, share links and image capture.
- A shared `galaxyBus`, camera poses with spline flights, quality tiers with a frame-time governor, a CSS fallback, and tests (Vitest and Playwright with axe).

---

## 1. Principles (inherited, plus new ones)

1. **Content first, calm by default, real and explained, instant everywhere.** Same rules as the galaxy plan. The `why` note on a card says where the model departs from reality.
2. **Honest scale.** Space is mostly empty, and the experience should say so. A *True scale* toggle shows real sizes (the planets vanish at solar-system distances). The default *Visible scale* enlarges bodies so they can be found, and says so on screen.
3. **Real positions, real time.** Planets sit where they are today, and Earth's night side is genuinely dark over the visitor's location right now. Time controls can move this forwards and backwards.
4. **Private by design.** The visitor's location is requested only after a button press, never leaves the browser, and is never stored. Shared links carry a coarse position only if the visitor opts in.

---

## 2. The experience

### Entry points
- A **mode switch** in the Explore top bar: `Galaxy · Solar System · Earth`.
- A **Take me home** button (also `H`) that runs the full descent below.
- The Sun's info card gains **Enter the solar system**.
- Direct links: `/stars?m=solar`, `/stars?m=earth`. The existing `?v=` links keep working unchanged.

### The descent (about 40 seconds, skippable with `Esc`, jump cuts under reduced motion)
| # | Scale | What you see | Ends with |
| --- | --- | --- | --- |
| 1 | Galaxy (existing) | Fly to the Sun pose already in `features.ts` | The Sun marker fills the view |
| 2 | **Solar neighbourhood** (1 unit = 1 light-year) | The Sun and its 50 nearest star systems (Alpha Centauri, Barnard's Star, Sirius…), with the Oort cloud as a faint shell | Alpha Centauri slides past, the Sun grows |
| 3 | **Heliosphere** (log-distance) | The Kuiper belt, Voyager 1 and 2 on their real paths, the heliopause | Pluto's orbit swings into view |
| 4 | **Solar system** (1 unit = 1 AU) | The Sun, eight planets on real orbits, the asteroid belt, major moons | Swing in to Earth |
| 5 | **Earth–Moon** | Earth, the Moon on its real orbit, the day/night line | Dive to the planet |
| 6 | **Earth** (1 unit = 1 Earth radius) | Atmosphere, clouds, city lights, then the pin on the visitor's location | Rest at about 400 km altitude, free to explore |

Every stop shows a one-line caption and the real distance ("4.2 light-years to the next star").

### Interaction in each mode
- **Solar System:** click or tap any body to fly to it and see its card. Orbit lines can be toggled. A date control with the existing play, pause and reverse transport. Speeds run from real time to one year every ten seconds. Planet list for keyboard and screen-reader users. A top-down orrery inset (the same role as today's mini-map).
- **Earth:** drag to spin with inertia, scroll or pinch to descend, tap anywhere to drop a second pin and read that place's local time, sunrise, sunset, day length and sun elevation. Layer toggles: clouds, city lights, borders, labels.
- **Everywhere:** the existing share link, image capture, labels (`L`), help (`?`) and tour (`T`) all keep working and gain the new places.

---

## 3. UI/UX design

This section is the design brief. Every control below reuses the existing Chakra tokens (`surface.glass`, `line.subtle`, `accent.*`, `variant="glass"`), the existing `GlassCard`, and the 44 px touch size. Nothing here introduces a new visual language.

### 3.1 Design goals
1. **One canvas, little chrome.** The scene is the interface. Controls sit at the edges, fade when idle (see 3.9), and never cover what the visitor is looking at.
2. **Always know where you are.** At 10¹⁸ scale range, disorientation is the main risk. The visitor can always answer "where am I, how far is that, how do I get back?" without thinking.
3. **Always in control.** The descent never traps. Any touch, key or scroll hands control back instantly.
4. **Teach by showing.** Distances come with something to feel (light-time, flight time), and sizes come with comparisons.
5. **Fast first impression.** Something moves within a second of entering a mode. Heavy assets arrive behind the scene, never in front of it.

### 3.2 Screen anatomy (desktop, ≥ 960 px)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ← Back   Explore the Solar System      [ Galaxy | Solar System | Earth ]  │  top bar
│                                                   ⌖  ☰  ⌗  ⤴  ◎  ?      │  tools (right)
│ ┌─ Scale ladder ─┐                                          ┌─ Orrery ─┐ │
│ │ ● Galaxy       │                                          │   inset  │ │
│ │ │ Neighbourhood│                                          └──────────┘ │
│ │ │ Heliosphere  │                                                       │
│ │ ◉ Solar System│  ← you are here                  ┌─ Info card ──────┐  │
│ │ │ Earth–Moon   │                                   │ Mars             │  │
│ │ │ Earth        │                                   │ facts · why      │  │
│ └────────────────┘                                   └──────────────────┘  │
│                                                                            │
│   ☉ ☿ ♀ ⊕ ♂ ♃ ♄ ⛢ ♆   ← body rail                                         │
│   ├ scale bar ┤   ▶ ⏪ [ Today · 5 Oct 2026 ▾ ] 1 day/s ▾     ⓘ Sizes ×N  │  bottom HUD
└──────────────────────────────────────────────────────────────────────────┘
```

| Zone | Contents | Notes |
| --- | --- | --- |
| Top-left | Back, mode title | Title changes with mode (kept `Text` style) |
| Top-centre | **Mode switch** | Segmented radio group, 44 px, `aria-checked`. Sits beside the toolbar; hidden behind a compact menu below 960 px |
| Top-right | Existing tools plus **Find me**, **Layers**, **Reset view** | Same `IconButton variant="glass"`, tooltips, `aria-pressed` |
| Left edge | **Scale ladder** (3.3) | Collapsible; collapses to a thin rail on small screens |
| Right edge | Orrery inset (solar), compass and altitude (Earth), mini-map (galaxy) | Replaces the mini-map per mode, same spot and size |
| Bottom-centre | Body rail, scale bar, time controls, **date chip**, scale badge | Existing glass pill, two rows when needed |
| Cards | Same slots as today (`cardPosition`) | Gain tabs and a size comparison (3.6) |

### 3.3 The scale ladder (the signature piece)
A slim vertical rail on the left that shows the whole journey as stops: **Galaxy › Neighbourhood › Heliosphere › Solar System › Earth–Moon › Earth › Your place**.
- A marker slides along the rail as the visitor zooms, so the descent is visible, not just felt.
- Each stop is a button: click to fly there (uses the same flight as the descent, shortened).
- A **live readout** beside the marker: distance to the focus in human units ("1.3 AU", "384,400 km", "408 km up") and its **light-time** ("light takes 8 min 19 s to get here").
- Hover or focus a stop for a one-line preview ("Where the Sun's wind meets interstellar space").
- Reuses the `role="list"` + buttons pattern used by labels, so it is a real navigation aid for keyboard and screen-reader users, not a decoration.

### 3.4 Take me home: the descent as a guided experience
- **Entry:** a prominent but quiet button in the top bar and on the Sun's card. While the Earth assets preload in the background, the button shows a subtle progress ring and never blocks. Pressing it before they are ready starts the descent with the low-resolution Earth.
- **Chapters:** a thin progress rail at the bottom with one dot per chapter (the six stops in section 2). Each dot is a button, so the visitor can jump or replay.
- **Captions:** one short line per chapter at the lower third, large enough to read on a phone, with a soft scrim for contrast. Each includes a real number ("4.2 light-years to the nearest star").
- **Controls:** `Pause`, `Skip`, `Exit to explore` stay visible for the whole descent (WCAG 2.2.2). A tap or drag on the scene pauses the descent and offers "Resume descent" instead of silently continuing.
- **Pacing:** durations scale with log-distance covered, with easing from `easeInOut`/`smootherstep` already in `camera.ts`. Longest chapter 8 s, none under 2 s.
- **Arrival:** the pin drops with a soft pulse and the location card opens collapsed, so the first view is the globe, not text.
- **Optional audio:** an ambient pad and a gentle tone at each chapter. **Off by default**, one toggle in settings, never autoplays.
- **Haptics (mobile):** one very light tick at each chapter change when supported. Off under reduced motion.
- **Reduced motion:** the same chapters as cuts with captions, plus "Next" and "Back" buttons. Nothing auto-advances unless the visitor presses play.

### 3.5 First-run orientation
- First visit to `/stars`: a single dismissible chip, "New: take a trip from the galaxy to your home. **Take me home**".
- First entry to Solar System: three coach marks, one at a time (click a planet, change the date, toggle true scale). Each is dismissible and skipped for good after one dismiss.
- First entry to Earth: one hint, "Drag to spin, scroll to descend, tap to drop a pin".
- Dismissal is remembered in `localStorage` (wrapped in try/catch, as elsewhere) and the experience works if storage is blocked.

### 3.6 Solar System mode
- **Body rail:** a horizontally scrollable strip from the Sun outwards. Each chip shows a small disc at a relative size, the name and the distance, and highlights the current focus. It is the always-visible, keyboard-friendly alternative to clicking in the scene (`1`–`9` map to it).
- **Focus plus context:** the selected body and its orbit are bright. Others dim to about 35 %. Hovering or focusing a chip lights its orbit in the scene.
- **Following:** a chip "Following Earth ✕" appears when the camera tracks a moving body. ✕ releases it. **Reset view** returns to the system overview.
- **Orbit lines:** thin, tinted from each body's real colour and checked for 3:1 contrast on the dark background. Trails fade behind a moving body.
- **Measure tool:** pick two bodies and see the distance in km and AU, plus light-time, drawn as a dashed line. This is the fastest way to *feel* the scale.
- **Scale toggle:** *Visible scale / True scale* animates (bodies shrink over about a second), and a badge always states the current rule ("Sizes ×1,000, distances true"). Never silent.
- **Time:**
  - The **date chip** shows the date and time, tap to edit with a native date input and a "Now" button.
  - **Speeds are named in human terms** — *1 s/s, 1 min/s, 1 hour/s, 1 day/s, 1 month/s, 1 year/s* — instead of bare "4×". The existing play, pause and reverse stay as they are.
  - Presets: *Today*, *Next solstice*, *Next full moon*, and **My birthday** ("Where were the planets when you were born?", typed locally, never stored).
  - Out-of-range dates (outside 1800–2050) show an inline message and clamp.
- **Moon phase** and **day length** appear on Earth and Moon cards, tied to the chosen date.

### 3.7 Earth mode
- **Gestures:** drag to spin with inertia, scroll or pinch to descend, double-tap or double-click to zoom to a point, two-finger twist to rotate the map, two-finger tilt to tilt. Every gesture has a visible alternative: **+/−** buttons, arrow-key rotation, and a **North up** button (a compass that doubles as reset).
- **Altitude readout:** "Altitude 12,400 km" and the unit changes naturally to metres near the ground. A comparison appears at landmarks: "ISS orbits at 408 km", "Airliners cruise at 11 km".
- **Day/night dial:** a 24-hour dial at the edge of the HUD scrubs the time of day, so the visitor can *see* the terminator sweep over their pin. A *Now* button snaps back.
- **Layers popover:** clouds, city lights, borders, labels, with plain-language names and `aria-pressed`. A *Reduce effects* switch for weak devices.
- **Location card:** the pin opens a card with:
  - the place name, local time and UTC offset,
  - **sunrise, sunset, day length** and the sun's **current elevation**,
  - a small **sun-path arc** (a day graph with the current moment marked),
  - tabs **Place · Sun · Sky**.
- **Sky from here (the story's payoff):** a *Sky* tab flips to a first-person view looking up from the pin, with a compass-marked horizon, the real stars, the Moon, the visible planets and the Milky Way band. The galactic centre is marked with a line such as "The centre of the galaxy rises at 21:40", closing the loop from the first screen of the experience. (Planned in S6; constellations lines are a stretch.)
- **Drop a second pin:** tap anywhere to compare ("It's 13 hours behind you, the sun is rising there").

### 3.8 Information design and microcopy
- **Voice:** warm, plain, concrete. Short sentences, real numbers, no jargon without a gloss. Match the existing card tone.
- **Every number has a human anchor.** "Neptune is 4.5 billion km away. Light takes 4 h 10 min to arrive." Analogies are verified, not decorative, and show their arithmetic in the card's *Why* panel.
- **Units:** km or miles and 12 or 24-hour clocks follow the browser locale, with a settings override. Numbers use tabular figures so readouts do not jitter.
- **Glossary:** first use of a term (AU, light-time, terminator, heliopause) gets a dotted-underline tooltip that is also available on focus and tap.
- **Cards** keep the current structure and add: a size comparison (the body next to Earth, or Earth next to the Sun), and `Overview · Facts · Why` tabs when content is long. The *Why it looks like this* note stays.
- **Sample captions:**
  - *Neighbourhood:* "The nearest star, Proxima Centauri, is 4.2 light-years away. That is about 40 trillion km."
  - *Solar system:* "Eight planets, and between them almost nothing."
  - *Earth:* "That is the daylight edge. Where you are, it's currently 21:42."

### 3.9 Motion and attention
- **Calm chrome:** after 4 s without input, secondary controls fade to about 30 % and the cursor hides in the descent. Any input restores them in 150 ms. Controls never fully disappear, so the UI is never "lost".
- **Comfort:** constant field of view, no camera shake, no screen-edge speed lines, gentle deceleration into every stop, and roll limited as it is today. Flights above 2 s have a subtle fade to avoid vestibular discomfort.
- **Easing:** reuse `easeInOut` and `smootherstep`. Flight duration scales with the log of the distance travelled.
- **Cross-fade between scales:** 600–900 ms, with matching framing so there is no pop.
- **Respect OS settings:** `prefers-reduced-motion` and `prefers-reduced-transparency` (glass becomes opaque).

### 3.10 Visual language
- **Colour:** body colours are used only on discs, orbit lines and chips, and always paired with a name (never colour alone). Orbit lines and labels pass 3:1 against the scene and 4.5:1 for text, with the same text-shadow and scrim treatment used by the galaxy labels.
- **Selection:** a thin reticle ring plus a leader line to the label. The pin is a pulsing dot with a pole, readable at any altitude.
- **Icons:** `react-icons/fi`, matching today's set. Planet glyphs are shown as text with a visible name, so they are not the only cue.
- **Depth:** one glass layer level for HUD and one strong level for cards, as in `GlassCard`.
- **Contrast over the Sun and bright limbs:** labels flip to a dark backing plate when over bright areas.

### 3.11 Responsive behaviour
| Width | Layout |
| --- | --- |
| ≥ 960 px | Full layout above |
| 600–959 px | Scale ladder collapses to a rail; orrery inset hidden; mode switch in the top bar |
| < 600 px | **Mode switch and body rail move to the bottom** (thumb zone). Cards become a **bottom sheet** with three snap points (peek, half, full) and a drag handle. Scale ladder becomes a compact progress bar with the current stop's name. |
| Landscape phone | Cards dock to the side and the HUD condenses to one row |

Additional rules: respect `env(safe-area-inset-*)`, use `dvh` so the mobile URL bar never hides controls, keep every target 44 px or larger, never depend on hover, and keep the viewport meta from allowing accidental page zoom while a gesture is active.

### 3.12 Accessibility (beyond the baseline)
- **Dragging alternatives (WCAG 2.5.7):** on-screen rotate, zoom, tilt and north-up buttons, plus arrow keys. No gesture is the only way to do anything.
- **Keyboard map:** `1`–`9` bodies, `E` Earth, `M` Moon, `H` Take me home, `O` orbits, `C` clouds, `N` north up, `R` reset view, `F` follow or unfollow, `[` and `]` step time, `Space` play or pause, `Esc` closes a card or the descent, `?` help. Shortcuts are listed in the help dialog and disabled while typing, as today.
- **Focus:** logical order (top bar → ladder → scene tools → card → HUD), a visible focus ring everywhere, and focus moves to a card when it opens and returns to its trigger when it closes.
- **Describe this view:** a button (and `D`) that announces a generated description: "Looking at Earth from 12,400 km. Africa and Europe are in daylight. Your pin is in the dark, 3 hours after sunset."
- **Data table alternative:** a *Positions* table (body, distance from the Sun, light-time, distance from Earth) for anyone who cannot or would rather not use the 3D view.
- **Descent:** captions are real text, announced through the existing live region, and nothing auto-advances without a pause control.
- **Low vision:** text scales to 200 % without loss, high-contrast labels option, no information in colour alone.
- **Cognitive load:** one new idea per card, plain language, consistent control placement across modes.

### 3.13 States and edge cases
| State | Behaviour |
| --- | --- |
| Loading | Scene appears at once with the best asset already cached. A subtle "Earth is arriving…" ring with real progress, never a blocking spinner. |
| Slow network | Low-resolution textures first, then sharpen. Offer *Reduce data* when `saveData` is on. |
| Texture or chunk failure | Fall back to a flat-colour body and a toast; the rest keeps working. |
| WebGL unavailable or context lost | Existing static fallback and recovery path, with a text version of the planet list and positions table. |
| Location denied | A clear card with how to re-enable it, plus *Search* and *Tap the globe*. |
| Location slow or inaccurate | "Finding you…" with a cancel, then offer the approximate area and say so. |
| Offline | Everything already loaded keeps working. Search is disabled with a message. |
| Date out of range | Inline message, clamp, and a *Today* button. |
| Reduced data or low power | Lower textures, no clouds, 30 fps cap, and the status pill explains why (reusing the existing "Why?" pattern). |

### 3.14 Delight (kept few, each one earns its place)
- **Birthday sky:** enter a date and see the planets as they were.
- **Light-time ticker:** a quiet readout that makes the distances physical.
- **Sunrise chaser:** one tap rotates Earth so the pin is at sunrise.
- **Postcard:** *Save image* gains a "postcard" option with a caption and the date. Coordinates are excluded unless the visitor chooses to include them.
- **Photo mode (`P`):** hides every control for a clean capture.

### 3.15 Settings
Extend the existing galaxy settings panel with a *Solar System & Earth* group: units, 12/24-hour clock, audio, haptics, reduce effects, texture quality (Auto, Low, High), and *Forget my location*. Presets (Cinematic, Scientific, Calm, Battery saver) apply to the new modes as well.

### 3.16 How the UX will be validated
- **Wireframes first:** the layout above is turned into annotated low-fidelity screens for desktop, tablet and phone before S2 starts, and reviewed by Gee.
- **Task tests (5 people, think-aloud):** "find Mars", "find out when the sun sets at home", "get back to the galaxy", "turn off clouds", "change the date to your birthday". Target: at least 4 of 5 complete each task unaided.
- **Heuristics:** a pass against orientation, control, feedback, recovery and consistency at the end of S3, S5 and S6.
- **Measures (local only, no tracking):** time to first interaction under 3 s, descent skip-or-complete behaviour observed in tests, location flow success across granted, denied and absent.
- **Automated:** axe scans of every mode and every card, keyboard-only e2e flows, and Playwright screenshots at three widths for layout regressions.

---

## 4. Fitting what exists

Nothing in the galaxy engine is rewritten. The new work plugs into the seams already there.

| Existing piece | How it is reused |
| --- | --- |
| `galaxyBus` (`explore`, `api`, `paused`) | The solar engine attaches the same `GalaxyApi` (`project`, `pose`, `capture`). Labels, mini-map and capture then work unchanged. `paused` becomes a small set of reasons (house viewer, solar handoff) so two owners cannot un-pause each other. |
| `ExploreMode.tsx` | Stays the shell: pointer, keyboard, toasts, help, tour. A `mode` state picks which engine and which side panel are active. The galaxy-specific parts move into a `GalaxyPanel` without changing behaviour. |
| `ExploreCards` (`InfoCard`, `TourCard`) | Fed by a shared `PlaceInfo` shape (`id, label, summary, facts, why`). Galaxy `Feature` and the new `Body` both satisfy it. |
| `ExploreHud` (`TimeControls`, `ScaleBar`) | `TimeControls` shows a date instead of "Myr" in solar and Earth modes. `ScaleBar` takes a unit (km, AU, ly) and picks nice values. |
| `ExploreLabels` | Takes a projector and a list of labelled items, so it no longer assumes galaxy features. |
| `camera.ts` / `explore.ts` | Spherical-arc poses, damping and clamped orbit maths are reused. A new pose adds a **focus target** (a body id plus an offset) so the camera follows moving bodies. `encodeView` / `decodeView` grow a mode prefix and stay backwards compatible. |
| `quality.ts`, `tiers.ts`, governor | Drive texture size, sphere segments, atmosphere and cloud quality, and star counts. Same ceiling detection and manual overrides (`?quality=`). |
| Chakra theme, `glass` buttons, tokens | All new UI uses them. No new styling system. |
| Tests | New tests follow `camera.test.ts` (continuity) and `explore.spec.ts` (e2e). |

---

## 5. The hard problem: eight orders of magnitude

Going from 100,000 light-years to a street is a factor of about 10¹⁸. A single float32 scene cannot do that: objects jitter, depth fighting appears and everything near the camera tears.

**Approach: a scale ladder plus camera-relative rendering.**
1. **Separate scenes per scale** (galaxy, neighbourhood, solar system, Earth), each with its own unit and its own `near`/`far`. Only the scenes needed for the current range are rendered, and they **cross-fade** during the dive.
2. **Positions live in float64 in JS** (ephemeris maths). Each frame, subtract the camera focus and upload small float32 offsets. Nothing large ever reaches the GPU, which removes jitter at every scale.
3. **Dynamic near/far** from the distance to the focused body (near ≈ 0.1% of that distance), plus a logarithmic depth buffer for the Sun-to-Neptune range.
4. **Findable at any distance.** Bodies smaller than N pixels are drawn as glowing sprites with a minimum screen size and swap to a real sphere as they grow. This also gives *Visible scale* for free.
5. **Lifecycle matches the galaxy engine.** The solar engine is a `createSolarEngine()` factory with `dispose()`, loaded with `import()` only when the mode is first entered, so the home page and the galaxy mode pay nothing for it. When the solar scene is fully opaque, the galaxy engine is paused.

---

## 6. Realism: data and maths

All computed in the browser; no server calls for positions.

### Time and positions
- **Planets:** the JPL "Approximate Positions of the Major Planets" Keplerian elements (valid 1800–2050, with their rates), solved with a Kepler-equation solver. Accuracy is arc-minutes, which is far finer than a screen can show. The date range is clamped to that window and says so.
- **Moon:** a compact analytic series (main terms of Meeus' lunar theory). Real phase and distance.
- **Other moons:** the Galilean moons, Titan and the major Saturn, Uranus and Neptune moons from mean elements, so they circle visibly. Others are omitted and the card says so.
- **Orientation:** axial tilt and rotation period per body (Uranus on its side, Venus backwards). Earth's rotation uses Greenwich Mean Sidereal Time, so the visitor's longitude really is under the right part of the Sun's light at this moment.
- **Day/night, sunrise and sunset:** NOAA solar-position formulae, which also give sun elevation and day length for any picked point.

### Bodies and extras
- Sun (animated surface, corona), Mercury to Neptune, Pluto and the Moon, Saturn's rings with Saturn's shadow on them, the main asteroid belt and Kuiper belt as procedural particle fields seeded for determinism (like the galaxy generator), and Voyager 1 and 2 as markers on their published trajectories.
- **Sky from Earth:** real stars from a bright-star catalogue (about 9,000 stars, a few hundred KB packed) plus an all-sky Milky Way band image, so the sky behind the planets matches where we really are. At the Earth stop the visitor can look up from their location and see the real Milky Way (the galaxy views and the sky finally agree).

### Earth detail
- Day map, night lights, cloud layer (slightly above the surface for parallax), ocean specular glint, topography bump, and an atmosphere shader (single-scattering Rayleigh and Mie) with a soft terminator.
- Country borders and about 300 labelled cities from Natural Earth (public domain), kept below 150 KB.
- **Stretch:** real zoom to street level with tiled imagery (NASA GIBS needs no API key) and elevation tiles, loaded only below about 50 km altitude.

### Honest approximations (shown in each card's `why`)
- Visible scale enlarges bodies and moon distances.
- The Sun is drawn as a lit sphere with a procedural surface, not simulated.
- Moon orbits are simplified and some small moons are left out.
- Asteroids and Kuiper objects are statistical, not the real catalogue.
- Before 1800 and after 2050, planet positions are not offered.

---

## 7. Finding the visitor

A single **Find me** button, never automatic.
1. **Browser geolocation** (needs a user gesture and permission). Used once, in memory only.
2. If denied or unavailable: **search a place** (one small, keyless geocoder behind a thin wrapper so the provider can change) or **tap the globe**.
3. If the visitor does nothing: land on the site's configured home (`profile.location`, currently Eswatini), labelled as such, not as "you".

Privacy rules, enforced by a unit test:
- No coordinates in analytics, logs or storage.
- Shared links include a position only when "Include my location" is ticked, rounded to 0.1° (about 11 km), and the default is off.
- A visible note says "Your location stays in your browser."

---

## 8. Proposed structure

```
src/lib/solar/
  constants.ts      AU, radii, tilts, rotation periods
  time.ts           Julian date, sidereal time, clamped range
  ephemeris.ts      Kepler solver; planet, Moon and moon positions
  bodies.ts         body data and `PlaceInfo` cards with `why` notes
  earth.ts          geo <-> vector, sub-solar point, sunrise/sunset
  ladder.ts         scale stages, focus-relative poses, true/visible scale
  journey.ts        the descent timeline and its captions
  location.ts       geolocation, geocoding wrapper, rounding
  sky.ts            star catalogue decode
  shaders/          atmosphere, earth, sun, rings
  engine.ts         createSolarEngine()
  *.test.ts
src/components/galaxy/explore/
  ModeSwitch.tsx, ScaleLadder.tsx, JourneyOverlay.tsx, BodyRail.tsx, DateChip.tsx
  SolarPanel.tsx, EarthPanel.tsx, LocationCard.tsx, SkyView.tsx, DayDial.tsx
  MeasureTool.tsx, CoachMarks.tsx, DescribeView.tsx, BottomSheet.tsx
public/solar/       textures (WebP), catalogues, borders, cities
```

---

## 9. Quality, performance and accessibility

- **Budgets:** the Solar System stop loads at most about 3 MB. The Earth stop adds about 4 MB at 2k and about 12 MB at 4k on high tiers. Textures load progressively with a real progress readout (as in the house viewer), and a low-resolution version shows first.
- **Tiers:** texture size, sphere segments, cloud and atmosphere quality, star count and orbit-line smoothness follow the existing tiers. Battery saver and `saveData` cap at 2k and skip clouds.
- **Frame rate:** the same governor drops resolution before dropping features. Target 60 fps on a mid-range phone at the Medium tier.
- **Keyboard, screen readers, reduced motion, touch:** specified in full in sections 3.4, 3.11 and 3.12. Number keys keep their galaxy meaning in Galaxy mode.
- **Credits:** an in-app credits panel names the data and texture sources and their licences.

---

## 10. Phases

Each phase ships on its own and leaves `/stars` working.

| Phase | Deliverable | UX in this phase | Done when |
| --- | --- | --- | --- |
| **S0. Foundations** | `PlaceInfo` shape; labels, scale bar and time controls generalised; `paused` reasons; mode state and URL scheme with back-compat | **Wireframes** (desktop, tablet, phone) reviewed; `BottomSheet` and mode switch built; unit and clock settings | All existing tests pass unchanged and Galaxy mode is visually identical |
| **S1. Ephemeris and time** | `time`, `ephemeris`, `earth` with unit tests | Human-speed names and date-chip logic (pure, tested); out-of-range handling | Planet positions match JPL Horizons within tolerance for sample dates; sunrise and sunset match NOAA within 2 minutes |
| **S2. Solar System mode** | Engine, ladder and camera-relative rendering, Sun, planets, orbits, belt, labels, cards, time controls, orrery inset | Body rail, focus-plus-context, following chip, scale badge and toggle, measure tool, date chip with presets, coach marks | You can fly to every planet and scrub a year without jitter, and a new visitor completes "find Mars" unaided |
| **S3. Earth mode** | Textures, atmosphere, clouds, night lights, spin and descent, pin, local-time card, borders and cities | Gesture set with button alternatives, compass, altitude readout, day/night dial, layers popover, location card with sun-path arc | The terminator and city lights are right for the current moment |
| **S4. Find me** | Geolocation, search, tap-to-pin, fallback, privacy test | Pre-prompt explainer, every state in 3.13, *Forget my location*, default-place labelling | Works with permission granted, denied and absent, and each path is understandable without help |
| **S5. The descent** | Neighbourhood and heliosphere scales, Voyagers, bright-star sky, the full cross-faded journey, captions, `H` | **Scale ladder**, chapter rail, captions, pause/skip/exit, background preload ring, optional audio and haptics, reduced-motion cuts | The whole trip runs at a steady frame rate with no popping, and control can be taken at any moment |
| **S6. Polish** | Moons, Saturn's rings and shadow, Moon phase, credits, tour steps, tier tuning on real hardware, share links with optional location | **Sky from here**, *Describe this view*, positions table, postcard and photo mode, unit/clock polish, usability tests and fixes | axe clean, budgets met, task tests pass (3.16), reviewed on a real phone and a real GPU |
| **S7. Stretch** | Street-level tiled imagery and elevation, ISS and satellites, eclipses, constellation lines | ISS and landmark altitude comparisons, eclipse preset | Optional, only if S6 is solid |

---

## 11. Testing

- **Unit (Vitest):** Kepler solver convergence, planet positions against reference values, sidereal time, sub-solar point, sunrise and sunset against NOAA for several latitudes (including polar day and night), geo to vector round trip, pose continuity across ladder stages (modelled on `camera.test.ts`), URL encode and decode round trip with the old `?v=` format, location rounding and the "not in the link by default" rule.
- **E2E (Playwright):** switch modes, jump between ladder stops, pause and resume the descent, take control mid-descent, bottom-sheet snap points on a phone viewport, keyboard-only completion of every task in 3.16, run and skip the descent, keyboard flights, geolocation granted (mocked), denied and absent, share link restore, reduced-motion path, and **axe WCAG 2.2 AA scans in each mode** (extending `a11y.spec.ts`).
- **Visual:** software-rendered Chromium cannot judge atmosphere, clouds or bloom (the same limit noted in `ux-implementation.md`). Those are signed off on real hardware, and the plan does not claim otherwise.

---

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| Float precision across scales | Float64 positions, camera-relative uploads, dynamic near and far (section 5) |
| Texture weight on mobile | Tiered sizes, on-demand loading, low-resolution first, `saveData` cap |
| Texture licences | Prefer public-domain NASA sources; anything under CC BY gets an in-app credit. Confirm each licence at download time. |
| Geolocation denied or inaccurate | Search, tap-to-pin and a clearly labelled default |
| Looks empty at true scale | Visible scale by default, with the toggle and an on-screen note |
| GPU cost of two engines | Galaxy paused once the solar scene is opaque; solar chunk loaded lazily |
| Planet positions outside 1800–2050 | Date range clamped, with a message |
| Too many controls for a phone | Mode-specific toolbars, bottom sheet, chrome that fades, and wireframes reviewed before any build (S0) |
| Disorientation across scales | Scale ladder, light-time readout, *Reset view* and *North up* always one tap away |
| Motion discomfort in the descent | Constant field of view, eased stops, fades on long flights, pause and skip always visible, reduced-motion cuts |
| Descent feels like a trap or a delay | Never blocks, instantly interruptible, preloads behind the scene |

---

## 13. Decisions for Gee

I have recommended a default for each, so none of these block the start.

1. **Imagery source.** Recommended: NASA public-domain textures at 2k/4k, with street-level tiles left to S7.
2. **Geocoder.** Recommended: one keyless provider behind a wrapper. Alternative: no search, only Find me and tap-the-globe, which avoids any third-party request.
3. **Default landing place** when location is unavailable. Recommended: Eswatini, from `profile.location`.
4. **Scope of the descent.** Recommended: include the neighbourhood and heliosphere stops (S5). They are the part that makes the zoom feel earned, but S2–S4 are valuable without them.
5. **Sky from here.** Recommended: include it in S6. It is the moment that ties the galaxy, the solar system and the visitor's own sky together.
6. **Audio.** Recommended: build the optional ambient audio, off by default. Alternative: skip audio and keep haptics only.
7. **Wireframe review.** Recommended: you sign off the annotated wireframes at the end of S0, before the engine work begins.
