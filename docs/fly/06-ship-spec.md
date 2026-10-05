# `/fly` — ship specification: *Wayfarer*

Companion to `docs/plan-fly.md` §7. The **design brief** for the original heavy hover-freighter, with dimensions, mass model, thrusters, gear,
procedural construction rules, materials, lighting, damage states and budgets. Values marked **G** are *gameplay values* (chosen, not real).

## 1. Identity and silhouette

- **Class/name:** heavy hover-freighter *Wayfarer* (name is changeable; see the master plan's open question).
- **Design language:** industrial, workmanlike, riveted, exposed pipework and cable runs, panelled hull with hazard stripes, ring-shaped drive nacelles,
  sensor blisters, a wide windowed bridge. Inspired by the **feel** of 1990s–2000s hard-sci-fi hovercraft, but **not a copy** of any film design.
- **Silhouette test:** from 2 km away on a blank sky you should read (1) a long spine, (2) three drive rings at the rear, (3) two angled hover-pod wings, (4) a bridge blister forward.

## 2. Dimensions and masses (G)

| Item | Value |
|---|---|
| Length / beam / height | 90 m / 40 m (wings out) / 18 m (gear down 22 m) |
| Dry mass | 600 t |
| Reaction mass (full) | 400 t (relaxed fuel setting multiplies this ×5; unlimited = ∞) |
| Reference drag area `C_D·A` | ≈ 1,600 m² belly-first (β ≈ 375 kg/m²) |
| Moment of inertia (approx.) | `Ixx ≈ 1.1e8`, `Iyy ≈ 1.4e9`, `Izz ≈ 1.3e9` kg·m² (box-model estimate; refined from the mesh) |
| Crew/cargo (visual only) | 8 crew windows, 2 cargo bays (no gameplay in v1) |

## 3. Propulsion and control

| System | Count | Thrust (vacuum) | Isp | Notes |
|---|---|---|---|---|
| Main drive (central nozzle) | 1 | 6 MN **G** | 900 s **G** | spool 1.5 s; plume shape depends on ambient pressure |
| Ring nacelles (vectoring) | 3 | 2 MN each **G** | 700 s **G** | gimbal ±8°, provide pitch/yaw authority at speed |
| Hover jets (wing pods + belly) | 8 | 0.8 MN each **G** | 400 s **G** | active below 150 m/s and near ground; ground-effect cushion |
| RCS blocks | 16 | 20 kN each **G** | 280 s **G** | translation + rotation, 4 blocks × 4 nozzles |
| Retro engines (bow) | 2 | 1.5 MN each **G** | 600 s **G** | braking and suicide-burn assist |

Thrust-to-weight (full tank 1,000 t): main + rings ≈ 12 MN on 10⁷ N weight at Earth → ~1.2 g; at Mars ~ 3.2 g; at the Moon ~7.4 g. With a hover-capable ratio at Earth requiring main + hover jets together (≈ 18.4 MN) — adjustable, test-driven.

**Control law:** attitude via nacelle gimbals + RCS; translation via RCS and hover jets; a trim table keeps the belly into the airflow in atmosphere. Assists: see `02` §10.

## 4. Landing gear (G)

Six telescoping legs (two forward, four aft) with oleo-pneumatic spring-dampers: stroke 3 m, `k` and `c` set so a 3 m/s touchdown dissipates within 1.5 s; foot pads 2.5 m diameter with sinkage on soft surfaces (`SurfaceModel.stiffness`); clearance tolerances allow an 8° slope. Rough-landing threshold: vertical > 3 m/s **or** tilt > 12° **or** lateral > 1.5 m/s.

## 5. Structure and limits (G)

| Limit | Value | Effect past 100 % |
|---|---|---|
| Max dynamic pressure | 25 kPa | structural damage accrues |
| Sustained g | 6 g (shown to the pilot as 1.0 = 6 g) | warning at 80 % |
| Impulsive g | 12 g | damage |
| Hull temperature (shielded) | 1,900 K | shield ablation then hull damage |
| External pressure rating | 20 bar (standard) / 120 bar (deep-dive refit) | crush warning then recall |
| Radiation shielding | rated 500 dose units/hour (arbitrary G scale) | meter, then recall |

All limits are in `ship.ts` as data; difficulty presets scale them.

## 6. Procedural construction rules (`lib/fly/ship/`)

1. **Spine:** a loft through ~14 cross-sections (superellipse profiles) giving a long flattened hull with a raised dorsal spine; chamfer panel seams every ~2.4 m (3 × 3 panel grid per section).
2. **Bridge blister:** forward 12 m; wide glass band (window rows with inset frames), sensor array above.
3. **Hab/cargo block:** mid-hull boxy section with recessed hatches and exterior ladders, cargo doors (ramp underside).
4. **Engine cluster:** three **torus nacelles** (major radius 7 m, minor 1.4 m) around a central bell nozzle; inner coil ribs; heat radiator fins; exposed coolant lines.
5. **Hover-pod wings:** two angled outriggers (±24° dihedral) with downward jets and small landing pads.
6. **Greebles:** seeded instanced details (vents, pipes, conduits, antennae, handrails) generated from the hash `hash(shipId, partId, index)` so geometry is deterministic; capped per LOD.
7. **Hull plates:** numbered, with hazard stripes and stencil text drawn into the albedo atlas (original lettering, no real markings).
8. **Windows:** emissive strips, warm interior colour, subtle flicker; **running lights** red/green/white; **landing lights** with spotlight cones.
9. **Radar dish:** dorsal, rotates at 6 rpm; vented steam/coolant puffs at cooldown.

## 7. Materials and textures

- **PBR atlas (2k)** drawn procedurally: base metal, painted panel colours (desaturated industrial grey/olive/ochre with accent stripes), scratches (Perlin + directional streaks), rust/soot masks driven by shader uniforms from `thermal.ts`, hazard stripes, stencil text, emissive window mask.
- **Normal map** from the panel grid, rivet bumps, weld seams; **roughness/metalness** from masks.
- **Heat tiles** (belly): darker; glow with a heat ramp (black → red → orange → white) from the hull temperature uniform.
- **Dynamic decals:** soot streaks behind nozzles; dust coating after landing on dusty bodies (colour from the world's palette).

## 8. Budgets

| Item | Budget |
|---|---|
| Triangles | LOD0 ≤ 200 k · LOD1 ≤ 30 k · LOD2 ≤ 3 k · impostor beyond 2 km |
| Draw calls | ≤ 60 (instancing for greebles, merged static hull) |
| Textures | ≤ 48 MB total (procedural, 2k atlases) |
| Lights | ≤ 12 real-time (rest emissive) |
| Frame cost on `high` | ship ≤ 2.0 ms CPU, ≤ 2.5 ms GPU |

## 9. Damage and visuals

States: **pristine → scuffed → damaged → critical**. Visual changes: soot, dents (normal map), flickering lights, leaking vapour particles, a trailing smoke at *critical*. Repairs happen on a clean landing (automatic, with a short caption) or after a recall.

## 10. Optional external model (if Gee supplies one)

- Accept GLB with a **licence file** (CC0 or CC-BY with attribution); record credit in `docs/fly/credits.md`.
- Run `gltf-transform` (Draco/Meshopt + KTX2); enforce the budgets above.
- Required node names: `HULL`, `NOZZLE_MAIN`, `NACELLE_L/C/R`, `HOVER_FL/FR/RL/RR`, `RCS_*`, `GEAR_FL/FR/ML/MR/RL/RR`, `LIGHT_NAV_L/R`, `LIGHT_LAND_*`, `WINDOW_EMIT`, `RADAR`.
- The procedural ship stays as the fallback so `/fly` never depends on a third-party file.

## 11. Interior (v2)

Walkable ramp and airlock, bridge with live instrument screens (the HUD data rendered in-world), a hangar view; camera clipping rules; ambient interior audio (hum, ticks). Out of scope for v1.
