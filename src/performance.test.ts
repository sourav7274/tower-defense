import { describe, expect, it } from 'vitest';
import { summarizeFrames } from './performance';

describe('frame measurement', () => {
  it('reports the slow tail and keeps uncapped frame intervals', () => {
    const frames = [...Array(94).fill(16), ...Array(5).fill(30), 120];
    const result = summarizeFrames(frames)!;
    expect(result.frames).toBe(100);
    expect(result.p95Ms).toBe(30);
    expect(result.lowPointOneFps).toBeCloseTo(1000 / 120);
    expect(result.percentAt45Fps).toBe(94);
    expect(result.percentOver33Ms).toBe(1);
    expect(result.averageFps).toBeCloseTo(100000 / (94 * 16 + 5 * 30 + 120));
  });
});
