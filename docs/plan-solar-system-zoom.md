# Plan: "Take me home" — from the galaxy down to your front door

**Goal:** add a mode to `/stars` that starts at the Milky Way, flies to the Sun, crosses the real solar system, arrives at Earth and lands on the visitor's own location. At every stop the visitor can stop and explore: orbit the planets, step through time, or spin the globe.

**Starting point** (already shipped, see `plan-galaxy-ux.md` and `ux-implementation.md`):
- Explore mode with orbit, pan and zoom, fly-to places, fact cards with a "why it looks like this" note, labels, scale bar, time controls, guided tour, share links and image capture.
- A shared `galaxyBus`, camera poses with spline flights, quality tiers with a frame-time governor, a CSS fallback, and tests (Vitest and Playwright with axe).

---

## 1. Principles (inherited, plus three new ones)

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

## 3. Fitting what exists

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

## 4. The hard problem: eight orders of magnitude

Going from 100,000 light-years to a street is a factor of about 10¹⁸. A single float32 scene cannot do that: objects jitter, depth fighting appears and everything near the camera tears.

**Approach: a scale ladder plus camera-relative rendering.**
1. **Separate scenes per scale** (galaxy, neighbourhood, solar system, Earth), each with its own unit and its own `near`/`far`. Only the scenes needed for the current range are rendered, and they **cross-fade** during the dive.
2. **Positions live in float64 in JS** (ephemeris maths). Each frame, subtract the camera focus and upload small float32 offsets. Nothing large ever reaches the GPU, which removes jitter at every scale.
3. **Dynamic near/far** from the distance to the focused body (near ≈ 0.1% of that distance), plus a logarithmic depth buffer for the Sun-to-Neptune range.
4. **Findable at any distance.** Bodies smaller than N pixels are drawn as glowing sprites with a minimum screen size and swap to a real sphere as they grow. This also gives *Visible scale* for free.
5. **Lifecycle matches the galaxy engine.** The solar engine is a `createSolarEngine()` factory with `dispose()`, loaded with `import()` only when the mode is first entered, so the home page and the galaxy mode pay nothing for it. When the solar scene is fully opaque, the galaxy engine is paused.

---

## 5. Realism: data and maths

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

## 6. Finding the visitor

A single **Find me** button, never automatic.
1. **Browser geolocation** (needs a user gesture and permission). Used once, in memory only.
2. If denied or unavailable: **search a place** (one small, keyless geocoder behind a thin wrapper so the provider can change) or **tap the globe**.
3. If the visitor does nothing: land on the site's configured home (`profile.location`, currently Eswatini), labelled as such, not as "you".

Privacy rules, enforced by a unit test:
- No coordinates in analytics, logs or storage.
- Shared links include a position only when "Include my location" is ticked, rounded to 0.1° (about 11 km), and the default is off.
- A visible note says "Your location stays in your browser."

---

## 7. Proposed structure

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
  ModeSwitch.tsx, JourneyOverlay.tsx, SolarPanel.tsx, EarthPanel.tsx, LocationCard.tsx
