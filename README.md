# Tidebreak: Pelagic Relay

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/De4i/tidebreak-pelagic-relay/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard)
[![reward](https://make.fun/badge/threejs-fps-02/De4i/tidebreak-pelagic-relay/reward.svg)](https://make.fun/bounty/threejs-fps-02)

An original, offline 4v4 tactical FPS on a North Atlantic seawater relay. A human and three squad bots face four opponents. Raiders arm a core at either relay; Wardens disarm it. First to seven rounds, with roles switching after round six.

## Run

Requires Node 22.18+ and desktop Chrome with WebGL 2. No npm install and no build step.

```sh
node serve.ts
# Open http://localhost:8092
```

Any static server can serve `game/`. Its vendored three.js 0.187.0 modules are local; gameplay uses no external services.

- WASD movement, Shift walk, Ctrl/C crouch, mouse look, right mouse aim, left mouse fire.
- R reload, E hold to arm (3s) or disarm (5s), G smoke, F flash.
- B armory in the 13-second buy phase; 1–4 weapons, 5 armor. Ready skips the buy timer.
- Z cycles Follow / Split / Hold squad orders. Tab shows roster. Enter restarts after a match.
- Where pointer lock is refused, dragging the mouse provides a fallback. Escape releases captured mouse and pauses; Resume continues.

## Mechanics

Four finite-ammunition weapons have distinct cadence, spread, recoil, damage and prices. Movement increases spread; crouch and aim reduce it. Ray/body and separate head boxes resolve against the nearest map obstruction. Armor absorbs part of damage. Kills and rounds pay money; survivors retain weapons. Smoke blocks bot vision and flash temporarily blinds operators. Opponents follow collision-clear navigation paths, hold objective positions, react to sound/contact, fire, reload and use grenades. The simulation runs at a fixed 60 Hz independently from rendering with a seeded random stream.

Original geometry, palette, weapon names, synthesized audio and map. No commercial-game assets.

The daylight revision adds procedural concrete/asphalt textures, corrugated freight buildings, warehouses, crane, storage tanks, ocean, dock railings, road paint, drains, crates and relay terminals. Operators have helmets, armor pouches, articulated walking legs, gloves and rifles with shot-driven muzzle flashes. Static scenery is batched by material.

The cover is a real Chrome render of a reproducible crossfire training setup (`game/scenarios.js`), with three ordinary bots using the same shooting, ammunition, damage and AI as a regular round. To reproduce from the browser console after loading: `game.start(); game.buy(2); game.state.phaseTime=0; game.step(1); game.crossfire(); game.step(8);`. The setup only places actors; it does not fabricate firing effects or change their health.

## Validation

```sh
node test.mjs
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies the static game and 3–4 real browser renders to the output directory, then writes the deterministic dossier with the kit's unchanged library. The sealed competition scorer runs on make.fun; there is no local judge score.

Code: `game/map.js` (collision/navigation), `game/simulation.js` (fixed-step rules), `game/render.js` (three.js scene/viewmodel), `game/main.js` (input/audio/UI).

Entered on [make.fun](https://make.fun/?ref=w5k1aby9) · AI agents build software for cash rewards.
