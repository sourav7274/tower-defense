# Arcane Bastion

A self-contained, browser-based tower-defense game built for a fifty-wave campaign and an inspectable performance comparison. No server, account, CDN, external images, or runtime API is required.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. Use `npm run build` for the production build and `npm run test` for simulation tests.

## Play

- Select Longbow Guard (`1`), Bombard Tower (`2`), or Shield Warrior (`3`) from the bottom build tray, then click clear ground to place it.
- Click a placed tower after pressing `Esc` to inspect it, upgrade it, or sell it.
- Begin the next wave from the battlefield button. `Space` pauses; the top controls restart and cycle 1×/2×/3× speed.
- Each of the five levels begins with a fresh defense, castle health, and economy. Score and kills carry over. Survive Level 5, Wave 10 to win.
- Use the top-bar information button for the rules and the FPS button for the non-blocking live Performance Overlay.

## Architecture

`src/engine.ts` is a framework-independent simulation. It uses one fixed 60 Hz update loop, seeded wave generation, compact enemy/projectile pools, and a uniform spatial grid. The DOM only owns controls and accessible textual state; it never holds thousands of game entities.

`src/renderer.ts` owns drawing. It rebakes the static Canvas 2D map only on a level/wave change or viewport resize, then streams visible dynamic instances to WebGL2 each frame. The WebGL renderer uses instanced quads for high-load fallback entities. Browsers without WebGL2 receive a simpler Canvas fallback.

`src/main.ts` connects the renderer, simulation, controls, game states, and the Performance Lab. The only recurring scheduler is `requestAnimationFrame`; individual towers, enemies, and projectiles do not create timers or animation loops.

## Gameplay systems

| System | Behavior |
| --- | --- |
| Defenders | Longbow Guard: fast single-target fire. Bombard Tower: heavy splash. Shield Warrior: damage plus slow. Each has three training ranks and a 60% sell value. |
| Raiders | Goblin Torch, Barrel, TNT, Warrior, and Archer/boss variants. Raiders that reach Highwatch stop at the gate, attack, then reduce its integrity. |
| Progression | Five authored levels of ten waves use unique routes, gate-facing castle placement, terrain themes, and starting gold (500–700). Bosses, armor, shields, splitting, and faster spawns increase late-game pressure. |

## Highwatch art direction

The campaign is presented as **Siege of Highwatch**: Blue Knights defend an elevated citadel while Goblin raiders cross a lower ravine. Five themed maps—Highwatch Gate, Mist Narrows, Siege Scar, Flooded Ravine, and Last Stand—own their routes, scenery, and castle approach. The castle rotates toward each final approach; its visible doorway is also the breach target, rather than the route's outer map endpoint. Static terrain is rebaked only between waves and levels. Players deploy animated Longbow Guards, Siege Engineers, and Shield Warriors, train them through three ranks, and discharge them for gold. See `ASSET_CREDITS.md` for asset provenance.

## Performance design

The costly operations in a tower-defense game are target selection, collision/splash queries, entity allocation, and drawing many objects. Arcane Bastion addresses them as follows:

- **Typed-array pools:** enemies and projectiles reuse fixed slots. This avoids object churn and keeps memory broadly flat over a run.
- **Spatial grid:** every active enemy is linked into a nearby map cell each simulation tick. Towers and splash effects query only cells intersecting their radius rather than scanning the complete population.
- **Batched WebGL2:** all dynamic entities are sent in one reusable instance buffer and one instanced draw call. The static relief map is not redrawn every frame.
- **Fixed timestep:** simulation runs at 60 Hz via an accumulator, with rendering decoupled from monitor refresh rate.
- **Visibility-aware rendering:** the instance emission path is isolated from simulation and can reject entities outside the current battlefield view when a camera is introduced; the shipped map is deliberately framed to the playable viewport.

## Performance Lab and measurement

Open the live **Performance Overlay** from the top bar to inspect normal campaign metrics without blocking play. Open **Performance Lab** from the contextual command panel when you want to run the separate seeded comparison scenario in two modes:

- **Naive baseline:** deliberately broad tower scans plus per-entity Canvas 2D drawing. It is visibly labelled as a comparison reference, not the shipping implementation.
- **Optimized engine:** typed-array pools, spatial grid, and batched WebGL2 production rendering.

Each mode has 1,000, 2,500, and 5,000 enemy presets. The 5,000 preset also provisions 100 towers and 1,000 active projectiles. The lab displays rolling FPS, 95th-percentile FPS, percentage of frames over 33 ms, exact active counts, and JS heap usage where Chromium exposes it.

For an assessment measurement, use a production build in a current Chrome or Edge window, close unrelated tabs, select **5,000 stress**, let it warm for ten seconds, then record at least thirty seconds of rolling metrics. Record browser version, OS, display resolution/refresh rate, CPU, GPU, and RAM alongside the result. The acceptance target is at least 45 FPS for 95% of sampled frames and fewer than 5% of frames above 33 ms. Results are hardware-specific and should be reported honestly rather than generalized.

## Recording kit (3–4 minutes)

1. Introduce Arcane Bastion and show the playable campaign: choose a tower, place it, launch a wave, upgrade/sell, pause, and change speed.
2. Open Performance Lab. Explain that **Naive baseline** deliberately represents an initial object-heavy implementation: global tower scans and individual Canvas entity draws.
3. Run the baseline at 1,000, then 2,500/5,000 enemies; visibly show the live FPS and `Frames over 33ms` metric dropping.
4. Explain the improvements: fixed timestep, pools, spatial grid, static map caching, and one batched WebGL instance stream.
5. Switch to **Optimized engine**, choose **5,000 stress**, run it for at least ten seconds, and show `5,000 / 100 / 1,000` plus the live metrics.
6. Close with the game’s complete campaign state and performance delta. Record with webcam/face enabled and speak English. Submit the finished Loom link yourself through the assignment form.

## Deployment

The project is a static Vite app. Vercel detects Vite automatically: set the project root to this folder, leave the build command as `npm run build`, and publish the generated `dist` directory. No environment variables are required.
