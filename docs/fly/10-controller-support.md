# Controller support (DualShock 4 first, any gamepad second)

Requirement from Gee: **"I need to be able to use a DS4 controller no matter what device I am using, as long as it is connected."**
This document is the design, the support matrix, the control maps for `/stars` (built now) and `/fly` (planned), and an honest list of what is and is not verified.
Code: `src/lib/input/{gamepad,hub}.ts`, `src/components/input/{usePad,ControllerLab}.tsx`, route `/controller`, tests `src/lib/input/gamepad.test.ts` and `e2e/controller.spec.ts`.

## 1. Approach: the browser Gamepad API, plus a way out when a browser disagrees

The Gamepad API is the only mechanism that works on every device class without a driver or an app install: desktop (Windows, macOS, Linux, ChromeOS), Android and iPhone/iPad.
A DualShock 4 connects to those over **USB** or **Bluetooth** like any other pad. The site then has three layers so that it understands the pad **whatever the browser reports**:

1. **Standard mapping** (W3C): Chrome, Edge, Safari (macOS, iOS, iPadOS) and Android browsers report a DS4 this way; we use the standard button/axis indices.
2. **Built-in DS4 profile** for browsers that report a raw layout (Firefox on desktop historically). Indices are from memory and **unverified on hardware** (see §5).
3. **Learned mapping**: if a pad still behaves oddly, the 30-second wizard at **`/controller`** asks the user to press each control once, and stores the mapping in `localStorage` (validated on load; the page works if storage is blocked). This makes *any* pad work on *any* device, and is the guarantee behind "no matter what device".

Everything is normalised into one state: two sticks (radial dead zone 0.14, response curve for fine control), two analogue triggers, 18 digital controls, the family (PlayStation / Xbox / generic) and labels (✕ ○ □ △ or A B X Y).

## 2. Support matrix (what we expect, and how sure we are)

| Platform / browser | Gamepad API | DS4 layout | Rumble | Confidence |
|---|---|---|---|---|
| Windows: Chrome, Edge | yes | standard | yes (dual-rumble) | high (documented behaviour) ⚠ not tested by us on hardware |
| macOS: Chrome, Edge, Safari | yes | standard | Chromium yes; Safari partial | medium ⚠ |
| Linux: Chrome, Chromium | yes | standard | yes | medium ⚠ |
| Firefox (desktop) | yes | may be raw → built-in profile or wizard | pulse API only if present | medium ⚠ |
| Android: Chrome | yes (Bluetooth or USB-OTG) | standard | often yes | medium ⚠ |
| iPhone / iPad: Safari (iOS 13+) | yes (Bluetooth) | standard | partial / none | medium ⚠ |
| ChromeOS | yes | standard | yes | medium ⚠ |
| Smart TVs / consoles' browsers | varies | unknown → wizard | varies | low |

**Not available through the web standard (so not used):** touchpad *surface* coordinates, light bar, gyroscope/accelerometer, battery level, headphone jack. The touchpad *click* is exposed by many browsers as a button and is mapped.
**Optional future enhancement:** **WebHID** (Chromium desktop/Android only; needs a user prompt and HTTPS) could read gyro, touchpad and battery and set the light bar. It would be an add-on behind a feature test, never a requirement.

Browser quirks handled: a pad is only listed **after its first button press** (the page tells the user so); polling pauses while the tab is hidden (stale data); `navigator.getGamepads()` may throw under restrictive permission policies (caught); disconnects are detected by the loop and the `gamepaddisconnected` event.

## 3. Control map: Milky Way and Solar System (`/stars`, built)

Buttons are translated to the **same keyboard shortcuts** the page already has, so keyboard and pad cannot disagree; sticks and triggers are analogue.

