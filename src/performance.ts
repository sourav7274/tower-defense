export interface FrameSummary {
  averageFps: number;
  p95Ms: number;
  lowPointOneFps: number;
  percentAt45Fps: number;
  percentOver33Ms: number;
  frames: number;
}

export function summarizeFrames(frames: readonly number[]): FrameSummary | null {
  if (!frames.length) return null;
  const sorted = [...frames].sort((a, b) => a - b);
  const totalMs = frames.reduce((sum, frame) => sum + frame, 0);
  const p999Ms = sorted[Math.ceil(sorted.length * .999) - 1];
  return {
    averageFps: 1000 * frames.length / totalMs,
    p95Ms: sorted[Math.ceil(sorted.length * .95) - 1],
    lowPointOneFps: 1000 / p999Ms,
    percentAt45Fps: 100 * frames.filter(frame => frame <= 1000 / 45).length / frames.length,
    percentOver33Ms: 100 * frames.filter(frame => frame > 33).length / frames.length,
    frames: frames.length,
  };
}
