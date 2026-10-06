# `/fly` — world dossiers

Companion to `docs/plan-fly.md` §8. One dossier per world: **what the pilot sees and feels from space to ground**, the systems that
create it, the hazards, the audio, what is real versus artistic, and what must be verified.

**Honesty rule for this whole file:** all facts and numbers are **⚠ recalled from memory** and unverified (see `verification.md`). Items marked
**[M]** measured, **[D]** derived/modelled, **[A]** artistic. Altitude bands are "design bands" for tuning, not data.

Template used for each world:
`Approach` (far/mid/near) → `Atmosphere & sky` → `Surface` → `Wind/weather` → `Heat/pressure/radiation` → `Light` → `Audio` → `Landmarks/sites` → `Gameplay notes` → `Verify`.

---

## 1. The Sun (not landable)

- **Approach:** at 1 AU the Sun is a 0.53° disc. Closer than ~0.1 AU it fills a large part of the sky; the corona streamers appear (artistic, polarised-brightness style [A]). The photosphere is ~5,770 K [M]; the corona is > 10⁶ K but thin: it heats a ship by radiation and particles, not by "touching hot gas" [D].
- **Hazard model:** radiative heating `q ∝ 1/r²`; ship limit gives a **safe distance** (design value, e.g. 4 solar radii ⚠ analogous to Parker Solar Probe's closest approach ≈ 9.86 R☉ ⚠); inside it, temperature rises and damage accrues → recall.
- **Effects:** auto-dimming (eye adaptation), massive bloom, lens flares, **flares/CMEs** as rare scripted events [A] with the ship's radiation meter reacting.
- **Surface features** (granulation, sunspots, prominences) as a procedural shader on the photosphere; scale-correct sunspot sizes [D]; prominences as animated loops [A].
- **Audio:** silent in vacuum; a low, rising structural creak and warning tones as heat climbs.
- **Verify:** solar radius, effective temperature, Parker's perihelion, typical flare/CME descriptions.

## 2. Mercury

- **Approach:** a cratered, grey-brown world (no real colour: it is dark and neutral) [M]; with a huge solar disc (≈ 2.5–3× Earth's view at perihelion) [D]; the 3:2 spin-orbit resonance means a **solar day of ~176 Earth days** [M]. Day-night terminator is extremely sharp (no air).
- **Atmosphere & sky:** a tenuous exosphere (sodium glow, a comet-like **sodium tail**) [M] rendered as faint tinted glow; the sky is black even at noon.
- **Surface:** heavily cratered, smooth plains, **lobate scarps** (cliffs from planetary cooling), the Caloris Basin (~1,550 km) [M]; **hollows** (bright pits) [M]; permanent polar shadow with water ice in craters [M] (visible as dim blue-white in near-dark crater floors [A]).
- **Wind/weather:** none. Temperature swings −180…+430 °C [M] drive visual **thermal shimmer** only on the hottest ground (artistic: no air means no real shimmer [A], so use a subtle heat-glow tint on the sunlit hardware instead).
- **Hazards:** extreme heat on the day side, extreme cold on the night side, little shielding from solar radiation; thermal stress on the hull when crossing the terminator quickly.
- **Light:** harsh, hard shadows; long shadows near the poles; **eye adaptation** between day-side glare and night-side dark.
- **Audio:** silence plus engine/structure sounds; cooling ticks after a hot pass.
- **Landmarks:** Caloris Basin, Rachmaninoff basin, Kuiper crater, Tolstoj; a polar-crater ice site (named craters near the north pole ⚠).
- **Gameplay notes:** terminator-riding orbit is a signature manoeuvre; solar panel/radiator visuals matter.
- **Verify:** day-length and resonance, temperature extremes, Caloris diameter, polar-ice crater names/coordinates.

## 3. Venus

- **Approach:** a bright, featureless yellow-white disc [M]; in UV the clouds show a chevron pattern [M] (optional UV-view toggle, artistic colours [A]). Phase and brightness follow the geometry.
- **Atmosphere & sky:** 92 bar, ~96.5 % CO₂, ~3.5 % N₂ [M]; **sulfuric acid cloud decks ~48–70 km** [M]; a haze below that clears toward the surface [M]. From above the deck: bright. Inside: **fog**, dim orange-yellow light with no visible sun below the clouds [D]. Scattering model: strong Mie with orange absorption [A].
- **Surface (reached only through the heat/pressure shield limit):** basalt plains, "pancake domes", tesserae, lava channels; the surface is **dimly lit orange** with a murky horizon curving upward visually [A: refraction in dense atmosphere makes the horizon rise, a known effect [D]].
- **Wind/weather:** **super-rotation** ~100 m/s at cloud tops [M]; surface winds ~1 m/s [M]; sulfuric acid "virga" rain evaporating before the surface [M]; lightning is debated [M: unresolved]: use a faint, rare flicker [A].
- **Heat/pressure:** surface ≈ 737 K (464 °C) [M] and ~92 bar [M]. Layer where pressure and temperature are Earth-like: **~50–55 km** [M]: cloud-top "aerostat" level (v2 airship module). Ship ratings determine how deep it may go before heat/crush damage.
- **Light:** the Sun is bright but diffuse above the clouds; inside it is a glow. Eye adaptation is strong.
- **Audio:** dense air carries sound: **muffled, deep** engine tone; heavy wind roar at the deck; creaking hull as pressure rises; alarm tones at the rating limit.
- **Landmarks:** Maxwell Montes (~11 km high [M]), Aphrodite Terra, Ishtar Terra, Beta Regio; Venera and Magellan landing zones (historic) ⚠.
- **Gameplay notes:** a **"depth gauge"** and **temperature/pressure gauge**; the survivable window is a design number (e.g., ship rated 20 bar/600 K ⚠ gameplay value [A]). Recall card explains the real conditions that killed it.
- **Verify:** pressure/temperature profile, cloud layer altitudes, super-rotation speed, surface wind, landmark coordinates/heights.

## 4. Earth

- **Approach:** blue marble with clouds, city lights on the night side (the data is not available offline [A]: generate plausible light density on the continents from the existing `land.json` shape, scaled by latitude and a fixed "population-like" noise; label artistic), ocean sun glint, auroras at high latitudes [D/A].
- **Atmosphere & sky:** 1 atm N₂/O₂, scale height ≈ 8.5 km [D]; Rayleigh sky blue, red sunsets [D]; the *real* troposphere/stratosphere/mesosphere layers [M] give the temperature profile.
- **Surface:** the repo's `land.json` gives coastlines at 1:110m only: far too coarse to fly at low altitude. Plan: **statistical continents** from the shapes with fractal coastlines and terrain (reality **A**) or **user-supplied ETOPO-like DEM** if available. Oceans: wave spectrum + Fresnel; ice sheets at poles, deserts, forests as colour rules by latitude/aridity [A].
- **Wind/weather:** jet streams (~±50 m/s [M] near 10 km); convective cumulus fields over land by day; **clouds sourced from the date** are not available offline, so cloud cover is procedural and seeded by the date [A].
- **Heat:** reentry from orbit as in `01-physics-numbers.md` §4; atmospheric tier tops out near Mach 25.
- **Audio:** the full set: wind, engine thrum, reentry plasma roar, thunder (rare).
- **Landmarks/sites:** choose generic, *non-address* places (coastal cliffs, desert flats, mountain plateaus); no real private locations.
- **Gameplay:** the **tutorial world** (home, easy, forgiving): bank turns, hover assist, a first Moon trip.
- **Verify:** scale height, jet-stream speeds, standard-atmosphere table, ocean/land fractions.

## 5. The Moon

- **Approach:** the real phase and libration for the date (astronomy-engine `Libration`, `MoonPhase`) [M]; **earthshine** on the dark side [D].
- **Atmosphere & sky:** none; **black sky with stars**; the Sun is hard and bright; Earth hangs fixed in the sky (tidal lock) [M] at a position depending on the site [D] (near-side sites); phases of Earth are complementary to the Moon's.
- **Surface:** highlands (bright anorthosite) vs maria (dark basalt) [M], craters at all sizes, **rays** from young craters (Tycho) [M], rilles, **regolith** with a fine dust layer [M]; surface colour variation subtle (grey-brown) [A palette].
- **Dust physics:** thruster plume lofts regolith that flies in clean ballistic arcs and **does not billow**; a "lens dusting" overlay [A]. No sound from dust in vacuum.
- **Wind/weather:** none.
- **Heat:** −170…+120 °C [M]; hull cooling/heating gauge; shadow vs sun behaves harshly (long dark pockets).
- **Light:** no scattering; extremely **hard shadows** with dark fill; Earth-shine and star fill [D].
- **Audio:** silence, plus structure-borne engine rumble and cabin; touchdown thump through the legs.
- **Landmarks/sites:** Tranquility Base, Apollo sites (respect: do not render historic hardware in v1 or add a "protected site" no-fly bubble [A]), Tycho, Copernicus, Shackleton (south pole), the far side (Tsiolkovsky, South Pole–Aitken basin).
- **Gameplay:** the **second tutorial**: Orbit → descent → pad landing; the auto-land assist is easiest here (no air).
- **Verify:** libration implementation, regolith depth/colour, site coordinates, the "Apollo site" etiquette decision.

## 6. Mars (+ Phobos, Deimos)

- **Approach:** rusty-orange disc with dark albedo features (Syrtis Major, etc.: already in `marsMap.ts` [A]) and polar caps [M]; dust haze; **dust storms** from the repo's catalogue (`lib/astro/mars.ts`, 2018 global storm etc.) [M/uncertain onset dates].
- **Atmosphere & sky:** ~6 mbar (≈ 610 Pa) CO₂ ~95 % [M]; scale height ~11 km [M]; **butterscotch sky, blue sunsets** (scattering by dust) [M]; thin water-ice clouds [M]; during storms **brown-out** with a dim, reddish sun [M].
- **Surface:** huge relief: **Olympus Mons** ~22 km above datum, ~600 km across [M]; **Valles Marineris** ~4,000 km long, up to ~7 km deep [M]; **Hellas** ~7 km deep [M]; polar layered deposits, dunes, **recurring slope lineae** (contested) [M]; red dust over dark basalt [M].
- **Wind/weather:** thin air means little force, but suspended dust matters: **dust devils** (tens–hundreds of m wide) [M]; katabatic winds; storms [M]. Visibility and sensor drag modelled.
- **Heat/pressure:** −125…+20 °C [M]; entry heating exists; terminal velocity of the Wayfarer ≈ 373 m/s at the surface (see `01`) so powered descent is mandatory [D].
- **Light:** the Sun is ~0.43× the solid-angle of Earth's [D]; dusty sky diffuses it; long twilights from scattering [D].
- **Audio:** thin air carries sound weakly: **low, tinny** engine/wind; dust hiss; entry roar quieter than Earth's.
- **Moons:** **Phobos** (11 km mean radius, orbits in 7.7 h [M]) and **Deimos** (6 km, 30 h [M]): irregular potato shapes (artistic [A]), grooves on Phobos [M], almost no gravity.
- **Landmarks/sites:** Jezero, Gale, Olympus summit rim approach, Valles flight line, Hellas floor, Viking/Pathfinder (historic: protect), Utopia/Elysium plains.
- **Gameplay:** the **canonical entry/descent/landing** puzzle: use heat shield + retro-burn; dust storm "hard mode" (visibility and sensor noise).
- **Verify:** pressure/composition/scale height, Olympus/Valles/Hellas dimensions, dust-storm onsets (repo already flags), dust-devil sizes, moon sizes/periods.

## 7. Jupiter

- **Approach:** banded cloud tops, the **Great Red Spot** (≈ 1.3 Earth widths today, shrinking [M]); the planet is huge (angular size from Io ≈ 20° ⚠[D]); faint rings and four bright Galileans.
- **Atmosphere & "no surface":** H₂/He with NH₃/NH₄SH/H₂O cloud decks [M]; reference level **1 bar** [M]; scale height ~27 km [M]. Going deeper: pressure rises ≈ ×e per scale height [D]; at 10 bar temperatures are ~ 300 K [M]; at 100 bar ≈ 800 K ⚠ [D]; the ship's **crush limit** stops descent (design number [A]).
- **Sky:** from within the cloud deck: fog tinted by whichever deck you're in: cream-white (NH₃), brown (NH₄SH), blue-grey (H₂O) [D/A].
- **Wind/weather:** **zonal jets** alternating by latitude with speeds up to ~100 m/s [M] (≈ 360 km/h); the shear zones produce **cells and "barges"**; the GRS rim has anticyclonic rotation (~120 m/s ⚠[M]); **lightning flashes** [M] (rendered as deck-lit flashes with long glow); **auroras** at the poles in UV [M] (visible-light stylisation [A]).
- **Radiation:** intense belts: dose rate peaks near Io's torus [M]. Design: a **radiation meter**; shielding rating; time-boxed exposure; recall on overdose [A numbers].
- **Rings:** faint, dusty, thin [M] (rendered extremely subtle).
- **Audio:** dense hydrogen carries sound at high pitch (speed of sound in H₂ is ~3× air [D]): **higher, thinner** engine tone; wind roar; electrical crackle when radiation is high (artistic [A]).
- **Gameplay:** "Dive the GRS rim" and "Skim the cloud tops" missions; precise depth gauge; storm approach warnings.
- **Verify:** 1-bar reference temperature, layer pressures, jet speeds, GRS size, radiation dose, ring brightness.

### 7a. Io
- Volcanic world: **Pele plume** (~300 km high ⚠), **Loki Patera** (lava lake ~200 km ⚠), sulfur and SO₂ frost colours (yellow, white, orange, black) [M], **mountains up to ~17 km** ⚠ (Boösaule Montes) [M]. Surface temperature ~ −130 °C but hot spots > 1,500 K ⚠ [M].
- Sky: Jupiter filling a huge fraction of the sky; **eclipses** by Jupiter; **Io–Jupiter flux tube** aurora [M] (stylised).
- Hazards: radiation (worst of the Galileans), plume ash (visibility), heat near hot spots.
- Audio: none in vacuum; **trace SO₂ atmosphere** is too thin for sound.

### 7b. Europa
- Ice shell with **lineae** (cracks), **chaos terrain** (Conamara), brown salt/sulfur stains [M]; surface ~ −170 °C [M]; **possible plumes** [M: tentative].
- Sky: Jupiter large and banded; faint exosphere of O₂ [M]; strong radiation at the surface [M].
- Gameplay: a "scenic and dangerous" landing (radiation + rough ice), Conamara site.

### 7c. Ganymede
- Largest moon (> Mercury in size) [M]; **grooved terrain** vs dark cratered terrain [M]; intrinsic **magnetic field** and aurora [M].
- Sky: Jupiter very large; mild radiation relative to Io/Europa [M].
- Gameplay: a "base-camp" moon for the Jovian tour.

### 7d. Callisto
- Oldest, most heavily cratered surface; **Valhalla** multi-ring basin [M]; low radiation [M]; dark dust-covered ice with bright crater floors [M].
- Gameplay: the calm, safe moon: easy landing practice in the Jovian system.

## 8. Saturn and its system

- **Approach:** pale gold banded planet [M], the famous **rings** (A, B, C, D; Cassini Division) [M]; north-pole **hexagon** [M]; rings' shadow on the planet [M].
- **Atmosphere:** H₂/He with NH₃ clouds, scale height ~60 km [M]; equatorial jet up to ~500 m/s [M]; **Great White Storm** (rare, artistic spawn [A]).
- **Rings (detailed):** main rings span ~74,500–140,220 km radius [M]; typical vertical thickness ~10 m–1 km [M]; particles cm–metres, mostly water ice [M]. At ship scale the particles are **sparse enough to fly through** with occasional glints and impacts (non-lethal "ping" damage at high speed [A]). Visual: 3-D instanced particles near the ship over a 2-D ring texture; **spokes** (rare, artistic) [M/uncertain].
- **Moons:** **Titan** (see §9), **Enceladus** (geysers), **Rhea, Dione, Tethys, Mimas (Herschel), Iapetus (two-tone), Hyperion (sponge)** [M]; positions need the mean-element model (gap).
- **Radiation:** modest versus Jupiter [M].
- **Audio:** hydrogen atmosphere: high-pitched wind; no sound in the rings.
- **Gameplay:** "Thread the Rings" (precision flying through the Cassini Division), "Hexagon fly-by", ring shadow orbit.
- **Verify:** ring radii/thickness, hexagon size, jet speeds, moon elements.

### 8a. Enceladus
- Small (252 km radius [M]), bright white ice [M]; **tiger stripes** and geysers (~ hundreds of kg/s of water vapour [M]) rising up to ~ hundreds of km; plume particles feed Saturn's E ring [M].
- Gravity 0.11 m/s² [M]: the ship can hop with hover jets only. Visuals: bright ice, blue-white shadows, water-vapour plumes lit from behind.

### 8b. Iapetus, Rhea, Mimas, Hyperion (shape/tone variety)
- Iapetus: **two-tone** (dark leading hemisphere, bright trailing) [M], equatorial ridge (up to ~20 km ⚠) [M]; Mimas: **Herschel crater** (~130 km ⚠) [M]; Hyperion: chaotic tumbling, sponge-like craters [M]; Rhea: heavily cratered ice.

## 9. Titan

- **Approach:** a featureless **orange-brown hazy ball** [M]; **detached haze layer** ~ 500 km ⚠ [M].
- **Atmosphere & sky:** **1.47 bar** N₂ ~95 %, CH₄ ~5 % [M]; surface temperature **94 K** [M]; scale height ~20 km [M]; dense, cold, laminar: **flight is easy** (see `01` §3: terminal speed ≈ 14 m/s for the Wayfarer) [D].
- **Surface:** **dunes** of organic grains (equatorial belts) [M], **methane/ethane lakes and seas** (Kraken Mare, Ligeia Mare) at the poles [M], icy bedrock "rocks" [M], river channels [M], **cryovolcanic** features (Sotra Patera) [M/uncertain].
- **Weather:** low surface winds ~1 m/s [M], **methane clouds** and rare heavy rain [M/uncertain]; seasonal **polar vortices** [M]; use calm, smooth air with slow clouds [A].
- **Light:** the sun is a dim diffuse glow, ~1 % of Earth's (≈ 1/90 at 9.5 AU) [D]; the sky is orange-brown. Surface light level like twilight.
- **Audio:** dense cold air: **very deep, low-pitched** sound; wind whisper; liquid lapping on lakes.
- **Landmarks/sites:** **Huygens landing site** (historic; protect), Kraken Mare shore, Ligeia Mare, Xanadu (bright region), Shangri-La dunes.
- **Gameplay:** the **"Titan Glide"** mission: powered flight with minimal thrust (the thick, cold air lets large wings or gentle hover do most of the work); a showcase of dense-atmosphere flight and the optional aerostat module.
- **Verify:** pressure/temperature profile, haze layers, wind, lake names/positions, dune extent.

## 10. Uranus (+ Miranda)

- **Approach:** a pale cyan-blue featureless ball (methane absorbs red) [M]; **tilted 97.77°** [M] so one pole faces the Sun for decades (seasons dominate the look); faint rings [M]; the moons Titania, Oberon, Umbriel, Ariel, Miranda.
- **Atmosphere:** H₂/He/CH₄, scale height ~28 km [M]; jets up to ~±250 m/s [M]; cold: 76 K at 1 bar [M]; very bland cloud bands with occasional bright methane clouds [M].
- **Light:** the Sun is ~1/370 of Earth's brightness (~19 AU) [D]: dim, with long polar day/night [D].
- **Miranda:** huge cliffs: **Verona Rupes** ~20 km high ⚠ [M], patchwork "coronae" [M]. Gravity 0.08 m/s²: slow-fall gliding over cliffs is a signature moment [D].
- **Audio:** hydrogen-air high-pitched whistle; cold creaking hull.
- **Verify:** tilt/seasonal state at the date, jet speeds, Verona Rupes height.

## 11. Neptune (+ Triton)

- **Approach:** deeper blue than Uranus (extra absorber/haze [M]), **dark spots** and bright **white methane cirrus** [M]; **fastest winds in the Solar System** ~ 580 m/s (≈ 2,100 km/h) ⚠ [M]; faint rings with arcs [M].
- **Triton:** retrograde orbit (captured) [M]; **nitrogen geysers** and dark plume streaks [M]; **cantaloupe terrain** [M]; extremely cold ~38 K ⚠ [M]; very thin N₂ atmosphere ~1.4 Pa ⚠ [M].
- **Light:** the Sun ~ 1/900 Earth's (≈ 30 AU) [D]: a bright star-like disc that still lights the world; **Neptune-shine** colours Triton's sky.
- **Gameplay:** fly into a **Great-Dark-Spot-like vortex** (artistic placement, since real spots appear and vanish [M]); Triton hop-geyser flight.
- **Verify:** wind maxima, Triton temperature/pressure, ring arc positions.

## 12. Pluto and Charon

- **Pluto:** **Sputnik Planitia** (a vast nitrogen-ice plain, ~1,000 km wide ⚠) [M] with **convection cells**; **mountains of water ice** (to ~3.5 km ⚠) [M]; **tholin red** regions (Cthulhu) [M]; **layered blue haze** extending ~ 200 km ⚠ [M]; thin N₂ atmosphere ~1 Pa ⚠ [M] and ~230 °C below zero [M].
- **Charon:** grey with a red polar cap (Mordor Macula) [M], enormous canyons (Serenity Chasma) [M]; the pair orbit a barycentre outside Pluto (6.39-day period [M]): **both are tidally locked** to each other [M] so Charon hangs fixed in Pluto's sky on one hemisphere [D].
- **Light:** the Sun is ~1/1,600 of Earth's at 39.5 AU [D]; Charon-shine on Pluto's night.
- **Gameplay:** "Sputnik Planitia glide", "Haze layer dive".
- **Verify:** haze altitudes, tholin placement, mountain heights, barycentre geometry (astronomy-engine supports Pluto position; Charon needs mean elements).

## 13. Ceres and Vesta (and the asteroid belt)

- **Ceres:** **Occator Crater** with bright salt deposits (carbonates) [M]; **Ahuna Mons** (cryovolcano, ~4 km tall ⚠) [M]; dark grey; surface ~ −105 °C [M]; no atmosphere.
- **Vesta:** the **Rheasilvia** south-pole crater (~500 km ⚠) with a central peak ~ 20 km ⚠ [M]; equatorial troughs [M]; bright and dark material mix [M].
- **The belt:** in reality **extremely sparse** (average spacing millions of km [M]); flying through it is almost always empty. `/fly` shows the *real* emptiness by default and offers an **"artistic belt density" toggle** for drama [A].
- **Gravity/landing:** ~0.28 / 0.25 m/s²: hover-tier landings with soft touchdown; dust behaves ballistically.
- **Verify:** crater dimensions, mountain heights, belt density, Ceres/Vesta elements.

## 14. Small irregular bodies (Phobos, Deimos, Hyperion…)

Shapes are **artistic** (no shape models offline): seeded triaxial potato meshes with correct mean radii and axis ratios [A]; crater populations typical of small bodies; **tumbling** only for chaotic ones (Hyperion) [M]; the "gravity" is a point mass with a shallow slope field (no accurate mascons). Landing is a very low-speed docking-like touch. **Verify** radii and axis ratios.

## 15. The planetary rings and the "emptiness" principle

The universe is very empty at human scale. The default is **real density**: rings thin and see-through at close range, belts nearly empty. Drama options (toggle): "Artistic density" for the belt and rings that adds visible grains for a better visual read. A reality-panel line always states which mode is active.

## 16. Cross-world effect catalogue (shared building blocks)

| Effect | Used by | Notes |
|---|---|---|
| Dust plume (ballistic vs billowing) | Moon, Mars, Mercury, asteroids, Titan, Venus | switch by ambient pressure (vacuum → ballistic; thin → billowing; thick → smothered) |
| Plasma sheath / reentry glow | Earth, Mars, Venus, Titan (weak), gas giants (deep dive) | scales with `q̇` |
| Cloud-deck fog | Venus, Jupiter, Saturn, Titan, Uranus, Neptune | coloured by deck, fog density by depth |
| Lightning | Earth, Jupiter, Venus (rare) | photosensitivity cap |
| Aurora | Earth, Jupiter, Saturn, Ganymede, Uranus/Neptune (weak) | stylised per world |
| Eclipse and ring shadows | Jovian/Saturnian systems, Earth–Moon | analytic shadow cones |
| Planet-shine | all moons | albedo-scaled fill light |
| Geysers/plumes | Io, Enceladus, Triton, Europa (tentative), Mars (CO₂ spiders: not in v1) | particle systems with ballistic arcs |
| Liquid surfaces | Earth oceans, Titan lakes | wave spectrum + Fresnel + specular glint |
| Heat shimmer | Earth, Venus (surface), exhausts | disabled with reduced motion |
