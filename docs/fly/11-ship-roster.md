# `/fly` — ship roster: fly something big or something small

Gee's direction: **"I want to be able to use either a big ship like the big ships in Mass Effect Andromeda, or something small like the one from Oblivion."**
This document replaces the single-ship assumption in the other plan files with a **ship roster**: several hulls, one flight engine, and a hangar where the pilot chooses
(and, in the mothership mode, *both at once*: the big ship carries the small one).

**Originality rule (binding):** the roster takes the **design language and role** of those games (a large expedition ship with decks, a bridge and a shuttle bay; a small
bubble-canopy VTOL craft) but **every hull, name, marking and detail is original**. No game assets, logos, ship names, silhouettes copied one-to-one, or recorded
sounds. Any external model must carry a recorded licence (`docs/fly/credits.md`). This is both a legal and a creative decision: the ships should feel like *Gee's* ships.

**Honesty note on earlier numbers:** the first Wayfarer sheet (`06-ship-spec.md`) used a 900 s specific impulse, which gives only **≈ 4.5 km/s** of Δv, too little to reach orbit from
Earth (≈ 9.4 km/s with losses). The roster below corrects it: all drives are a **fictional high-efficiency torch (gameplay values, tagged G)** with Isp 3,000–4,000 s, giving ≈ 15–19 km/s.
`06-ship-spec.md` is amended accordingly; `01-physics-numbers.md` §3 now notes that its β used dry mass.

---

## 1. The roster

| | **Kestrel** (small) | **Wayfarer** (heavy industrial) | **Meridian** (big expedition ship) |
|---|---|---|---|
| Role | scout / personal VTOL craft; lands anywhere | cargo hauler; blue-collar, rugged | exploration flagship; science, hangar, crew |
| Inspiration (language only) | bubble-canopy single/two-seat VTOL (Oblivion-style) | Matrix-era industrial hovercraft | large modern expedition ship with a long dorsal spine, glowing ring nacelles, a wide bridge window and an internal shuttle bay (Andromeda-style) |
| Length × span × height | 9.5 × 8.0 × 3.8 m | 90 × 40 × 18 m | 140 × 56 × 24 m |
| Crew / seats | 2 (pilot + passenger) | 8 | 24 (visual) |
| Dry mass (G) | 5.5 t | 600 t | 1,100 t |
| Propellant (G) | 3.0 t | 400 t | 700 t |
| Specific impulse of the torch (G) | 3,500 s | 3,000 s | 4,000 s |
| **Δv at full tanks** | **14.9 km/s** | **15.0 km/s** | **19.3 km/s** |
| Main thrust | 120 kN | 12 MN (main + rings) | 18 MN (2 mains) |
| Hover/VTOL thrust | 100 kN (4 ducts × 25 kN) | 6.4 MN (8 jets) | 24 MN (12 jets) |
| Ballistic coefficient β (full tank) | 157 kg/m² | 625 kg/m² | 409 kg/m² |
| Hangar / carries | docks in a Meridian | — | **carries 1 Kestrel** |
| Needs | 12 m pad | 150 m flat pad | 250 m flat pad (or orbit) |
| Agility | very high | low | low-medium |
| Signature feel | light, quick, glass bubble, rotor-wash dust | heavy, loud, industrial rattle | stately, hum, large-window bridge |

(G = gameplay values, chosen not measured; they are tunable in `ships/*.ts` and covered by tests. Isp values are deliberately fictional so every ship can reach orbit and the other worlds.)

### 1.1 Derived performance (computed by script from the table; target values for tests)

Thrust-to-weight at full tanks, `TWR = (main + hover)/(m₀ g)`; terminal speed `v_t = √(2βg/ρ)` with ρ ⚠ from `01-physics-numbers.md`.

| World | Kestrel TWR | Wayfarer TWR | Meridian TWR | Kestrel v_t | Wayfarer v_t | Meridian v_t |
|---|---|---|---|---|---|---|
| Earth | 2.64 | 1.88 | 2.38 | 50 m/s | 100 m/s | 81 m/s |
| Mars | 6.98 | 4.96 | 6.29 | 242 m/s | 482 m/s | 390 m/s |
| Venus | 2.92 | 2.07 | 2.63 | 7 m/s | 13 m/s | 11 m/s |
| Titan | 19.2 | 13.6 | 17.3 | 9 m/s | 18 m/s | 14 m/s |
| Moon | 16.0 | 11.4 | 14.4 | — | — | — |

Hover-only TWR at Earth (hover jets alone): Kestrel 1.20 (can hover on the ducts), Wayfarer 0.65 and Meridian 1.36 (the Wayfarer needs its main engines too).
**Reading:** the small craft is the only one that hovers comfortably on Earth with its ducts alone, and its tiny β means it is blown about by wind and falls slowly; the big ships fall faster
and need serious thrust to arrest a descent on Mars (390–480 m/s terminal: exactly the thin-air problem). These numbers are *feel anchors* and unit-test targets.

