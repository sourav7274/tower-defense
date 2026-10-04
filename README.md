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

`src/engine.ts` is a framework-independent simulation. It uses one fixed 60 Hz update loop, seeded wave generation, compact enemy/projectile pools, and a uniform spatial grid. The DOM only owns controls and accessible textual state; it never holds thousands of game entities. The benchmark uses the same simulation as the campaign, but slows enemy movement to 28%, multiplies tower damage by 12, and gives the gate infinite health. Lethal hits count as kills and the defeated raider re-enters near the path entrance; tower shots reuse the fixed projectile slots. This keeps the requested population active throughout a measurement while attacks still have visible consequences. These rules apply only in the Performance Lab.

`src/renderer.ts` owns drawing. It rebakes the static Canvas 2D map only on a level/wave change or viewport resize. Normal combat uses animated Canvas sprites. `src/lab-sprites.ts` packs local enemy and projectile art into a texture atlas and draws high-load instances through WebGL2; the naive comparison draws that same art individually on Canvas 2D. Towers and combat effects retain their animated Canvas layer in both lab modes. Browsers without WebGL2 receive a Canvas fallback.

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
- **Batched WebGL2:** high-load enemies and projectiles share one texture atlas, one reusable instance buffer, and one instanced draw call. The static relief map is not redrawn every frame.
- **Fixed timestep:** simulation runs at 60 Hz via an accumulator, with rendering decoupled from monitor refresh rate.
- **Visibility-aware rendering:** the instance emission path is isolated from simulation and can reject entities outside the current battlefield view when a camera is introduced; the shipped map is deliberately framed to the playable viewport.

## Performance Lab and measurement

Open the live **Performance Overlay** or **Performance Lab** from the top bar. The overlay inspects normal campaign metrics without blocking play; the lab runs a separate seeded comparison scenario in two modes:

- **Naive comparison:** broad tower scans plus per-entity Canvas 2D drawing. It shares the typed-array engine with the optimized mode and is a reference comparison, not proof of the performance of an earlier LLM version.
- **Optimized engine:** typed-array pools, spatial grid, and batched WebGL2 production rendering.

Each mode has 1,000, 2,500, and 5,000 enemy presets. The 5,000 preset starts with 100 towers and 1,000 active projectiles alongside the enemies. Choose **Replace to hold load** for the requirement stress test: defeated raiders re-enter and the benchmark can prove the minimum active population. Choose **Die permanently** for a combat demonstration: defeated raiders leave the field and the final result records the lower minimum enemy count. If permanent-death mode clears the field before the timer ends, the run stops early and reports that outcome. Choose a 30-, 45-, or 60-second total run: the first ten seconds warm up, and the remaining time is measured before the simulation pauses automatically.

When a scenario starts, the Lab collapses into a right-side live monitor so the battlefield stays visible. It shows warm-up or capture time remaining, active enemies and projectiles, and defeats. Opening **Lab** again expands the configuration panel. At completion or an early field clear, the full Lab report reopens automatically.

The final result shows average FPS, P95 frame time, 0.1% low FPS, percentage of frames at or above 45 FPS, percentage over 33 ms, defeats, minimum active counts, and JS heap usage where Chromium exposes it. Frame intervals are recorded raw; only simulation time is capped after a delayed frame. Pausing during a run pauses the capture clock.

For an assessment measurement, use a production build in a current Chrome or Edge window, close unrelated tabs, select **5,000 stress**, **Replace to hold load**, and a capture duration, then wait for the automatic result. Record browser version, OS, display resolution/refresh rate, CPU, GPU, and RAM alongside the result. The acceptance target is at least 45 FPS for 95% of sampled frames and fewer than 5% of frames above 33 ms, with the minimum active counts during capture meeting the chosen load. Results are hardware-specific and should be reported honestly rather than generalized.

The pre-measurement project is preserved as the local Git tag `baseline-pre-measurement` at commit `1c3277744ed441f48f706e4f18f6c26e5a6cb7b9`. Run it in a separate checkout for a version comparison. This tag captures the project before the sustained-load and measurement fixes; it does not identify the original LLM implementation. The in-app comparison mode and the historical Git version answer different questions and should be described separately in the recording.

## Recording kit (3–4 minutes)

1. Introduce Arcane Bastion and show the playable campaign: choose a tower, place it, launch a wave, upgrade/sell, pause, and change speed.
2. Open Performance Lab. Explain that **Naive baseline** is a comparison mode with global tower scans and individual Canvas entity draws; do not present it as the historical initial LLM implementation.
3. Run the baseline at 1,000, then 2,500/5,000 enemies; visibly show the live FPS and `Frames over 33ms` metric dropping.
4. Explain the improvements: fixed timestep, pools, spatial grid, static map caching, and one batched WebGL instance stream.
5. Switch to **Optimized engine**, choose **5,000 stress**, run it for at least ten seconds, and show `5,000 / 100 / 1,000` plus the live metrics.
6. Close with the game’s complete campaign state and performance delta. Record with webcam/face enabled and speak English. Submit the finished Loom link yourself through the assignment form.

## Deployment

The project is a static Vite app. Vercel detects Vite automatically: set the project root to this folder, leave the build command as `npm run build`, and publish the generated `dist` directory. No environment variables are required.
