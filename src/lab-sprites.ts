import { Engine, WORLD_H, WORLD_W } from './engine';

const TILE = 128;
const ATLAS = TILE * 8;
const ENEMY_SHEETS = [
  { cell: 192, x: 24, y: 45, w: 144, h: 110 },
  { cell: 128, x: 16, y: 22, w: 96, h: 88 },
  { cell: 192, x: 24, y: 45, w: 144, h: 110 },
  { cell: 192, x: 24, y: 35, w: 144, h: 120 },
  { cell: 192, x: 24, y: 38, w: 144, h: 116 },
] as const;

const vertex = `#version 300 es
layout(location=0) in vec2 corner;
layout(location=1) in vec4 positionSize;
layout(location=2) in vec2 tileAngle;
uniform vec2 world;
out vec2 uv;
void main() {
  float a=tileAngle.y;
  vec2 p=corner*positionSize.zw;
  p=vec2(p.x*cos(a)-p.y*sin(a),p.x*sin(a)+p.y*cos(a));
  p+=positionSize.xy;
  gl_Position=vec4(p.x/world.x*2.0-1.0,1.0-p.y/world.y*2.0,0.0,1.0);
  uv=vec2((mod(tileAngle.x,8.0)+(corner.x+1.0)*0.5)/8.0,
          1.0-(floor(tileAngle.x/8.0)+(corner.y+1.0)*0.5)/8.0);
}`;
const fragment = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D atlas;
out vec4 color;
void main() { color=texture(atlas,uv); if(color.a<0.08) discard; }`;

function shader(gl: WebGL2RenderingContext, type: number, source: string) {
  const result = gl.createShader(type)!;
  gl.shaderSource(result, source);
  gl.compileShader(result);
  if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result) ?? 'sprite shader error');
  return result;
}

export class LabSprites {
  readonly atlas = document.createElement('canvas');
  ready = false;
  private program: WebGLProgram | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private buffer: WebGLBuffer | null = null;
  private texture: WebGLTexture | null = null;
  private instances = new Float32Array(9000 * 6);
  private count = 0;

  constructor(private gl: WebGL2RenderingContext | null) {
    this.atlas.width = this.atlas.height = ATLAS;
    if (!gl) return;
    const program = gl.createProgram()!;
    gl.attachShader(program, shader(gl, gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, shader(gl, gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'sprite program error');
    this.program = program;
    this.vao = gl.createVertexArray();
    this.buffer = gl.createBuffer();
    this.texture = gl.createTexture();
    gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.instances.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 0);
    gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 24, 16);
    gl.vertexAttribDivisor(2, 1);
    gl.bindVertexArray(null);
  }

  build(art: Record<string, HTMLImageElement>, enemies: HTMLImageElement[]) {
    if (this.ready || enemies.length < 5 || enemies.some(image => !image.complete || !image.naturalWidth)) return;
    if (['arrow', 'explosion'].some(key => !art[key]?.complete || !art[key].naturalWidth)) return;
    const ctx = this.atlas.getContext('2d')!;
    ctx.clearRect(0, 0, ATLAS, ATLAS);
    ctx.imageSmoothingEnabled = false;
    for (let type = 0; type < 5; type++) {
      const sheet = ENEMY_SHEETS[type];
      for (let frame = 0; frame < 4; frame++) {
        const slot = type * 4 + frame, x = slot % 8 * TILE, y = Math.floor(slot / 8) * TILE;
        ctx.drawImage(enemies[type], frame * sheet.cell + sheet.x, sheet.y, sheet.w, sheet.h, x + 8, y + 14, 112, 100);
      }
    }
    ctx.drawImage(art.arrow, 0, 22, 64, 28, 20 % 8 * TILE + 4, Math.floor(20 / 8) * TILE + 44, 120, 40);
    ctx.drawImage(art.explosion, 0, 0, 192, 192, 21 % 8 * TILE + 4, Math.floor(21 / 8) * TILE + 4, 120, 120);
    const frostX = 22 % 8 * TILE, frostY = Math.floor(22 / 8) * TILE;
    ctx.drawImage(art.arrow, 0, 22, 64, 28, frostX + 4, frostY + 44, 120, 40);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#78d8e8';
    ctx.fillRect(frostX, frostY, TILE, TILE);
    ctx.globalCompositeOperation = 'source-over';
    if (this.gl) {
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    this.ready = true;
  }

  private emit(x: number, y: number, w: number, h: number, slot: number, angle = 0) {
    if (this.count >= 9000 || x < -w || y < -h || x > WORLD_W + w || y > WORLD_H + h) return;
    const offset = this.count++ * 6;
    this.instances[offset] = x;
    this.instances[offset + 1] = y;
    this.instances[offset + 2] = w / 2;
    this.instances[offset + 3] = h / 2;
    this.instances[offset + 4] = slot;
    this.instances[offset + 5] = angle;
  }

  drawGL(engine: Engine, width: number, height: number) {
    if (!this.ready || !this.gl) return;
    this.count = 0;
    const tick = Math.floor(performance.now() / 120);
    for (let i = 0; i < engine.enemyActive.length; i++) if (engine.enemyActive[i]) {
      this.emit(engine.enemyX[i], engine.enemyY[i] - 20, 64, 60, engine.enemyType[i] * 4 + ((tick + i) & 3));
    }
    for (let i = 0; i < engine.projectileActive.length; i++) if (engine.projectileActive[i]) {
      const kind = engine.projectileColor[i], target = engine.projectileTarget[i];
      const angle = kind === 1 ? 0 : Math.atan2(engine.enemyY[target] - engine.projectileY[i], engine.enemyX[target] - engine.projectileX[i]);
      this.emit(engine.projectileX[i], engine.projectileY[i], kind === 1 ? 26 : 34, kind === 1 ? 26 : 14, 20 + kind, angle);
    }
    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    gl.uniform2f(gl.getUniformLocation(this.program!, 'world'), WORLD_W, WORLD_H);
    gl.uniform1i(gl.getUniformLocation(this.program!, 'atlas'), 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.instances.subarray(0, this.count * 6));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count);
    gl.bindVertexArray(null);
  }

  drawCanvas(ctx: CanvasRenderingContext2D, engine: Engine, width: number, height: number) {
    if (!this.ready) return;
    const sx = width / WORLD_W, sy = height / WORLD_H, tick = Math.floor(performance.now() / 120);
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < engine.enemyActive.length; i++) if (engine.enemyActive[i]) {
      const slot = engine.enemyType[i] * 4 + ((tick + i) & 3);
      ctx.drawImage(this.atlas, slot % 8 * TILE, Math.floor(slot / 8) * TILE, TILE, TILE, (engine.enemyX[i] - 32) * sx, (engine.enemyY[i] - 50) * sy, 64 * sx, 60 * sy);
    }
    for (let i = 0; i < engine.projectileActive.length; i++) if (engine.projectileActive[i]) {
      const slot = 20 + engine.projectileColor[i], w = slot === 21 ? 26 : 34, h = slot === 21 ? 26 : 14;
      const x = engine.projectileX[i] * sx, y = engine.projectileY[i] * sy;
      ctx.save();
      ctx.translate(x, y);
      if (slot !== 21) { const target = engine.projectileTarget[i]; ctx.rotate(Math.atan2(engine.enemyY[target] - engine.projectileY[i], engine.enemyX[target] - engine.projectileX[i])); }
      ctx.drawImage(this.atlas, slot % 8 * TILE, Math.floor(slot / 8) * TILE, TILE, TILE, -w * sx / 2, -h * sy / 2, w * sx, h * sy);
      ctx.restore();
    }
  }
}