---

## 2. Flight-model differences (one engine, different data)

All ships run through the **same** `integrator`, `aero`, `thermal`, `contact` and `atmosphere` modules (`09-physicality-charter.md` rule 6). They differ only by `ShipSpec` data and a few
behaviour switches:

| Aspect | Kestrel | Wayfarer | Meridian |
|---|---|---|---|
| Rotational authority | ±120°/s peak, snappy RCS + gimballed ducts | ±25°/s, slow, momentum-heavy | ±12°/s, deliberate |
| Inertia (box estimate, full tanks) | ≈ 5×10⁴–10⁵ kg·m² | ≈ 1.6×10⁸–8×10⁸ kg·m² | ≈ 3×10⁹ kg·m² |
| Atmosphere handling | small wings + duct vectoring, can fly like a VTOL jet; ground effect cushions hover | belly-first blunt body, buffets | blunt lifting body with swept wings, smooth but sluggish |
| Wind sensitivity | **high** (low β): gusts push it visibly | low | low |
| Heat | light heat shield, short reentry only, high peak per mass | standard shield | heavy shield + radiators |
| Landing | any 12 m patch, ≤ 15° slope, soft touchdown ≤ 4 m/s | flat pad, ≤ 8° slope, ≤ 3 m/s | flat pad, ≤ 5° slope, ≤ 2.5 m/s, deploys landing gear in stages |
| Dust and plume | strong rotor-wash-like ducts: ground effect, dust ring | big plume, long-lived dust cloud | huge plume and dust bloom; scours a pad |
| Speed tiers | 1–6 | 1–6 | 1–6 |
| Cockpit camera | canopy bubble (near-360° view) | forward windscreen | bridge window with interior |
| Sound character | whine of ducted thrust, light structure | deep rattle, low rumble | low harmonic hum, ring resonance |
| Structure | rigid | long hull flex | long hull flex + modular flex |

**Ground effect (new, all ships, matters most for the Kestrel):** hover thrust rises when close to a surface by `1 + k(h/D)` with a published-style correction, plus recirculation: tested as "thrust factor
monotone decreasing with height, → 1 at h > 2 D" (see `09` for the physical-driver rule).

---

## 3. The hangar (ship select) and the mothership mode

### 3.1 Choosing a ship
- A **hangar screen** at start (and via the pause menu) shows each ship rotating in a bay with stats (size, mass, Δv, TWR per world, landing needs), a one-line personality, and a "reality" note
  (all vehicle numbers are gameplay values). Choose **Kestrel**, **Wayfarer** or **Meridian**.
- Keyboard, gamepad and touch navigable; reduced-motion shows a still image per ship; the choice persists locally (guarded storage).
- Start positions: low Earth orbit (default) or a pad on Earth/Moon/Mars; the Kestrel can also start inside a docked Meridian bay.

