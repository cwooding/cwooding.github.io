# Scene System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the monolithic `index.html` into a modular scene system with `main.js` owning all input/canvas, each scene in its own file, with mobile touch support and shake-to-switch.

**Architecture:** `index.html` becomes a 10-line shell. `main.js` owns the canvas, a shared `pointer` object (updated by mouse + touch), scene switching (M key + shake), and resize. Each scene exports `name`, `init(canvas, ctx, pointer)`, `destroy()`, and optionally `onKey(e)` for scene-specific keyboard controls. The existing particle code moves to `scenes/particles.js` with the local `mouse` variable replaced by the shared `pointer`.

**Tech Stack:** Vanilla JS ES modules (`type="module"`), HTML5 Canvas, DeviceMotionEvent for shake. No build tools.

**Important:** ES modules require HTTP (not `file://`). Test by pushing to GitHub Pages or running a local server (`python3 -m http.server 8080` in the repo directory, then open `http://localhost:8080`).

---

### Task 1: Create `scenes/particles.js`

**Files:**
- Create: `scenes/particles.js`

- [ ] **Step 1: Create `scenes/particles.js`**

```js
export const name = 'particles';

const CONFIG = {
  count: 250,
  minCount: 100,
  maxCount: 500,
  step: 25,
  connectDist: 120,
  mouseDist: 150,
  mouseForce: 0.3,
  speed: 0.5,
};

let _canvas, _ctx, _pointer;
let particles = [];
let rafId = null;

function particleColor() {
  const t = Math.random();
  const r = Math.round(123 + t * (79 - 123));
  const g = Math.round(94 + t * (195 - 94));
  const b = Math.round(167 + t * (247 - 167));
  return `rgb(${r},${g},${b})`;
}

class Particle {
  constructor() {
    this.x = Math.random() * _canvas.width;
    this.y = Math.random() * _canvas.height;
    this.vx = (Math.random() - 0.5) * CONFIG.speed;
    this.vy = (Math.random() - 0.5) * CONFIG.speed;
    this.radius = 2 + Math.random() * 2;
    this.color = particleColor();
  }

  update() {
    const dx = _pointer.x - this.x;
    const dy = _pointer.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < CONFIG.mouseDist && dist > 0) {
      const force = (CONFIG.mouseDist - dist) / CONFIG.mouseDist * CONFIG.mouseForce;
      this.vx += (dx / dist) * force;
      this.vy += (dy / dist) * force;
    }
    this.vx *= 0.99;
    this.vy *= 0.99;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed < 0.1) {
      this.vx += (Math.random() - 0.5) * 0.1;
      this.vy += (Math.random() - 0.5) * 0.1;
    }
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > _canvas.width)  this.vx *= -1;
    if (this.y < 0 || this.y > _canvas.height) this.vy *= -1;
    this.x = Math.max(0, Math.min(_canvas.width, this.x));
    this.y = Math.max(0, Math.min(_canvas.height, this.y));
  }

  draw() {
    _ctx.save();
    _ctx.shadowBlur = 10;
    _ctx.shadowColor = this.color;
    _ctx.beginPath();
    _ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    _ctx.fillStyle = this.color;
    _ctx.fill();
    _ctx.restore();
  }
}

function initParticles() {
  particles = Array.from({ length: CONFIG.count }, () => new Particle());
}

function drawConnections() {
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < CONFIG.connectDist) {
        const opacity = (1 - dist / CONFIG.connectDist) * 0.4;
        _ctx.beginPath();
        _ctx.moveTo(particles[i].x, particles[i].y);
        _ctx.lineTo(particles[j].x, particles[j].y);
        _ctx.strokeStyle = `rgba(79, 195, 247, ${opacity})`;
        _ctx.lineWidth = 0.5;
        _ctx.stroke();
      }
    }
  }
}

function animate() {
  _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
  drawConnections();
  particles.forEach(p => { p.update(); p.draw(); });
  rafId = requestAnimationFrame(animate);
}

export function init(canvas, ctx, pointer) {
  _canvas = canvas;
  _ctx = ctx;
  _pointer = pointer;
  initParticles();
  animate();
}

export function destroy() {
  cancelAnimationFrame(rafId);
  rafId = null;
  particles = [];
}

export function onKey(e) {
  if (e.key === '+' || e.key === '=') {
    CONFIG.count = Math.min(CONFIG.maxCount, CONFIG.count + CONFIG.step);
    initParticles();
  } else if (e.key === '-') {
    CONFIG.count = Math.max(CONFIG.minCount, CONFIG.count - CONFIG.step);
    initParticles();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git -C /mnt/c/Users/woodic/Documents/claude/git/cwooding.github.io add scenes/particles.js
git -C /mnt/c/Users/woodic/Documents/claude/git/cwooding.github.io commit -m "feat: extract particles into scene module"
```