public/solar/       textures (WebP), catalogues, borders, cities
```

---

## 8. Quality, performance and accessibility

- **Budgets:** the Solar System stop loads at most about 3 MB. The Earth stop adds about 4 MB at 2k and about 12 MB at 4k on high tiers. Textures load progressively with a real progress readout (as in the house viewer), and a low-resolution version shows first.
- **Tiers:** texture size, sphere segments, cloud and atmosphere quality, star count and orbit-line smoothness follow the existing tiers. Battery saver and `saveData` cap at 2k and skip clouds.
- **Frame rate:** the same governor drops resolution before dropping features. Target 60 fps on a mid-range phone at the Medium tier.
- **Keyboard:** `1`–`9` fly to the Sun and planets in the Solar mode, `E` Earth, `M` Moon, `H` Take me home, `O` orbits, `C` clouds. Number keys keep their galaxy meaning in Galaxy mode.
- **Screen readers:** every body and place is reachable as a plain button list (the canvas stays `aria-hidden`), flights are announced through the existing live region, and the descent has captions.
- **Reduced motion:** the descent becomes a sequence of cuts with captions, and time defaults to paused.
- **Touch:** the existing pointer, pinch and pan gestures are reused, targets stay 44 px or larger, and the location card becomes a bottom sheet on phones.
- **Credits:** an in-app credits panel names the data and texture sources and their licences.

---

## 9. Phases

Each phase ships on its own and leaves `/stars` working.

| Phase | Deliverable | Done when |
| --- | --- | --- |
| **S0. Foundations** | `PlaceInfo` shape; labels, scale bar and time controls generalised; `paused` reasons; mode state and URL scheme with back-compat | All existing tests pass unchanged and Galaxy mode is visually identical |
| **S1. Ephemeris and time** | `time`, `ephemeris`, `earth` with unit tests | Planet positions match JPL Horizons within tolerance for sample dates; sunrise and sunset match NOAA within 2 minutes |
| **S2. Solar System mode** | Engine, ladder and camera-relative rendering, Sun, planets, orbits, belt, labels, cards, time controls, orrery inset | You can fly to every planet and scrub a year without jitter |
| **S3. Earth mode** | Textures, atmosphere, clouds, night lights, spin and descent, pin, local-time card, borders and cities | The terminator and city lights are right for the current moment |
| **S4. Find me** | Geolocation, search, tap-to-pin, fallback, privacy test | Works with permission granted, denied and absent |
| **S5. The descent** | Neighbourhood and heliosphere scales, Voyagers, bright-star sky, the full cross-faded journey, captions, `H` | The whole trip runs at a steady frame rate with no popping |
| **S6. Polish** | Moons, Saturn's rings and shadow, Moon phase, credits, tour steps, tier tuning on real hardware, share links with optional location | axe clean, budgets met, reviewed on a real phone and a real GPU |
| **S7. Stretch** | Street-level tiled imagery and elevation, ISS and satellites, eclipses | Optional, only if S6 is solid |

---

## 10. Testing

- **Unit (Vitest):** Kepler solver convergence, planet positions against reference values, sidereal time, sub-solar point, sunrise and sunset against NOAA for several latitudes (including polar day and night), geo to vector round trip, pose continuity across ladder stages (modelled on `camera.test.ts`), URL encode and decode round trip with the old `?v=` format, location rounding and the "not in the link by default" rule.
- **E2E (Playwright):** switch modes, run and skip the descent, keyboard flights, geolocation granted (mocked), denied and absent, share link restore, reduced-motion path, and **axe WCAG 2.2 AA scans in each mode** (extending `a11y.spec.ts`).
- **Visual:** software-rendered Chromium cannot judge atmosphere, clouds or bloom (the same limit noted in `ux-implementation.md`). Those are signed off on real hardware, and the plan does not claim otherwise.

---

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| Float precision across scales | Float64 positions, camera-relative uploads, dynamic near and far (section 4) |
| Texture weight on mobile | Tiered sizes, on-demand loading, low-resolution first, `saveData` cap |
| Texture licences | Prefer public-domain NASA sources; anything under CC BY gets an in-app credit. Confirm each licence at download time. |
| Geolocation denied or inaccurate | Search, tap-to-pin and a clearly labelled default |
| Looks empty at true scale | Visible scale by default, with the toggle and an on-screen note |
| GPU cost of two engines | Galaxy paused once the solar scene is opaque; solar chunk loaded lazily |
| Planet positions outside 1800–2050 | Date range clamped, with a message |

---

## 12. Decisions for Gee

I have recommended a default for each, so none of these block the start.

1. **Imagery source.** Recommended: NASA public-domain textures at 2k/4k, with street-level tiles left to S7.
2. **Geocoder.** Recommended: one keyless provider behind a wrapper. Alternative: no search, only Find me and tap-the-globe, which avoids any third-party request.
3. **Default landing place** when location is unavailable. Recommended: Eswatini, from `profile.location`.
4. **Scope of the descent.** Recommended: include the neighbourhood and heliosphere stops (S5). They are the part that makes the zoom feel earned, but S2–S4 are valuable without them.