### 3.2 Mothership mode (the big ship carries the small one)
1. Fly the **Meridian** to orbit around a world. Use **Launch Kestrel** from the pause/ship menu: the Kestrel leaves the bay with a small separation impulse; the pilot now controls it.
2. The **Meridian continues on a stable orbit**, integrated numerically but at a **coarse step** (background vessel), not "on rails". It holds attitude with its assists; it cannot be steered while unattended unless **Autopilot orbit-keeping** is on.
3. Land the Kestrel anywhere the big ship cannot reach (rough ground, caves' mouths, ridges); explore; **refuel and repair** by docking back.
4. **Docking:** match the bay's velocity and axis (capture envelope: relative speed ≤ 2 m/s, lateral ≤ 1.5 m, angle ≤ 8°); guidance cues on the HUD; a successful capture re-attaches the Kestrel to the Meridian's mass model (CoM/inertia update).
5. **Switch vessel** (`Tab` / gamepad Share+△) hops control to the other craft within ~2.5 km (the "physics range"); beyond it the other craft remains a background vessel.
6. If the Kestrel is lost (crash/recall), it **respawns in the bay** with a plain-language explanation.

### 3.3 Why this is physically honest
The same equations govern both ships. The background vessel obeys the same gravity and (in atmosphere) drag, so an unattended Meridian in a low orbit *decays and re-enters* if left too low: a gentle warning and an
"orbit-keeping" assist exist to prevent a silent loss. Docking and separation conserve momentum (the Meridian's velocity changes by `m_k Δv / M`).

---

## 4. Procedural construction rules per hull (summary; full rules in `06-ship-spec.md` for the Wayfarer)

### Kestrel (small) — BUILT (v1 model at `/fly`)

> **Status:** implemented as a procedural three.js model (`src/lib/fly/ship/kestrel.ts`, 27 k triangles, 73 meshes, 9.7 × 8.1 × 4.0 m) with a hangar viewer at `/fly`. The built design follows Gee's reference images: **a glass spherical cockpit with a gyroscope-style ring frame, a white spherical engine pod with seam lines and a glowing lift ring, a long thin spine, a side-facing ring turbine at the tail that swings aft for cruise, thin swept wing blades, and four spindly jointed legs that fold up**. It is an *original* build inspired by that dragonfly-like design language, not a trace of any film craft. The notes below describe the earlier, duct-wing idea; the built model is the authoritative design.

- **Canopy bubble:** a ~2.7 m glass sphere (transmissive in the viewer; cheap transparency on weak GPUs) with a ring frame, a pilot/passenger pair (silhouettes), seats and a console with glowing screens.
- **Fuselage:** compact torpedo-like body with a swept mid-section, **two short wings** (movable ducts at the tips) and a **rear drive nozzle**; four **ducted thrust units** with visible fan blades and exhaust glow.
- **Gear:** three telescoping legs with skid pads; tiny floodlights; rear ramp or side door (v2).
- **Materials:** clean white/grey composite with matte panels, subtle wear, small stencilled markings (original), amber/cyan accent lights.
- **Budgets:** LOD0 ≤ 60 k triangles, ≤ 25 draw calls, textures ≤ 16 MB.

### Meridian (big)
- **Spine and hull:** a long, slim dorsal spine, a swept shield-like prow, a wide **bridge window** (curved glass band) forward; **two glowing ring-shaped nacelles** (large tori with inner coil structure) aft-lateral; an **internal hangar** with a lit bay mouth underneath/behind; sensor domes; windows at human scale along decks.
- **Surface language:** big smooth shaped panels with precise seams, glowing seams and lines (cool white/teal accent), clean greeble density (less industrial clutter than the Wayfarer).
- **Interior (v2):** bridge with a captain's seat, hangar bay with a Kestrel cradle and bay doors, a walkable corridor between them; v1 ships the exterior, a bridge cockpit camera and the hangar mouth (the Kestrel can be seen through it).
- **Budgets:** LOD0 ≤ 250 k triangles, ≤ 70 draw calls, textures ≤ 56 MB (procedural atlases).

### Wayfarer (heavy industrial)
As in `06-ship-spec.md`, with the corrected propulsion numbers from §1.

---

## 5. Data model (extends `02-data-schemas-and-algorithms.md` §7)

```ts
export type ShipId = 'kestrel' | 'wayfarer' | 'meridian';
export interface ShipSpec {
  id: ShipId; name: string; blurb: string; sizeClass: 'small' | 'heavy' | 'capital';
  dims: { length: number; span: number; height: number };
  mass: { dry: number; propellant: number; inertiaDry: M3; cogDry: V3 };
  drive: { isp: number; main: Thruster[]; hover: Thruster[]; rcs: Thruster[] };   // thrust in N, vacuum
  aero: { cdA: number; refLength: number; tables: AeroTables; ground: { k: number; D: number } };
  limits: Limits; shield: ShieldSpec; gear: Leg[]; landing: { minPad: number; maxSlopeDeg: number; maxVz: number; maxVh: number };
  agility: { rotRate: V3; rotAccel: V3 };
  hangar?: { capacity: ShipId[]; bay: { pos: V3; axis: V3; capture: { vRel: number; lateral: number; angleDeg: number } } };
  camera: { cockpit: CameraRig; chase: CameraRig };
  hud: HudVariant;                       // 'canopy' | 'windscreen' | 'bridge'
  audio: AudioPreset;
  visuals: ShipVisualSpec;               // procedural recipe + LOD budgets
}
export interface Vessel { id: string; spec: ShipSpec; state: State; fuel: number; damage: Damage; docked?: { host: string; slot: number }; fidelity: 'active' | 'background' }
```
`VesselManager` holds all vessels, selects the **active** one (full-fidelity sub-steps, input, audio, camera) and integrates the rest at a coarse fixed step (1 s, RK4) with the same force models; promotes a background vessel to active inside the physics range and demotes the previous active. All of it is covered by determinism tests.

---

## 6. UI and controls changes (extends `05-ui-hud-spec.md`, `10-controller-support.md`)

- **Ship select screen** (hangar) and a **Ship menu** in the pause screen: Launch/Dock, Switch vessel, Refuel/Repair, Autopilot orbit-keeping.
- **HUD variants:** `canopy` (Kestrel: thin projected HUD arcs, minimal chrome), `windscreen` (Wayfarer: framed panels), `bridge` (Meridian: wide bridge consoles, a tactical strip); same data, different layout; all hide with `I`.
- **Docking HUD:** relative velocity, lateral offset, angle, closing time, capture envelope shown as a reticle.
- **Gamepad:** `Share + △` switch vessel; `Share + □` launch/dock; D-pad ◀ ▶ cycles target (the other vessel is a target).
- **Camera presets** per ship, with the Kestrel's chase camera close and low, the Meridian's wide and high.
- Reality panel adds "ship values are gameplay values; Isp is fictional".

---

## 7. Roadmap changes (merge into `04-roadmap-tickets.md`)

| Id | Phase | Ticket | Acceptance | Test |
|---|---|---|---|---|
| S0.1 | F0 | `ShipSpec` schema and `ships/{kestrel,wayfarer,meridian}.ts` data | every numeric field carries a unit and a `G`/`⚠` tag | unit |
| S1.1 | F1 | derived tables (Δv, TWR, β, v_t) generated from the specs | equal §1.1 within 0.5 % | unit |
| S3.1 | F3 | `ShipSpec`-driven flight model; swap hulls without code changes | all three fly the same Earth→Moon test | unit/e2e |
| S3.2 | F3 | `VesselManager` (active + background), numerical background integration | background orbit decays with drag like the active one | unit |
| S3.3 | F3 | ground effect and duct vectoring (Kestrel) | thrust factor monotone, → 1 beyond 2D | unit |
| S4.1 | F4 | **Kestrel** procedural model, canopy, ducts, LODs | budgets in §4 | unit (counts) + visual |
| S4.2 | F4 | **Meridian** procedural model, nacelle rings, bridge window, hangar mouth | budgets in §4 | unit + visual |
| S4.3 | F4 | per-ship plume, light and hull-state variants | match thruster data | unit + visual |
| S5.1 | F5 | per-ship aero tables and heating (small light shield, big heavy shield) | terminal speeds match §1.1 | unit |
| S6.1 | F6 | landing rules per ship (pad size, slope, touchdown speeds) | classification table | unit |
| S6.2 | F6 | Kestrel lands on rough ground (≤ 15°) that the big ships refuse | scripted e2e | e2e |
| S9.1 | F9 | hangar/ship-select screen; remembered choice | keyboard + gamepad + touch | e2e + axe |
| S9.2 | F9 | **Launch / Dock / Switch vessel**, docking guidance and capture | capture envelope respected; momentum conserved | unit + e2e |
| S9.3 | F9 | HUD variants (canopy/windscreen/bridge) | layout at 360/412/1280 px | visual |
| S10.1 | F10 | ship audio presets (duct whine, rattle, ring hum) | distinct spectra per ship | unit (spectrum check) |
| S11.1 | F11 | Meridian interior v2 (bridge + hangar walk) (optional) | walkable, no clipping | e2e |

**Order:** build the **Kestrel first** (smallest, fastest to iterate on feel and landing), then the **Wayfarer** (already specified), then the **Meridian** (largest effort) with the mothership mode at F9.
The first playable milestone is therefore *Kestrel: orbit → Moon landing*, which exercises nearly every system at the lowest asset cost.

---

## 8. Tests specific to the roster (extend `07-test-matrix.md`)

| Test | Pass condition |
|---|---|
| Δv per ship | rocket equation from the spec equals §1 within 0.5 % |
| TWR/terminal speed tables | match §1.1 within 1 % |
| Hull swap | the same scripted Earth→Moon flight succeeds with each ship (different fuel use) |
| Landing envelopes | Kestrel lands at 12° slope; Wayfarer refuses/rough-lands at 12°; Meridian likewise |
| Docking | capture only inside the envelope; momentum conserved (host velocity change `m Δv/M`); CoM/inertia updated |
| Vessel switch | control hands over; background vessel's trajectory continues without a jump |
| Background fidelity | a background vessel's orbit after 10 min matches an active-fidelity run within a tolerance (1 km) |
| Ground effect | thrust factor vs height monotone; equals 1 beyond 2D |
| Wind sensitivity | the Kestrel's lateral drift under a given gust > the Wayfarer's (β ratio) |
| Budgets | triangle/draw-call counts per ship within §4 budgets |

---

## 9. Open questions (answer to refine the roster)

1. **Names:** keep Kestrel / Wayfarer / Meridian, or choose your own?
2. **Seats:** should the Kestrel have a passenger (visual only in v1) and should the Meridian have a walkable interior in v1 or v2?
3. **Mothership mode** as specified (one Kestrel in the Meridian), or a free choice of which ship carries which?
4. **Look:** for the Meridian, prefer cool white/teal glowing lines (clean exploration ship) or warmer industrial tones?
5. **Scale of detail:** is a procedural look acceptable for all three, or will you supply licensed models for any of them (the optional glTF path still applies per ship)?
6. **Difficulty defaults:** should the Kestrel start as the default (easier to learn) with the others unlocked by completing missions, or all available immediately?
