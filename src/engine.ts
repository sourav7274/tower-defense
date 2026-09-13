export const WORLD_W = 1800;
export const WORLD_H = 900;
const MAX_ENEMIES = 6000;
const MAX_PROJECTILES = 1800;
const CELL = 72;
const COLS = Math.ceil(WORLD_W / CELL);
const ROWS = Math.ceil(WORLD_H / CELL);

export type TowerKind = 'bolt' | 'mortar' | 'frost';
export type GamePhase = 'intro' | 'playing' | 'victory' | 'gameover';
export type EnemyKind = 0 | 1 | 2 | 3 | 4;
export type CommanderKind = 'archer' | 'warrior' | 'engineer';

export interface Tower { x: number; y: number; kind: TowerKind; level: number; cooldown: number; spent: number; }
export interface Commander { kind: CommanderKind; x: number; y: number; cooldown: number; hired: boolean; }
export interface GameSnapshot {
  phase: GamePhase; wave: number; health: number; gold: number; score: number; kills: number;
  enemies: number; projectiles: number; towers: number; spawning: boolean; remaining: number;
}

const path = [
  [0, 470], [190, 470], [330, 285], [570, 285], [715, 510], [940, 510],
  [1090, 250], [1320, 250], [1450, 570], [1640, 570], [1740, 450], [1800, 450],
] as const;
const segment: number[] = [];
const cumulative: number[] = [0];
for (let i = 1; i < path.length; i++) {
  const dx = path[i][0] - path[i - 1][0]; const dy = path[i][1] - path[i - 1][1];
  const d = Math.hypot(dx, dy); segment.push(d); cumulative.push(cumulative[i - 1] + d);
}
export const PATH_LENGTH = cumulative[cumulative.length - 1];

const towerStats: Record<TowerKind, { cost: number; range: number; reload: number; damage: number; speed: number; splash: number; color: [number, number, number]; }> = {
  bolt: { cost: 110, range: 230, reload: .32, damage: 15, speed: 740, splash: 0, color: [245, 196, 81] },
  mortar: { cost: 165, range: 275, reload: .95, damage: 50, speed: 430, splash: 105, color: [240, 109, 69] },
  frost: { cost: 145, range: 195, reload: .48, damage: 10, speed: 610, splash: 0, color: [120, 216, 232] },
};
export const towerInfo = towerStats;
export const commanderInfo: Record<CommanderKind, { cost: number; wave: number; range: number; reload: number; damage: number; splash: number; }> = {
  archer: { cost: 240, wave: 11, range: 310, reload: .45, damage: 26, splash: 0 },
  warrior: { cost: 330, wave: 21, range: 125, reload: .62, damage: 68, splash: 0 },
  engineer: { cost: 420, wave: 31, range: 280, reload: 1.25, damage: 74, splash: 132 },
};

const enemyStats: Record<EnemyKind, { hp: number; speed: number; armor: number; reward: number; base: number; color: [number, number, number]; size: number; }> = {
  0: { hp: 44, speed: 66, armor: 0, reward: 10, base: 1, color: [177, 229, 169], size: 10 }, // wisp
  1: { hp: 180, speed: 35, armor: 5, reward: 26, base: 2, color: [126, 102, 80], size: 16 }, // golem
  2: { hp: 64, speed: 52, armor: 1, reward: 15, base: 1, color: [205, 118, 162], size: 12 }, // broodling
  3: { hp: 105, speed: 46, armor: 2, reward: 20, base: 1, color: [145, 130, 242], size: 13 }, // specter
  4: { hp: 1350, speed: 25, armor: 8, reward: 150, base: 8, color: [234, 192, 98], size: 25 }, // warden
};
export const enemyInfo = enemyStats;

function pathPosition(distance: number): [number, number] {
  let i = 0; while (i < segment.length - 1 && distance > cumulative[i + 1]) i++;
  const t = Math.max(0, Math.min(1, (distance - cumulative[i]) / segment[i]));
  return [path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t];
}

