import { Engine, WORLD_H, WORLD_W, enemyInfo, getPath, towerInfo, type TowerKind } from './engine';

const vs = `#version 300 es
layout(location=0) in vec2 corner; layout(location=1) in vec3 posSize; layout(location=2) in vec4 colorKind;
uniform vec2 world; out vec2 vCorner; out vec4 vColor; flat out float vKind;
void main(){ vec2 p=posSize.xy+corner*posSize.z; gl_Position=vec4(p.x/world.x*2.0-1.0,1.0-p.y/world.y*2.0,0,1); vCorner=corner; vColor=vec4(colorKind.rgb/255.0, colorKind.a); vKind=colorKind.w; }`;
const fs = `#version 300 es
precision mediump float; in vec2 vCorner; in vec4 vColor; flat in float vKind; out vec4 outColor;
void main(){ float d=length(vCorner); if(vKind<.5 && d>1.0) discard; if(vKind>.5 && vKind<1.5 && abs(vCorner.x)+abs(vCorner.y)>1.15) discard; if(vKind>1.5 && max(abs(vCorner.x),abs(vCorner.y))>.78) discard; outColor=vColor; }`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) { const s = gl.createShader(type)!; gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error'); return s; }

export class Renderer {
  private gl: WebGL2RenderingContext | null; private program: WebGLProgram | null = null; private vao: WebGLVertexArrayObject | null = null; private buffer: WebGLBuffer | null = null;
  private data = new Float32Array(9000 * 8); private count = 0; private fallback: CanvasRenderingContext2D | null = null; private baselineCtx!: CanvasRenderingContext2D;
  private chapter = -1; private terrainWave = -1; private art: Record<string, HTMLImageElement> = {};
  private spriteCtx: CanvasRenderingContext2D; private enemySpriteArt: HTMLImageElement[] = [];
  constructor(private canvas: HTMLCanvasElement, private map: HTMLCanvasElement, private sprites: HTMLCanvasElement, private baseline: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true });
    if (this.gl) this.setup(); else this.fallback = canvas.getContext('2d');
    this.spriteCtx = sprites.getContext('2d')!; new ResizeObserver(() => this.resize()).observe(canvas.parentElement!); this.loadArt(); this.resize();
  }
  private loadArt() { for (const [key, file] of Object.entries({ flat:'Tilemap_Flat.png', elevation:'Tilemap_Elevation.png', bridge:'Bridge_All.png', water:'Water.png', tree:'Tree.png', castle:'Castle_Blue.png', tower:'Tower_Blue.png', fire:'Fire.png', arrow:'Arrow.png', explosion:'Explosions.png', archer:'Archer_Blue.png', archerBody:'Archer_Blue_NoArms.png', archerBow:'Archer_Bow_Blue.png', longbowIdle:'defender-longbow-ready.png', pawn:'Pawn_Blue.png', warrior:'Warrior_Blue.png' })) { const image = new Image(); image.src = `/assets/${file}`; image.onload = () => this.drawMap(); this.art[key] = image; } for(const file of ['enemy-torch-walk.png','enemy-barrel-walk.png','enemy-tnt-walk.png','enemy-warrior-walk.png','enemy-archer-walk.png']) { const image = new Image(); image.src=`/assets/${file}`; this.enemySpriteArt.push(image); } }
  private setChapter(wave: number) { const next = Math.min(4, Math.floor(Math.max(0, wave - 1) / 10)); if (next !== this.chapter || wave !== this.terrainWave) { this.chapter = next; this.terrainWave = wave; this.drawMap(); } }
  get accelerated() { return !!this.gl; }
  private setup() { const gl = this.gl!; const p = gl.createProgram()!; gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error'); this.program = p;
    this.vao = gl.createVertexArray(); this.buffer = gl.createBuffer(); gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW); const stride = 8 * 4;
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 3 * 4); gl.vertexAttribDivisor(2, 1); gl.bindVertexArray(null);
  }
  private resize() { const rect = this.canvas.parentElement!.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2); const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr)); if (this.canvas.width === w && this.canvas.height === h) return; this.canvas.width = this.map.width = this.sprites.width = this.baseline.width = w; this.canvas.height = this.map.height = this.sprites.height = this.baseline.height = h; this.drawMap(); }
  private drawMap() { const c = this.map.getContext('2d')!; const w = this.map.width, h = this.map.height, wave = Math.max(0, this.terrainWave), chapterStep = wave % 10; c.clearRect(0, 0, w, h); const tone = ['#638d69','#54777b','#6c5d55','#466e80','#775548'][Math.max(0,this.chapter)]; c.fillStyle = tone; c.fillRect(0, 0, w, h); c.save(); c.scale(w / WORLD_W, h / WORLD_H); c.imageSmoothingEnabled = false;
    const flat = this.art.flat, elevation = this.art.elevation, water = this.art.water; if (flat?.complete) { for (let x=0;x<WORLD_W;x+=128) for(let y=0;y<WORLD_H;y+=128) c.drawImage(flat, 0, 0, 128, 128, x, y, 128, 128); } if (water?.complete && this.chapter >= 1) { for (let x=0;x<640;x+=64) c.drawImage(water, x, 690, 64, 64); }
    for (let x = 45; x < WORLD_W; x += 105) for (let y = 35; y < WORLD_H; y += 95) { c.fillStyle = `rgba(112,164,96,${.045 + ((x * 11 + y * 7 + wave * 13) % 9) * .009})`; c.beginPath(); c.arc(x + ((y / 7 + wave * 3) % 18), y, 42, 0, Math.PI * 2); c.fill(); }
    const p = getPath(), castle = p[p.length - 1], castleX = Math.max(0, castle[0] - 238), castleY = Math.max(50, Math.min(WORLD_H - 210, castle[1] - 96)); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#27343b'; c.lineWidth = 132; c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]); c.stroke(); c.strokeStyle = this.chapter >= 2 ? '#765544' : '#a77b4d'; c.lineWidth = 86; c.stroke(); c.strokeStyle = 'rgba(255,234,175,.22)'; c.lineWidth = 3; c.setLineDash([10, 14]); c.stroke(); c.setLineDash([]);
    if (elevation?.complete) { for (let x=0;x<WORLD_W;x+=256) c.drawImage(elevation, 0, 0, 256, 220, x, 0, 256, 220); c.drawImage(elevation, 0, 0, 256, 220, 1450, 610, 256, 220); } if (this.art.bridge?.complete) c.drawImage(this.art.bridge, 0, 0, 192, 256, 915, 400, 170, 120); if(this.art.tree?.complete) for(let i=0;i<9+Math.floor(chapterStep/3);i++) c.drawImage(this.art.tree,0,0,128,128,40+i*185,90+((i+wave)%3)*190,92,92); if(this.art.castle?.complete) c.drawImage(this.art.castle,0,0,320,256,castleX,castleY,240,192); if(this.art.tower?.complete) { c.drawImage(this.art.tower,0,0,128,256,1330,150,96,192); c.drawImage(this.art.tower,0,0,128,256,1450,125,96,192); } if(this.art.fire?.complete && this.chapter>=2) c.drawImage(this.art.fire,0,0,128,128,castleX+58,castleY+122,80,80);
    if (wave > 1) { c.globalAlpha = .05 + chapterStep * .012; c.fillStyle = this.chapter >= 2 ? '#321f1b' : '#d1b55d'; for (let i=0;i<7+chapterStep;i++) { const x = (i * 241 + wave * 97) % WORLD_W, y = 155 + ((i * 167 + wave * 53) % 610); c.fillRect(x, y, 34 + (i % 3) * 12, 3); } c.globalAlpha = 1; }
    const g = c.createRadialGradient(castle[0], castle[1], 3, castle[0], castle[1], 130); g.addColorStop(0, 'rgba(246,202,90,.9)'); g.addColorStop(.25, 'rgba(235,144,68,.4)'); g.addColorStop(1, 'rgba(235,144,68,0)'); c.fillStyle = g; c.beginPath(); c.arc(castle[0], castle[1], 130, 0, Math.PI * 2); c.fill(); c.restore(); }
  private emit(x: number, y: number, size: number, rgb: readonly number[], kind: number, alpha = 1) { if (this.count >= 9000) return; const o = this.count++ * 8; const d = this.data; d[o] = x; d[o + 1] = y; d[o + 2] = size; d[o + 3] = rgb[0]; d[o + 4] = rgb[1]; d[o + 5] = rgb[2]; d[o + 6] = alpha; d[o + 7] = kind; }
  render(engine: Engine, selected = -1, preview?: { kind: TowerKind; x: number; y: number; valid: boolean }, naive = false) {
    this.setChapter(engine.wave);
    this.count = 0;
    const simplified = engine.enemyCount > 360 || engine.projectileCount > 600;
    // Normal combat is sprite-only. Geometry is reserved for the extreme-load fallback.
    if (simplified) {
      for (let i = 0; i < engine.enemyActive.length; i++) if (engine.enemyActive[i]) { const info = enemyInfo[engine.enemyType[i] as 0|1|2|3|4]; this.emit(engine.enemyX[i], engine.enemyY[i], info.size, info.color, 0); }
      for (let i = 0; i < engine.projectileActive.length; i++) if (engine.projectileActive[i]) { const col = engine.projectileColor[i] === 0 ? [245, 204, 92] : engine.projectileColor[i] === 1 ? [240, 109, 69] : [120, 216, 232]; this.emit(engine.projectileX[i], engine.projectileY[i], 5, col, 0); }
    }
    if (preview) { this.emit(preview.x, preview.y, towerInfo[preview.kind].range, preview.valid ? [134, 209, 149] : [237, 91, 80], 2, .11); this.emit(preview.x, preview.y, 25, towerInfo[preview.kind].color, 1, preview.valid ? .8 : .3); }
    if (naive) { this.canvas.style.opacity = '0'; this.sprites.style.opacity='0'; this.baseline.style.opacity = '1'; this.drawNaive(engine); }
    else { this.canvas.style.opacity = '1'; this.sprites.style.opacity='1'; this.baseline.style.opacity = '0'; if (this.gl) this.drawGL(); else this.drawFallback(engine); this.drawSprites(engine); }
  }
  private drawGL() { const gl = this.gl!; gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(this.program); gl.uniform2f(gl.getUniformLocation(this.program!, 'world'), WORLD_W, WORLD_H); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.count * 8)); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count); gl.bindVertexArray(null); }
  private drawFallback(engine: Engine) { const c = this.fallback!; c.clearRect(0, 0, this.canvas.width, this.canvas.height); const sx = this.canvas.width / WORLD_W, sy = this.canvas.height / WORLD_H; for (let i = 0; i < this.count; i++) { const o = i * 8, d = this.data; c.globalAlpha = d[o+6]; c.fillStyle = `rgb(${d[o+3]},${d[o+4]},${d[o+5]})`; c.beginPath(); c.arc(d[o]*sx, d[o+1]*sy, d[o+2]*sx, 0, Math.PI*2); c.fill(); } c.globalAlpha = 1; }
  private drawSprites(engine: Engine) {
    const c = this.spriteCtx, sx = this.sprites.width / WORLD_W, sy = this.sprites.height / WORLD_H;
    const tick = Math.floor(performance.now() / 90);
    c.clearRect(0, 0, this.sprites.width, this.sprites.height);
    c.imageSmoothingEnabled = false;

    // Effects are pooled by the engine and expire at the fixed simulation rate.
    const explosion = this.art.explosion;
    for (let i = 0; i < engine.effectActive.length; i++) if (engine.effectActive[i]) {
      const life = engine.effectLife[i] / engine.effectDuration[i], progress = 1 - life;
      const x = engine.effectX[i] * sx, y = engine.effectY[i] * sy, kind = engine.effectKind[i];
      if ((kind === 1 || kind === 3) && explosion?.complete) {
        const frame = Math.min(8, Math.floor(progress * 9)); const size = kind === 1 ? 74 : 54;
        c.globalAlpha = Math.min(1, life * 2.3); c.drawImage(explosion, frame * 192, 0, 192, 192, x - size / 2, y - size / 2, size, size);
      } else if (kind === 2) {
        const radius = 10 + progress * 18; c.globalAlpha = life; c.strokeStyle = '#8de8ff'; c.lineWidth = 3;
        c.beginPath(); c.arc(x, y, radius, 0, Math.PI * 2); c.stroke();
      } else {
        const radius = 7 + progress * 9; c.globalAlpha = life; c.strokeStyle = '#ffe4a6'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(x - radius, y); c.lineTo(x + radius, y); c.moveTo(x, y - radius); c.lineTo(x, y + radius); c.stroke();
      }
    }
    c.globalAlpha = 1;

    const crew: Record<TowerKind, { image: string; cellW: number; idleRow: number; attackRow: number; insetX: number; insetY: number; width: number; height: number; drawW: number; drawH: number; trim: string }> = {
      bolt: { image: 'archer', cellW: 256, idleRow: 0, attackRow: 3, insetX: 42, insetY: 40, width: 172, height: 118, drawW: 96, drawH: 85, trim: '#f5c451' },
      mortar: { image: 'pawn', cellW: 192, idleRow: 0, attackRow: 3, insetX: 24, insetY: 40, width: 144, height: 116, drawW: 86, drawH: 77, trim: '#f06d45' },
      frost: { image: 'warrior', cellW: 192, idleRow: 0, attackRow: 2, insetX: 24, insetY: 32, width: 144, height: 126, drawW: 91, drawH: 81, trim: '#78d8e8' },
    };
    for (let i = 0; i < engine.towers.length; i++) {
      const tower = engine.towers[i], spec = crew[tower.kind], image = this.art[spec.image], x = tower.x * sx, y = tower.y * sy;
      if (!image?.complete) continue;
      const attacking = tower.attackTime > 0;
      if (tower.kind === 'bolt' && !attacking && this.art.longbowIdle?.complete) {
        c.drawImage(this.art.longbowIdle, 0, 0, 192, 191, x - spec.drawW / 2, y - spec.drawH, spec.drawW, spec.drawH);
        continue;
      }
      if (tower.kind === 'bolt' && this.art.archerBody?.complete && this.art.archerBow?.complete) {
        const frame = Math.min(3, Math.floor((.28 - tower.attackTime) / .07));
        c.drawImage(this.art.archerBody, frame * 192, 0, 192, 192, x - 48, y - 96, 96, 96);
        c.drawImage(this.art.archerBow, (frame + 1) * 192, 192, 192, 192, x - 48, y - 96, 96, 96);
        continue;
      }
      // Fallback only if the composed Archer art cannot load.
      const frame = !attacking ? 0 : tower.kind === 'bolt'
        ? 1 + Math.min(3, Math.floor((.28 - tower.attackTime) / .07))
        : Math.min(5, Math.floor(((tower.kind === 'mortar' ? .38 : .28) - tower.attackTime) * 14));
      const row = attacking ? spec.attackRow : spec.idleRow;
      c.drawImage(image, frame * spec.cellW + spec.insetX, row * 192 + spec.insetY, spec.width, spec.height, x - spec.drawW / 2, y - spec.drawH, spec.drawW, spec.drawH);
    }

    const drawProjectiles = engine.projectileCount <= 600;
    if (drawProjectiles) for (let i = 0; i < engine.projectileActive.length; i++) if (engine.projectileActive[i]) {
      const x = engine.projectileX[i] * sx, y = engine.projectileY[i] * sy, kind = engine.projectileColor[i];
      if (kind === 0 && this.art.arrow?.complete) {
        const target = engine.projectileTarget[i], dx = engine.enemyActive[target] ? engine.enemyX[target] * sx - x : 1, dy = engine.enemyActive[target] ? engine.enemyY[target] * sy - y : 0;
        c.save(); c.translate(x, y); c.rotate(Math.atan2(dy, dx) + Math.PI / 2); c.drawImage(this.art.arrow, 0, 0, 64, 128, -7, -16, 14, 28); c.restore();
      } else if (kind === 1 && explosion?.complete) {
        c.drawImage(explosion, 0, 0, 192, 192, x - 10, y - 10, 20, 20);
      } else {
        c.strokeStyle = '#8de8ff'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.stroke();
      }
    }

    if (engine.enemyCount > 360) return;
    const sheets = [
      { cellW: 192, cellH: 192, frames: 7, insetX: 24, insetY: 45, width: 144, height: 110, drawW: 76, drawH: 64 },
      { cellW: 128, cellH: 128, frames: 6, insetX: 16, insetY: 22, width: 96, height: 88, drawW: 70, drawH: 64 },
      { cellW: 192, cellH: 192, frames: 7, insetX: 24, insetY: 45, width: 144, height: 110, drawW: 76, drawH: 64 },
      { cellW: 192, cellH: 192, frames: 6, insetX: 24, insetY: 35, width: 144, height: 120, drawW: 76, drawH: 66 },
      { cellW: 192, cellH: 192, frames: 8, insetX: 24, insetY: 38, width: 144, height: 116, drawW: 76, drawH: 65 },
    ];
    for (let i = 0; i < engine.enemyActive.length; i++) if (engine.enemyActive[i]) {
      const type = engine.enemyType[i] as number, image = this.enemySpriteArt[type] ?? this.enemySpriteArt[0], sheet = sheets[type] ?? sheets[0];
      if (!image?.complete) continue;
      const frame = (tick + i % sheet.frames) % sheet.frames;
      c.drawImage(image, frame * sheet.cellW + sheet.insetX, sheet.insetY, sheet.width, sheet.height, engine.enemyX[i] * sx - sheet.drawW / 2, engine.enemyY[i] * sy - sheet.drawH * .72, sheet.drawW, sheet.drawH);
    }
  }
  private drawNaive(engine: Engine) { const c = this.baselineCtx ?? (this.baselineCtx = this.baseline.getContext('2d')!); const sx = this.baseline.width / WORLD_W, sy = this.baseline.height / WORLD_H; c.clearRect(0,0,this.baseline.width,this.baseline.height); for (let i=0;i<engine.enemyActive.length;i++) if(engine.enemyActive[i]) { const inf=enemyInfo[engine.enemyType[i] as 0|1|2|3|4]; c.save(); c.translate(engine.enemyX[i]*sx,engine.enemyY[i]*sy); c.rotate(i*.017); c.fillStyle=`rgb(${inf.color.join(',')})`; c.beginPath(); c.arc(0,0,inf.size*sx,0,Math.PI*2); c.fill(); c.restore(); } for(let i=0;i<engine.projectileActive.length;i++) if(engine.projectileActive[i]) { c.fillStyle=engine.projectileColor[i]===1?'#f06d45':engine.projectileColor[i]===2?'#78d8e8':'#f5c451'; c.fillRect(engine.projectileX[i]*sx-2,engine.projectileY[i]*sy-2,5,5); } }
}
