import * as particles from './scenes/particles.js';
import * as deepSea from './scenes/deep-sea.js';
import * as voidRunner from './scenes/void-runner.js';

const SCENES = [particles, deepSea, voidRunner];

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const pointer = { x: -9999, y: -9999, down: false };

let current = 0;
let shakeCooldown = false;

// Mobile scene-switch button (top-right corner)
const BTN = { size: 36, margin: 12 };
function btnX() { return canvas.width - BTN.size - BTN.margin; }
function btnY() { return BTN.margin; }

function drawSceneButton() {
  const x = btnX(), y = btnY(), s = BTN.size;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('M', x + s / 2, y + s / 2);
  ctx.restore();
}

function hitBtn(px, py) {
  const x = btnX(), y = btnY(), s = BTN.size;
  return px >= x && px <= x + s && py >= y && py <= y + s;
}

// Overlay the button after each frame
function onFrame() {
  drawSceneButton();
  requestAnimationFrame(onFrame);
}
requestAnimationFrame(onFrame);

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function nextScene() {
  SCENES[current].destroy();
  current = (current + 1) % SCENES.length;
  SCENES[current].init(canvas, ctx, pointer);
}

// Pointer — mouse
window.addEventListener('mousemove', e => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
});
window.addEventListener('mouseleave', () => {
  pointer.x = -9999;
  pointer.y = -9999;
  pointer.down = false;
});
window.addEventListener('mousedown', e => {
  if (hitBtn(e.clientX, e.clientY)) { nextScene(); return; }
  pointer.down = true;
});
window.addEventListener('mouseup', () => { pointer.down = false; });

// Pointer — touch
window.addEventListener('touchstart', e => {
  const tx = e.touches[0].clientX;
  const ty = e.touches[0].clientY;
  if (hitBtn(tx, ty)) { nextScene(); return; }
  pointer.x = tx;
  pointer.y = ty;
  pointer.down = true;
}, { passive: true });
window.addEventListener('touchmove', e => {
  pointer.x = e.touches[0].clientX;
  pointer.y = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchend', () => {
  pointer.x = -9999;
  pointer.y = -9999;
  pointer.down = false;
}, { passive: true });

// Scene switching — M key; forward other keys to current scene
window.addEventListener('keydown', e => {
  if (e.key === 'm' || e.key === 'M') {
    nextScene();
  } else {
    SCENES[current].onKey?.(e);
  }
});
window.addEventListener('keyup', e => {
  SCENES[current].onKey?.(e);
});

// Scene switching — shake
window.addEventListener('devicemotion', e => {
  if (shakeCooldown) return;
  const a = e.accelerationIncludingGravity;
  if (!a) return;
  const mag = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
  if (mag > 15) {
    nextScene();
    shakeCooldown = true;
    setTimeout(() => { shakeCooldown = false; }, 1000);
  }
});

// Canvas resize — reinitialize current scene at new dimensions
window.addEventListener('resize', () => {
  SCENES[current].destroy();
  resize();
  SCENES[current].init(canvas, ctx, pointer);
});

// Boot
resize();
SCENES[current].init(canvas, ctx, pointer);
