# Performance numbers

All results below are browser measurements from the Performance Lab on the recording machine. The Lab uses a 10-second warm-up followed by the selected measurement window. Keep the tab visible for a valid run; a capture containing a frame stall above one second is marked invalid and must not be used here.

## Current exploratory comparison

| Mode | Enemies | Towers | Projectiles | Population policy | Average FPS | P95 frame time | 0.1% low | 45+ FPS frames | Frames >33 ms | Status |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Naive comparison | 5,000 | 100 | 1,000 | Replace to hold load | ~14 | Not captured | Not captured | Not captured | Not captured | Exploratory before value recorded live |
| Optimized engine | 5,000 | 100 | 1,000 | Replace to hold load | 22.0 | 50.1 ms | 15 FPS | 0.0% | 100.0% | Valid 30-second total run; final target not met |

The 22 FPS optimized result is approximately a 57% improvement over the ~14 FPS naive comparison under the same stated load. It is a real before/after delta, but it does **not** meet the assessment target of 45+ FPS for 95% of frames and under 5% of frames above 33 ms.

## Excluded results

| Result | Why excluded |
| --- | --- |
| 39 FPS optimized run | Used a temporary smaller-sprite LOD experiment. It was removed because it compromised visual quality. |
| 0 FPS / P95 30,146 ms run | Contained a browser stall/suspension and is not a valid capture. The Lab now flags this situation rather than reporting it as a score. |

## Reproducibility notes

- Lab mode: Optimized engine or Naive comparison
- Load: 5,000 enemies / 100 towers / 1,000 projectiles
- Population policy: Replace to hold load
- Final recording run: use a 60-second total timer (10 seconds warm-up, 50 seconds measured)
- Record browser version, OS, screen resolution/refresh rate, CPU, GPU, and RAM beside any final result.