---

### Task 2: Create `main.js`

**Files:**
- Create: `main.js`

- [ ] **Step 1: Create `main.js`**

```js
import * as particles from './scenes/particles.js';

const SCENES = [particles];

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const pointer = { x: -9999, y: -9999 };

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
});

// Pointer — touch
window.addEventListener('touchstart', e => {
  pointer.x = e.touches[0].clientX;
  pointer.y = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchmove', e => {
  pointer.x = e.touches[0].clientX;
  pointer.y = e.touches[0].clientY;
}, { passive: true });
window.addEventListener('touchend', () => {
  pointer.x = -9999;
  pointer.y = -9999;
});

// Scene switching — M key; forward other keys to current scene
window.addEventListener('keydown', e => {
  if (e.key === 'm' || e.key === 'M') {
    nextScene();
  } else {
    SCENES[current].onKey?.(e);
  }
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
```

- [ ] **Step 2: Commit**

```bash
git -C /mnt/c/Users/woodic/Documents/claude/git/cwooding.github.io add main.js
git -C /mnt/c/Users/woodic/Documents/claude/git/cwooding.github.io commit -m "feat: add scene manager (main.js)"
```

---

### Task 3: Refactor `index.html` to minimal shell

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace the entire contents of `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>cwooding</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0a0a0f; overflow: hidden; }
    canvas { display: block; }
  </style>
</head>
<body>
  <canvas id="c"></canvas>
  <script type="module" src="main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify file is exactly as above — no leftover inline script**

Read the file and confirm the `<script>` tag has `type="module" src="main.js"` and there is no inline JS.

- [ ] **Step 3: Commit**

```bash
git -C /mnt/c/Users/woodic/Documents/claude/git/cwooding.github.io add index.html
git -C /mnt/c/Users/woodic/Documents/claude/git/cwooding.github.io commit -m "refactor: strip index.html to minimal shell"
```

---

### Task 4: Verify

**Files:** none

- [ ] **Step 1: Check repo structure**

Run:
```bash
ls /mnt/c/Users/woodic/Documents/claude/git/cwooding.github.io/
ls /mnt/c/Users/woodic/Documents/claude/git/cwooding.github.io/scenes/
```

Expected:
```
index.html  main.js  scenes/  docs/  .gitignore  LICENSE  README.md
particles.js
```

- [ ] **Step 2: Check git log**

```bash
git -C /mnt/c/Users/woodic/Documents/claude/git/cwooding.github.io log --oneline -5
```

Expected (most recent 3 commits):
```
refactor: strip index.html to minimal shell
feat: add scene manager (main.js)
feat: extract particles into scene module
```

- [ ] **Step 3: Note on testing**

ES modules require HTTP — opening `index.html` directly via `file://` will fail with a CORS error. To test locally, run:

```bash
python3 -m http.server 8080 --directory /mnt/c/Users/woodic/Documents/claude/git/cwooding.github.io
```

Then open `http://localhost:8080` in a browser.

Expected: particle animation runs exactly as before. Mouse moves particles (desktop), touch moves particles (mobile), `+`/`-` adjusts count, `M` does nothing visible yet (only one scene registered).