export class Engine {
  readonly enemyActive = new Uint8Array(MAX_ENEMIES);
  readonly enemyType = new Uint8Array(MAX_ENEMIES);
  readonly enemyX = new Float32Array(MAX_ENEMIES);
  readonly enemyY = new Float32Array(MAX_ENEMIES);
  readonly enemyDist = new Float32Array(MAX_ENEMIES);
  readonly enemyHp = new Float32Array(MAX_ENEMIES);
  readonly enemyMaxHp = new Float32Array(MAX_ENEMIES);
  readonly enemySlow = new Float32Array(MAX_ENEMIES);
  readonly enemySlowTime = new Float32Array(MAX_ENEMIES);
  readonly nextInCell = new Int32Array(MAX_ENEMIES);
  readonly cellHead = new Int32Array(COLS * ROWS);
  readonly projectileActive = new Uint8Array(MAX_PROJECTILES);
  readonly projectileX = new Float32Array(MAX_PROJECTILES);
  readonly projectileY = new Float32Array(MAX_PROJECTILES);
  readonly projectileTarget = new Int32Array(MAX_PROJECTILES);
  readonly projectileDamage = new Float32Array(MAX_PROJECTILES);
  readonly projectileSpeed = new Float32Array(MAX_PROJECTILES);
  readonly projectileSplash = new Float32Array(MAX_PROJECTILES);
  readonly projectileSlow = new Float32Array(MAX_PROJECTILES);
  readonly projectileColor = new Uint8Array(MAX_PROJECTILES);
  readonly towers: Tower[] = [];
  readonly commanders: Commander[] = [
    { kind: 'archer', x: 1000, y: 170, cooldown: 0, hired: false },
    { kind: 'warrior', x: 1280, y: 360, cooldown: 0, hired: false },
    { kind: 'engineer', x: 1420, y: 155, cooldown: 0, hired: false },
  ];
  readonly enemyFree: number[] = [];
  readonly projectileFree: number[] = [];
  phase: GamePhase = 'intro'; wave = 0; health = 20; gold = 500; score = 0; kills = 0;
  enemyCount = 0; projectileCount = 0; spawnLeft = 0; spawnTimer = 0; spawning = false;
  private benchmark = false; private naive = false; private seed = 1;