| Control | Galaxy view | Solar System view |
|---|---|---|
| Left stick | orbit | orbit (like dragging) |
| Right stick X / Y | pan / zoom | — / zoom |
| L2 / R2 | zoom out / in | zoom out / in |
| ✕ Cross | open the Solar System (`O`) | Take me home (`H`) |
| ○ Circle | back / close (`Esc`) | back to the galaxy (`Esc`) |
| □ Square | labels (`L`) | labels |
| △ Triangle | hide/show the interface (`I`) | same |
| ▲ ▼ D-pad | fly to the previous/next place (`1`–`8`) | previous/next body |
| ◀ ▶ D-pad | step the clock back/forward (`,` `.`) | same |
| L1 / R1 | slower / faster time (`[` `]`) | same |
| Share | bookmark this moment (`B`) | same |
| Options | help (`?`) | same |
| L3 / R3 | time machine (`J`) / real time now (`N`) | same |
| Touchpad click / PS | Take me home (`H`) | same |

A short rumble acknowledges ✕/○ and a connection (where supported). A toast names the controller when it connects.

## 4. Control map: `/fly` (planned; extends `05-ui-hud-spec.md` §13.1)

| Control | Action | Notes |
|---|---|---|
| Left stick | translate (strafe / forward-back) | hover and RCS |
| Right stick | pitch / yaw | rate-limited, expo curve |
| L1 / R1 | roll left / right | |
| R2 / L2 | throttle up / down (analogue) | trigger value maps to thrust fraction |
| ✕ | confirm / engage assist (context) | landing gear when near ground |
| ○ | cancel / back / cut throttle (hold) | |
| □ | toggle hover assist | |
| △ | camera cycle | chase / cockpit / orbit |
| D-pad ▲ ▼ | speed tier up / down | tiers 1–6 |
| D-pad ◀ ▶ | previous/next target | |
| Options | pause menu | |
| Share | photo mode | |
| L3 / R3 | headlights / airbrake (hold) | |
| Touchpad click | map view | |
| Vibration | engine thrust (weak motor), turbulence and impacts (strong motor), warnings (pattern) | per `09-physicality-charter.md` §8 |

Dead zones, expo and sensitivity are adjustable in settings; the wizard remaps *hardware* layouts, and a separate "bindings" screen (planned, F9) remaps *actions*.

## 5. What is verified, and what is not

- **Verified (automatically):** the normalisation, family/label detection, dead-zone maths, hat decoding, press/release edge tracking, active-pad choice, learned-mapping wizard logic and its storage validation, rumble API calls and clamping (`gamepad.test.ts`, 17 cases); and, with a **mocked `navigator.getGamepads`**, the `/controller` page, the built-in profile path, the full wizard, and the `/stars` mapping (✕/○/D-pad, toast, left stick moving the view) in Playwright.
- **NOT verified:** behaviour with a **physical DualShock 4** on any real device or browser. The sandbox has no controller. In particular the raw-layout profile (Firefox) is from memory, the exact device ids differ by browser, and rumble support per browser is from documentation, not from testing.
- **How to close the gap (for Gee):** on each device, open `/controller`, press a button, and check: (1) the label says "DualShock 4", (2) every control lights the right badge, (3) "Test vibration" buzzes (if your browser supports it). If something is wrong, run "Teach this controller" and tell us the **layout line** and the **id string** shown on that page: they identify the profile to add. Add confirmed results to the matrix above.

## 6. How to add a profile (when a device reports something new)

1. Copy the id string and the axes/buttons counts from `/controller`.
2. Add a profile branch in `normalise()` (`src/lib/input/gamepad.ts`) keyed on `detectFamily(id)` plus the axes/buttons signature, with its index table.
3. Add a unit test with a fake pad using exactly those values, and run the wizard e2e to make sure the learned path still wins over the profile.
4. Update the matrix in this file.

## 7. Privacy and safety

No input data leaves the browser. The only stored data is the learned mapping (local, keyed by controller id, validated on load). Vibration strength is capped and short; strong sustained vibration is never used. Flashes and shake follow the comfort and reduced-motion settings (`09-physicality-charter.md`).
