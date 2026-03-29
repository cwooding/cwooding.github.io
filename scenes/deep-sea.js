export const name = 'deep-sea';

const CONFIG = {
  planktonCount: 200,
  minPlankton: 100,
  maxPlankton: 400,
  planktonStep: 25,
  jellyfishMin: 8,
  jellyfishMax: 12,
  lanternfishMin: 15,
  lanternfishMax: 20,
  waveMaxRadius: 300,
  waveDuration: 800,
  jellyWaveRadius: 150,
  jellyWaveDuration: 400,
};

let _canvas, _ctx, _pointer;
let rafId = null;
let time = 0;
let lastTime = 0;

function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

function drawGlow(x, y, radius, r, g, b, intensity) {
  const grad = _ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(${r},${g},${b},${intensity})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  _ctx.fillStyle = grad;
  _ctx.beginPath();
  _ctx.arc(x, y, radius, 0, Math.PI * 2);
  _ctx.fill();
}

function animate(now) {
  const dt = lastTime ? Math.min(now - lastTime, 50) : 16;
  lastTime = now;
  time = now;

  _ctx.globalCompositeOperation = 'source-over';
  _ctx.fillStyle = '#030810';
  _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

  _ctx.globalCompositeOperation = 'lighter';

  // Organisms will be drawn here

  _ctx.globalCompositeOperation = 'source-over';
  rafId = requestAnimationFrame(animate);
}

export function init(canvas, ctx, pointer) {
  if (rafId !== null) cancelAnimationFrame(rafId);
  _canvas = canvas;
  _ctx = ctx;
  _pointer = pointer;
  lastTime = 0;
  rafId = requestAnimationFrame(animate);
}

export function destroy() {
  cancelAnimationFrame(rafId);
  rafId = null;
}

export function onKey(e) {}