  constructor() { this.reset(); }
  reset() {
    this.enemyActive.fill(0); this.projectileActive.fill(0); this.enemyFree.length = 0; this.projectileFree.length = 0;
    for (let i = MAX_ENEMIES - 1; i >= 0; i--) this.enemyFree.push(i);
    for (let i = MAX_PROJECTILES - 1; i >= 0; i--) this.projectileFree.push(i);
    this.towers.length = 0; for (const commander of this.commanders) { commander.hired = false; commander.cooldown = 0; } this.phase = 'intro'; this.wave = 0; this.health = 20; this.gold = 500; this.score = 0; this.kills = 0;
    this.enemyCount = 0; this.projectileCount = 0; this.spawnLeft = 0; this.spawnTimer = 0; this.spawning = false; this.benchmark = false; this.seed = 1;
  }
  snapshot(): GameSnapshot { return { phase: this.phase, wave: this.wave, health: this.health, gold: this.gold, score: this.score, kills: this.kills, enemies: this.enemyCount, projectiles: this.projectileCount, towers: this.towers.length, spawning: this.spawning, remaining: this.spawnLeft }; }
  startWave() {
    if (this.phase === 'gameover' || this.phase === 'victory' || this.spawning || this.enemyCount) return;
    this.phase = 'playing'; this.wave++; this.spawnLeft = 7 + this.wave * 3 + Math.floor(this.wave * this.wave / 7);
    if (this.wave % 10 === 0) this.spawnLeft++; this.spawning = true; this.spawnTimer = 0;
  }
  placeTower(kind: TowerKind, x: number, y: number): boolean {
    const s = towerStats[kind];
    if (this.gold < s.cost || this.towers.length >= 100 || !this.validPad(x, y)) return false;
    this.gold -= s.cost; this.towers.push({ x, y, kind, level: 1, cooldown: .15, spent: s.cost }); return true;
  }
  upgradeTower(index: number): boolean {
    const t = this.towers[index]; if (!t || t.level >= 3) return false;
    const cost = Math.round(towerStats[t.kind].cost * (.75 + t.level * .55)); if (this.gold < cost) return false;
    this.gold -= cost; t.spent += cost; t.level++; return true;
  }
  sellTower(index: number): boolean { const t = this.towers[index]; if (!t) return false; this.gold += Math.floor(t.spent * .6); this.towers.splice(index, 1); return true; }
  hireCommander(kind: CommanderKind): boolean { const c = this.commanders.find(item => item.kind === kind)!; const info = commanderInfo[kind]; if (c.hired || this.wave < info.wave || this.gold < info.cost) return false; this.gold -= info.cost; c.hired = true; c.cooldown = .2; return true; }
  validPad(x: number, y: number): boolean {
    if (x < 42 || y < 42 || x > WORLD_W - 42 || y > WORLD_H - 42) return false;
    let min = Infinity;
    for (let i = 0; i < segment.length; i++) {
      const ax = path[i][0], ay = path[i][1], bx = path[i + 1][0], by = path[i + 1][1]; const dx = bx - ax, dy = by - ay;
      const u = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
      min = Math.min(min, Math.hypot(x - ax - dx * u, y - ay - dy * u));
    }
    if (min < 62) return false;
    return !this.towers.some(t => Math.hypot(t.x - x, t.y - y) < 58);
  }
  setupBenchmark(naive: boolean, enemies = 5000, towers = 100, projectiles = 1000) {
    this.reset(); this.benchmark = true; this.naive = naive; this.phase = 'playing'; this.health = 9999; this.gold = 99999; this.wave = 50;
    const kinds: TowerKind[] = ['bolt', 'mortar', 'frost'];
    for (let i = 0; i < towers; i++) { const x = 110 + (i % 20) * 82; const y = i % 2 ? 130 + Math.floor(i / 20) * 135 : 740 - Math.floor(i / 20) * 105; this.towers.push({ x, y, kind: kinds[i % 3], level: 3, cooldown: (i % 9) * .04, spent: 500 }); }
    for (let i = 0; i < enemies; i++) this.spawnEnemy((i % 5) as EnemyKind, 40 + (i % 860));
    this.rebuildGrid();
    for (let i = 0; i < projectiles; i++) { const target = i % Math.max(1, enemies); this.spawnProjectile(700 + (i % 13) * 20, 350 + (i % 17) * 12, target, 9, 600, i % 3 === 1 ? 58 : 0, i % 3 === 2 ? .3 : 0, i % 3); }
  }
  update(dt: number) {
    if (this.phase !== 'playing') return;
    if (this.spawning) { this.spawnTimer -= dt; while (this.spawnLeft > 0 && this.spawnTimer <= 0) { this.spawnWaveEnemy(); this.spawnLeft--; this.spawnTimer += Math.max(.095, .38 - this.wave * .004); } if (!this.spawnLeft) this.spawning = false; }
    this.updateEnemies(dt); this.rebuildGrid(); this.updateTowers(dt); this.updateCommanders(dt); this.updateProjectiles(dt);
    if (!this.benchmark && !this.spawning && this.enemyCount === 0 && this.wave >= 50) this.phase = 'victory';
    if (this.health <= 0) this.phase = 'gameover';
  }
  private spawnWaveEnemy() {
    let kind: EnemyKind = 0; const r = this.random();
    if (this.wave % 10 === 0 && this.spawnLeft === 1) kind = 4;
    else if (this.wave > 7 && r > .83) kind = 3;
    else if (this.wave > 4 && r > .64) kind = 2;
    else if (this.wave > 2 && r > .42) kind = 1;
    this.spawnEnemy(kind, 0);
  }
  private spawnEnemy(kind: EnemyKind, initialDistance: number) {
    const id = this.enemyFree.pop(); if (id === undefined) return;
    const s = enemyStats[kind]; const scale = this.benchmark ? 1 : 1 + Math.max(0, this.wave - 1) * .115;
    this.enemyActive[id] = 1; this.enemyType[id] = kind; this.enemyDist[id] = initialDistance; this.enemyHp[id] = this.enemyMaxHp[id] = s.hp * scale;
    const [x, y] = pathPosition(initialDistance); this.enemyX[id] = x; this.enemyY[id] = y; this.enemySlow[id] = 0; this.enemySlowTime[id] = 0; this.enemyCount++;
  }
  private updateEnemies(dt: number) {
    for (let i = 0; i < MAX_ENEMIES; i++) if (this.enemyActive[i]) {
      const type = this.enemyType[i] as EnemyKind; const s = enemyStats[type];
      if (this.enemySlowTime[i] > 0) { this.enemySlowTime[i] -= dt; } else this.enemySlow[i] = 0;
      this.enemyDist[i] += s.speed * (1 - this.enemySlow[i]) * dt;
      if (this.enemyDist[i] >= PATH_LENGTH) { this.releaseEnemy(i); this.health -= s.base; continue; }
      const [x, y] = pathPosition(this.enemyDist[i]); this.enemyX[i] = x; this.enemyY[i] = y;
    }
  }
  private rebuildGrid() {
    this.cellHead.fill(-1);
    for (let i = 0; i < MAX_ENEMIES; i++) if (this.enemyActive[i]) { const c = Math.min(COLS - 1, Math.max(0, (this.enemyX[i] / CELL) | 0)); const r = Math.min(ROWS - 1, Math.max(0, (this.enemyY[i] / CELL) | 0)); const cell = r * COLS + c; this.nextInCell[i] = this.cellHead[cell]; this.cellHead[cell] = i; }
  }
  private updateTowers(dt: number) {
    for (const t of this.towers) { t.cooldown -= dt; if (t.cooldown > 0) continue; const s = towerStats[t.kind]; const target = this.findTarget(t.x, t.y, s.range); if (target < 0) continue;
      const mult = 1 + (t.level - 1) * .55; t.cooldown += s.reload / (1 + (t.level - 1) * .12); this.spawnProjectile(t.x, t.y, target, s.damage * mult, s.speed * (1 + (t.level - 1) * .08), s.splash * (1 + (t.level - 1) * .2), t.kind === 'frost' ? .36 + t.level * .05 : 0, t.kind === 'bolt' ? 0 : t.kind === 'mortar' ? 1 : 2); }
  }
  private updateCommanders(dt: number) { for (const c of this.commanders) if (c.hired) { const info = commanderInfo[c.kind]; c.cooldown -= dt; if (c.cooldown > 0) continue; const target = this.findTarget(c.x, c.y, info.range); if (target < 0) continue; c.cooldown += info.reload; this.spawnProjectile(c.x, c.y, target, info.damage, c.kind === 'warrior' ? 820 : 680, info.splash, 0, c.kind === 'engineer' ? 1 : 0); } }
  private findTarget(x: number, y: number, range: number): number {
    let best = -1; let farthest = -Infinity; const r2 = range * range;
    if (this.naive) { for (let i = 0; i < MAX_ENEMIES; i++) if (this.enemyActive[i]) { const dx = this.enemyX[i] - x, dy = this.enemyY[i] - y; if (dx * dx + dy * dy <= r2 && this.enemyDist[i] > farthest) { best = i; farthest = this.enemyDist[i]; } } return best; }
    const cx = (x / CELL) | 0, cy = (y / CELL) | 0, cr = Math.ceil(range / CELL);
    for (let yy = Math.max(0, cy - cr); yy <= Math.min(ROWS - 1, cy + cr); yy++) for (let xx = Math.max(0, cx - cr); xx <= Math.min(COLS - 1, cx + cr); xx++) for (let i = this.cellHead[yy * COLS + xx]; i >= 0; i = this.nextInCell[i]) { const dx = this.enemyX[i] - x, dy = this.enemyY[i] - y; if (dx * dx + dy * dy <= r2 && this.enemyDist[i] > farthest) { best = i; farthest = this.enemyDist[i]; } }
    return best;
  }
  private spawnProjectile(x: number, y: number, target: number, damage: number, speed: number, splash: number, slow: number, color: number) {
    const id = this.projectileFree.pop(); if (id === undefined) return; this.projectileActive[id] = 1; this.projectileX[id] = x; this.projectileY[id] = y; this.projectileTarget[id] = target; this.projectileDamage[id] = damage; this.projectileSpeed[id] = speed; this.projectileSplash[id] = splash; this.projectileSlow[id] = slow; this.projectileColor[id] = color; this.projectileCount++;
  }
  private updateProjectiles(dt: number) {
    for (let i = 0; i < MAX_PROJECTILES; i++) if (this.projectileActive[i]) { const target = this.projectileTarget[i]; if (!this.enemyActive[target]) { this.releaseProjectile(i); continue; } const dx = this.enemyX[target] - this.projectileX[i], dy = this.enemyY[target] - this.projectileY[i]; const d = Math.hypot(dx, dy); const travel = this.projectileSpeed[i] * dt;
      if (d <= travel + 8) { this.hit(target, this.projectileDamage[i], this.projectileSlow[i]); if (this.projectileSplash[i]) this.splash(this.enemyX[target], this.enemyY[target], this.projectileSplash[i], this.projectileDamage[i] * .65, this.projectileSlow[i]); this.releaseProjectile(i); } else { this.projectileX[i] += dx / d * travel; this.projectileY[i] += dy / d * travel; }
    }
  }
  private splash(x: number, y: number, radius: number, damage: number, slow: number) { const cx = (x / CELL) | 0, cy = (y / CELL) | 0, cr = Math.ceil(radius / CELL), r2 = radius * radius; for (let yy = Math.max(0, cy - cr); yy <= Math.min(ROWS - 1, cy + cr); yy++) for (let xx = Math.max(0, cx - cr); xx <= Math.min(COLS - 1, cx + cr); xx++) for (let i = this.cellHead[yy * COLS + xx]; i >= 0; i = this.nextInCell[i]) { const dx = this.enemyX[i] - x, dy = this.enemyY[i] - y; if (dx * dx + dy * dy <= r2) this.hit(i, damage, slow); } }
  private hit(id: number, damage: number, slow: number) { if (!this.enemyActive[id]) return; const s = enemyStats[this.enemyType[id] as EnemyKind]; const shielded = this.enemyType[id] === 3 && this.enemyHp[id] > this.enemyMaxHp[id] * .55; this.enemyHp[id] -= Math.max(1, damage - s.armor) * (shielded ? .55 : 1); if (slow) { this.enemySlow[id] = Math.max(this.enemySlow[id], slow); this.enemySlowTime[id] = Math.max(this.enemySlowTime[id], 1.25); } if (this.enemyHp[id] <= 0) { const kind = this.enemyType[id] as EnemyKind; this.gold += s.reward; this.score += Math.round(s.reward * 10); this.kills++; const dist = this.enemyDist[id]; this.releaseEnemy(id); if (kind === 2) { this.spawnEnemy(0, dist); this.spawnEnemy(0, dist); } } }
  private releaseEnemy(id: number) { if (!this.enemyActive[id]) return; this.enemyActive[id] = 0; this.enemyFree.push(id); this.enemyCount--; }
  private releaseProjectile(id: number) { this.projectileActive[id] = 0; this.projectileFree.push(id); this.projectileCount--; }
  private random() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296; }
}

export function getPath(): readonly (readonly number[])[] { return path; }
