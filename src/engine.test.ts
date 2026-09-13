import { describe, expect, it } from 'vitest';
import { Engine } from './engine';

describe('Arcane Bastion simulation', () => {
  it('starts a campaign wave and produces advancing enemies', () => {
    const game = new Engine();
    game.startWave();
    for (let i = 0; i < 180; i++) game.update(1 / 60);
    const state = game.snapshot();
    expect(state.wave).toBe(1);
    expect(state.enemies).toBeGreaterThan(0);
    expect(state.phase).toBe('playing');
  });

  it('charges, upgrades, and sells a valid tower without leaking tower count', () => {
    const game = new Engine();
    expect(game.placeTower('bolt', 250, 120)).toBe(true);
    expect(game.snapshot().gold).toBe(390);
    expect(game.upgradeTower(0)).toBe(true);
    expect(game.sellTower(0)).toBe(true);
    expect(game.snapshot().towers).toBe(0);
  });

  it('uses bounded combat effect state when a placed defense fires', () => {
    const game = new Engine();
    expect(game.placeTower('bolt', 250, 120)).toBe(true);
    game.startWave();
    let sawEffect = false;
    for (let i = 0; i < 480; i++) { game.update(1 / 60); sawEffect ||= game.effectCount > 0; }
    expect(sawEffect).toBe(true);
    expect(game.effectCount).toBeLessThanOrEqual(768);
  });

  it('provisions the required stress scenario with pooled active entities', () => {
    const game = new Engine();
    game.setupBenchmark(false, 5000, 100, 1000);
    const state = game.snapshot();
    expect(state.enemies).toBe(5000);
    expect(state.towers).toBe(100);
    expect(state.projectiles).toBe(1000);
    for (let i = 0; i < 30; i++) game.update(1 / 60);
    expect(game.snapshot().enemies).toBeGreaterThan(0);
  });

});
