# Arcane Bastion

A self-contained, browser-based tower-defense game built for a fifty-wave campaign and an inspectable performance comparison. No server, account, CDN, external images, or runtime API is required.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. Use `npm run build` for the production build and `npm run test` for simulation tests.

## Play

- Select Rune Bolt (`1`), Ember Mortar (`2`), or Frost Obelisk (`3`), then click clear ground to place it.
- Click a placed tower after pressing `Esc` to inspect it, upgrade it, or sell it.
- Begin the next wave from the battlefield button. `Space` pauses; the top controls restart and cycle 1×/2×/3× speed.
- Survive wave 50 with the citadel ward intact to win.

## Architecture

`src/engine.ts` is a framework-independent simulation. It uses one fixed 60 Hz update loop, seeded wave generation, compact enemy/projectile pools, and a uniform spatial grid. The DOM only owns controls and accessible textual state; it never holds thousands of game entities.

`src/renderer.ts` owns drawing. It renders a static Canvas 2D relief map only when the viewport resizes, then streams visible dynamic instances to WebGL2 each frame. The WebGL renderer uses instanced quads for towers, enemies, and projectiles. Browsers without WebGL2 receive a simpler Canvas fallback.

`src/main.ts` connects the renderer, simulation, controls, game states, and the Performance Lab. The only recurring scheduler is `requestAnimationFrame`; individual towers, enemies, and projectiles do not create timers or animation loops.

## Gameplay systems

| System | Behavior |
| --- | --- |
| Towers | Rune Bolt: fast single-target fire. Ember Mortar: heavy splash. Frost Obelisk: damage plus slow. Each has three levels and a 60% sell value. |
| Enemies | Swift Wisps, armored Golems, splitting Broodlings, shielded Specters, and Warden bosses every tenth wave. |
| Progression | Wave health and composition scale through 50 waves; bosses, armor, shields, splitting, and faster spawns increase late-game pressure. |

## Highwatch art direction

The campaign is presented as **Siege of Highwatch**: Blue Knights defend an elevated citadel while Goblin raiders cross a lower ravine. The static terrain layer uses a curated Tiny Swords subset and rebakes at waves 1, 11, 21, 31, and 41; troop positions and the enemy route persist. Players deploy animated Longbow Guards, Siege Engineers, and Shield Warriors onto ridge posts, train them through three ranks, and discharge them for gold. See `ASSET_CREDITS.md` for asset provenance.

## Performance design

The costly operations in a tower-defense game are target selection, collision/splash queries, entity allocation, and drawing many objects. Arcane Bastion addresses them as follows:

- **Typed-array pools:** enemies and projectiles reuse fixed slots. This avoids object churn and keeps memory broadly flat over a run.
- **Spatial grid:** every active enemy is linked into a nearby map cell each simulation tick. Towers and splash effects query only cells intersecting their radius rather than scanning the complete population.
- **Batched WebGL2:** all dynamic entities are sent in one reusable instance buffer and one instanced draw call. The static relief map is not redrawn every frame.
- **Fixed timestep:** simulation runs at 60 Hz via an accumulator, with rendering decoupled from monitor refresh rate.
- **Visibility-aware rendering:** the instance emission path is isolated from simulation and can reject entities outside the current battlefield view when a camera is introduced; the shipped map is deliberately framed to the playable viewport.

## Performance Lab and measurement

Open **Performance Lab** in the right command dock. It runs the same seeded scenario in two modes:

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

The project is a static Vite app and is ready for a Vercel static deployment after local verification. The current delivery intentionally stops before account-connected deployment, per project direction.
