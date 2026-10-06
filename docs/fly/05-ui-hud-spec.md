# `/fly` — UI / HUD specification

Companion to `docs/plan-fly.md` §3 and §13. Reuses the existing design tokens (`surface.glass`, `line.subtle`, `accent.*`, `variant="glass"`),
the Chakra components and the lessons from the `/stars` HUD (slim overlays, pop-over menus, hide-interface, safe areas). **The scene is the interface:
controls are small, sit at the edges, fade when idle and never cover the view.**

## 1. Principles

1. **One canvas, little chrome.** Default HUD is a few quiet instruments. A single key (`I`) removes everything but the toggle.
2. **Always know where you are.** Body, altitude, speed tier, light-time to target: the same "where am I, how far, how do I get back" promise as the scale ladder.
3. **Always in control.** Guided sequences (tutorial, autopilot, descent) show **Pause / Skip / Exit** continuously (WCAG 2.2.2); any manual input hands control back.
4. **Warnings are loud, instruments are quiet.** Normal telemetry is dim; warnings use shape + colour + (optional) sound.
5. **Fast first impression.** The ship is visible and moving within a second; the heavy HUD pieces mount after the first frame.
6. **Everything keyboard-operable**; every control has an accessible name; no hover-only features.

## 2. Screen anatomy (desktop ≥ 960 px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ←  Fly      [ Mars ▾ ]  [ View ]                          page toolbar (right)│  top bar (small)
│                                                                              │
│  ┌────────┐                                                      ┌─────────┐ │
│  │ TARGET │                                                      │ MINIMAP │ │  left: target card (optional)
│  │ Phobos │                                                      │ (orrery │ │  right: map inset (optional)
│  │ 9,420km│                                                      └─────────┘ │
│  └────────┘            ◜ nav sphere ◝  (prograde ● retro ○)                  │
│                                                                              │
│          caption (fades)                                                     │
│   ALT 12.4 km   ▲ 83 m/s   SPD 1.2 km/s  MACH 4.1    ▮▮▮▮▯ THR 70 %          │  bottom flight strip
│   [1 Hover][2 Atmos][3 Orbit][4 Transfer][5 Cruise][6 Light]   ⚙ G ⛭ …       │  tier dial + assists
│   HULL 640 K ▓▓▓▓░  G 2.1  Q 18 kPa   FUEL ▓▓▓▓▓░   outside −52 °C 0.4 kPa    │  status line (tiny)
└──────────────────────────────────────────────────────────────────────────────┘
```

| Zone | Contents | Notes |
|---|---|---|
| Top-left | back arrow, body pop-over (**Bodies ▾**), **View** pop-over | same pattern as `/stars`; View holds toggles (labels, orbits, true-scale markers, comfort) |
| Top-right | the page toolbar already on the site (share, camera, help) | kept clear |
| Left (optional) | **Target card**: name, distance, light-time, relative speed, "Go to…" | shown when a target is chosen; collapsible |
| Right (optional) | **Mini-map** inset (orrery with ship) | 160 px; collapsible |
| Centre | **nav sphere** (small, translucent): prograde/retrograde/normal/radial/target markers | hides when stationary on a pad |
| Bottom | one **flight strip** + **tier dial** + a tiny **status line** | single slim cluster; matches `/stars` bottom strip |
| Overlays | **captions** (fade after 6 s), **warnings** (top-centre), **toasts** | warnings never auto-hide while active |

## 3. Mobile layout (360–430 px, portrait)

- Top: back + **Bodies ▾** + **View** (one row). Page toolbar wraps to two rows as in `/stars` (already designed to not overlap).
- Left/right insets are **hidden**; the target card becomes a **bottom sheet** on tap.
- The flight strip shows **speed, altitude, tier** only; the status line is a tap-to-expand row.
- **Dual virtual sticks** (left: translate/yaw; right: pitch/roll) with a throttle slider on the right edge; 44 px minimum targets, `touch-action: none`, safe-area insets.
- Landscape: sticks at the lower corners, flight strip centred; the page clock stays off by default (toggle).
- **Centring rule (learned in `/stars`):** the scene's look-at point is shifted so it sits centred in the space between the top controls and the bottom cluster (measured from real element bounds, not fixed offsets).

## 3b. Per-ship HUD variants and hangar

The HUD has three variants over the same data (see `11-ship-roster.md` §6): **canopy** (Kestrel: thin projected arcs, minimal chrome), **windscreen** (Wayfarer: framed panels), **bridge** (Meridian: wide consoles and a tactical strip). A **hangar / ship-select** screen precedes flight and is reachable from the pause menu; **Launch / Dock / Switch vessel** and docking guidance are part of the Ship menu.

## 4. HUD elements, states and copy

| Element | Shows | States | Copy |
|---|---|---|---|
| **Tier dial** | six chips, active filled | locked (greyed with reason), auto-dropped (pulse once) | locked: "Slowing for Mars" / "Light tier is off near a body" |
| **Altitude** | radar altitude near ground, orbital altitude above | "ALT" vs "SURF" vs "ORB" | units auto: m, km, Mm, AU |
| **Speed** | surface-relative low, orbital-relative high | switchable (SURF/ORB/TGT) | e.g. "SPD 7.8 km/s ORB" |
| **Throttle** | bar + percent, spool lag shown | cut, full, spooling | — |
| **Mach/q** | only in atmosphere | amber at 80 % of max-Q | "MAX-Q" at ≥ 100 % |
| **Hull temp** | gauge with shield bar | amber 80 %, red 100 % | "HEAT — reduce speed" |
| **g-load** | number + trend | amber/red | "HIGH G" |
| **Pressure/outside T** | ambient | — | "Outside 737 K, 92 bar" |
| **Radiation** | dose rate + accumulated | Jovian system | "Radiation high — leave the belts" |
| **Fuel** | bar | relaxed/unlimited show ∞ | — |
| **Assist chips** | SAS, HOVER, LAND, ORBIT | on/off with `aria-pressed` | tooltips explain |
| **Target card** | name, distance, light-time, closing speed | none/selected | "Light takes 4 min 12 s" |
| **Reality badge** | per body, corner chip | measured / modelled / artistic / unverified | opens the reality panel |
| **Warnings** | top-centre pill | caution (amber), warning (red) | always with an action: "Pitch up", "Slow down", "Climb" |
| **Recall card** | modal with what happened, keep/restore buttons | after damage > 120 % | "The ship was recalled to orbit. At 1.4 bar and 2,300 K the hull exceeded its rating." |

## 5. Interaction details

- **Pop-overs** (`Bodies`, `View`) are lazy, keyboard-navigable, with a close-on-outside-click and Esc.
- **Hide-interface (`I`)**: hides top bar, strips and insets; keeps a 32 px eye button at the bottom-left, 45 % opacity, 100 % on hover/focus; captions stay if a guided sequence runs.
- **Pause (`Esc`)**: opens a menu (resume, controls, quality, comfort, audio, reality panel, exit); simulation freezes except UI.
- **Photo mode (`P`)**: freeze, free-camera with WASD/mouse, FOV slider, hide HUD, capture **the 3D canvas only** (never the page).
- **Autopilot (`Go to…`)**: choose a body; shows tier plan, ETA and a **Take control** button always visible; any manual input cancels with a toast.
- **Comfort settings**: motion intensity (off/reduced/full), FOV kick, camera shake, streak effects, flash intensity, text size.

## 6. Accessibility checklist (all must pass before F12)

- All HUD controls reachable by keyboard in a logical order; visible focus rings.
- `aria-live="polite"` announcements (throttled to ≤ 1 per 2 s) for tier changes, warnings, landing results.
- Colour is never the only signal (icons/shapes/text).
- `prefers-reduced-motion`: no shake, no streaks, instant tier cuts; sequences become step-by-step with Next/Back.
- Contrast ≥ 4.5:1 for text over the scene (use a scrim/glass background).
- Flash limits: ≤ 3 flashes/second, reduced amplitude option; lightning and engine flicker respect it.
- Touch targets ≥ 44 px; no hover-only affordances.
- Screen-reader summary of the scene on request ("You are 12 km above Mars, descending at 83 m/s").

## 7. Copy style

Plain, calm, specific, with real numbers; every explanation says what is real and what is invented ("Artistic: surface colours are not photographs"). No jargon without an inline explanation.

## 8. Telemetry and privacy

None sent anywhere. Settings and saves are local-only and wrapped in try/catch (storage can be blocked). Share links carry only coarse state.
