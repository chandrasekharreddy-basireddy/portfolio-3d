# Chandra's World — a 3D walking portfolio

A real-time 3D portfolio built with Three.js (r128): a small explorable game world
where the portfolio content lives inside the environment. The player character is
a rigged Iron Man model walking a trail from the mountain camp down to a final
viewpoint, past six information stations.

**Live site:** https://chandrasekharreddy-basireddy.github.io/portfolio-3d/

## The world

The journey runs north to south along a trail (~70 m) with a full day/night cycle,
four seasons and weather:

| Zone | Where | What's there |
|---|---|---|
| Mountain arrival | north end | camp desk, laptop, ID card, framed photo (About) |
| Skills Forest | west of the trail | 14 glowing skill crystals ([E] to inspect), holographic skill tree |
| Waterfall & river | east | falling water, droplet spray, fish in the pond, flowing river outlet |
| Bridge | over the pond | wooden crossing with footsteps audio |
| Project District | west, mid-trail | Survival School / Signal-Lite / SaiU V2 buildings, rotating architecture holograms, reserved plot, Iron Man statue, secret dev room behind the waterfall |
| University campus | west, lower trail | SAI UNIVERSITY block, library, notice board with real marks, study courtyard, night lamps |
| Waystation | before the end | six plinths that light up per discovered station, journey obelisk |
| Final viewpoint | south end | elevated deck with ramp, railing, bench and brass telescope overlooking the world |

Wildlife: fox (wanders, idles, follows you), wolf patrol, horse, peacock,
toucan, monkey (hops between rocks), birds (one lands and takes off), fish,
butterflies anchored to the flower beds.

## Controls

- **Scroll** — walk the journey; cards open at stations
- **WALK button** — free walk: WASD / arrows, Shift to run, Space to jump (ballistic arc, reduced air control), E to interact, ESC for menu
- **ESC** — pause menu (guided tour, photo mode, cinematic, journey & achievements, jump-to, reset)
- **P** / **C** — photo mode / cinematic mode
- **F** — take a photo in photo mode (downloads a PNG)
- **T** / season buttons — time of day / seasons; sound and quality in the menu
- Mobile: joystick, swipe camera, tap prompts, SNAP button in photo mode

## Systems

- `js/data.js` — all real portfolio content, quests, achievements
- `js/state.js` — localStorage persistence (`cs_world_save_v1`): stops, orbs, achievements, quests, playtime
- `js/world.js` — terrain, vegetation, water, waterfall, day/night, seasons, weather, audio
- `js/places.js` — skills forest, project district, campus, waystation, viewpoint
- `js/main.js` — game loop, characters, camera, interaction system, HUD, modes
- `js/vendor/` — three.js r128 + loaders, vendored locally (no CDN dependency)
- `classic.html` — static no-WebGL fallback with the same content

Performance: quality presets, an FPS watchdog that steps down once on struggling
devices, pooled footprints/decals, throttled minimap.

## Verification

Every push runs `test/worldsim.js` on GitHub Actions — a headless harness that
boots the real page with jsdom + three r128, drives the full journey (intro →
stations → ending), free walk, skill inspection, project dossiers, all game
modes, seasons and persistence, and fails on any runtime error.

[![worldsim](https://github.com/chandrasekharreddy-basireddy/portfolio-3d/actions/workflows/verify.yml/badge.svg)](https://github.com/chandrasekharreddy-basireddy/portfolio-3d/actions/workflows/verify.yml)

To run it locally:

```bash
cd test && npm install && node worldsim.js
```

## Serving locally

Any static server works, e.g. `python3 -m http.server` from the repo root.
