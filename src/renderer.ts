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
  constructor(private canvas: HTMLCanvasElement, private map: HTMLCanvasElement, private baseline: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true });
    if (this.gl) this.setup(); else this.fallback = canvas.getContext('2d');
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement!); this.resize();
  }
  get accelerated() { return !!this.gl; }
  private setup() { const gl = this.gl!; const p = gl.createProgram()!; gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error'); this.program = p;
    this.vao = gl.createVertexArray(); this.buffer = gl.createBuffer(); gl.bindVertexArray(this.vao);
    const quad = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW); const stride = 8 * 4;
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 0); gl.vertexAttribDivisor(1, 1);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, stride, 3 * 4); gl.vertexAttribDivisor(2, 1); gl.bindVertexArray(null);
  }
  private resize() { const rect = this.canvas.parentElement!.getBoundingClientRect(); const dpr = Math.min(devicePixelRatio || 1, 2); const w = Math.max(1, Math.round(rect.width * dpr)), h = Math.max(1, Math.round(rect.height * dpr)); if (this.canvas.width === w && this.canvas.height === h) return; this.canvas.width = this.map.width = this.baseline.width = w; this.canvas.height = this.map.height = this.baseline.height = h; this.drawMap(); }
  private drawMap() { const c = this.map.getContext('2d')!; const w = this.map.width, h = this.map.height; c.clearRect(0, 0, w, h); const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#1b3540'); bg.addColorStop(.56, '#172d2b'); bg.addColorStop(1, '#101b24'); c.fillStyle = bg; c.fillRect(0, 0, w, h); c.save(); c.scale(w / WORLD_W, h / WORLD_H);
    for (let x = 45; x < WORLD_W; x += 105) for (let y = 35; y < WORLD_H; y += 95) { c.fillStyle = `rgba(112,164,96,${.055 + ((x * 11 + y * 7) % 9) * .008})`; c.beginPath(); c.arc(x + ((y / 7) % 18), y, 42, 0, Math.PI * 2); c.fill(); }
    const p = getPath(); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#152429'; c.lineWidth = 112; c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]); c.stroke(); c.strokeStyle = '#7a6548'; c.lineWidth = 82; c.stroke(); c.strokeStyle = 'rgba(242,205,128,.28)'; c.lineWidth = 3; c.setLineDash([10, 14]); c.stroke(); c.setLineDash([]);
    const g = c.createRadialGradient(1735, 450, 3, 1735, 450, 130); g.addColorStop(0, 'rgba(246,202,90,.9)'); g.addColorStop(.25, 'rgba(235,144,68,.4)'); g.addColorStop(1, 'rgba(235,144,68,0)'); c.fillStyle = g; c.beginPath(); c.arc(1735, 450, 130, 0, Math.PI * 2); c.fill(); c.fillStyle = '#f1cb63'; c.beginPath(); c.arc(1735, 450, 27, 0, Math.PI * 2); c.fill(); c.fillStyle = '#25384a'; c.fillRect(1711, 426, 48, 48); c.restore(); }
  private emit(x: number, y: number, size: number, rgb: readonly number[], kind: number, alpha = 1) { if (this.count >= 9000) return; const o = this.count++ * 8; const d = this.data; d[o] = x; d[o + 1] = y; d[o + 2] = size; d[o + 3] = rgb[0]; d[o + 4] = rgb[1]; d[o + 5] = rgb[2]; d[o + 6] = alpha; d[o + 7] = kind; }
  render(engine: Engine, selected = -1, preview?: { kind: TowerKind; x: number; y: number; valid: boolean }, naive = false) {
    this.count = 0;
    for (const t of engine.towers) { const col = towerInfo[t.kind].color; this.emit(t.x, t.y, 22 + t.level * 3, col, 1); this.emit(t.x, t.y, 10 + t.level * 2, [245, 231, 184], 0, .9); }
    for (let i = 0; i < engine.enemyActive.length; i++) if (engine.enemyActive[i]) { const info = enemyInfo[engine.enemyType[i] as 0|1|2|3|4]; this.emit(engine.enemyX[i], engine.enemyY[i], info.size, info.color, 0); }
    for (let i = 0; i < engine.projectileActive.length; i++) if (engine.projectileActive[i]) { const col = engine.projectileColor[i] === 0 ? [245, 204, 92] : engine.projectileColor[i] === 1 ? [240, 109, 69] : [120, 216, 232]; this.emit(engine.projectileX[i], engine.projectileY[i], 5, col, 0); }
    if (preview) { this.emit(preview.x, preview.y, towerInfo[preview.kind].range, preview.valid ? [134, 209, 149] : [237, 91, 80], 2, .11); this.emit(preview.x, preview.y, 25, towerInfo[preview.kind].color, 1, preview.valid ? .8 : .3); }
    if (naive) { this.canvas.style.opacity = '0'; this.baseline.style.opacity = '1'; this.drawNaive(engine); }
    else { this.canvas.style.opacity = '1'; this.baseline.style.opacity = '0'; if (this.gl) this.drawGL(); else this.drawFallback(engine); }
  }
  private drawGL() { const gl = this.gl!; gl.viewport(0, 0, this.canvas.width, this.canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(this.program); gl.uniform2f(gl.getUniformLocation(this.program!, 'world'), WORLD_W, WORLD_H); gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.count * 8)); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.count); gl.bindVertexArray(null); }
  private drawFallback(engine: Engine) { const c = this.fallback!; c.clearRect(0, 0, this.canvas.width, this.canvas.height); const sx = this.canvas.width / WORLD_W, sy = this.canvas.height / WORLD_H; for (let i = 0; i < this.count; i++) { const o = i * 8, d = this.data; c.globalAlpha = d[o+6]; c.fillStyle = `rgb(${d[o+3]},${d[o+4]},${d[o+5]})`; c.beginPath(); c.arc(d[o]*sx, d[o+1]*sy, d[o+2]*sx, 0, Math.PI*2); c.fill(); } c.globalAlpha = 1; }
  private drawNaive(engine: Engine) { const c = this.baselineCtx ?? (this.baselineCtx = this.baseline.getContext('2d')!); const sx = this.baseline.width / WORLD_W, sy = this.baseline.height / WORLD_H; c.clearRect(0,0,this.baseline.width,this.baseline.height); for (let i=0;i<engine.enemyActive.length;i++) if(engine.enemyActive[i]) { const inf=enemyInfo[engine.enemyType[i] as 0|1|2|3|4]; c.save(); c.translate(engine.enemyX[i]*sx,engine.enemyY[i]*sy); c.rotate(i*.017); c.fillStyle=`rgb(${inf.color.join(',')})`; c.beginPath(); c.arc(0,0,inf.size*sx,0,Math.PI*2); c.fill(); c.restore(); } for(let i=0;i<engine.projectileActive.length;i++) if(engine.projectileActive[i]) { c.fillStyle=engine.projectileColor[i]===1?'#f06d45':engine.projectileColor[i]===2?'#78d8e8':'#f5c451'; c.fillRect(engine.projectileX[i]*sx-2,engine.projectileY[i]*sy-2,5,5); } }
}
