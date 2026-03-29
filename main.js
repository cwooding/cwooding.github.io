import * as particles from './scenes/particles.js';
import * as deepSea from './scenes/deep-sea.js';
import * as voidRunner from './scenes/void-runner.js';

const SCENES = [particles, deepSea, voidRunner];

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const pointer = { x: -9999, y: -9999, down: false };

let current = 0;
let shakeCooldown = false;

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
window.addEventListener('mousedown', () => { pointer.down = true; });
window.addEventListener('mouseup', () => { pointer.down = false; });

// Pointer — touch
window.addEventListener('touchstart', e => {
  pointer.x = e.touches[0].clientX;
  pointer.y = e.touches[0].clientY;
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
