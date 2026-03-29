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
let plankton = [];
let jellyfish = [];
let waves = [];
let lanternfish = [];
let prevPointerDown = false;

function rand(min, max) { return min + Math.random() * (max - min); }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }

class Wave {
  static _nextId = 0;
  constructor(x, y, maxRadius, duration) {
    this.id = Wave._nextId++;
    this.x = x;
    this.y = y;
    this.maxRadius = maxRadius;
    this.duration = duration;
    this.elapsed = 0;
    this.active = true;
  }

  update(dt) {
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.active = false;
  }

  get radius() {
    return this.maxRadius * Math.min(this.elapsed / this.duration, 1);
  }

  hits(x, y) {
    if (!this.active) return false;
    const dist = Math.sqrt((x - this.x) ** 2 + (y - this.y) ** 2);
    const r = this.radius;
    return dist <= r && dist >= r - 30;
  }
}

function drawGlow(x, y, radius, r, g, b, intensity) {
  const grad = _ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, `rgba(${r},${g},${b},${intensity})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  _ctx.fillStyle = grad;
  _ctx.beginPath();
  _ctx.arc(x, y, radius, 0, Math.PI * 2);
  _ctx.fill();
}

class Plankton {
  constructor() {
    this.x = rand(0, _canvas.width);
    this.y = rand(0, _canvas.height);
    this.vx = rand(-0.3, 0.3);
    this.vy = rand(-0.3, 0.3);
    this.radius = rand(1, 2);
    this.brightness = 0.15;
    this.flashTimer = 0;
    this._lastWaveId = -1;
  }

  startle(wave) {
    if (wave.id === this._lastWaveId) return;
    this._lastWaveId = wave.id;
    this.brightness = 0.9;
    this.flashTimer = 500;
    const dx = this.x - wave.x;
    const dy = this.y - wave.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.vx += (dx / dist) * 2;
    this.vy += (dy / dist) * 2;
  }

  flock(neighbors) {
    let avgVx = 0, avgVy = 0, count = 0;
    for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      if (n === this) continue;
      const dx = n.x - this.x;
      const dy = n.y - this.y;
      if (dx * dx + dy * dy < 3600) { // 60px radius
        avgVx += n.vx;
        avgVy += n.vy;
        count++;
      }
    }
    if (count > 0) {
      this.vx += (avgVx / count - this.vx) * 0.005;
      this.vy += (avgVy / count - this.vy) * 0.005;
    }
  }

  update(dt) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      this.brightness = 0.15 + 0.75 * Math.max(0, this.flashTimer / 500);
    }
    this.vx += rand(-0.02, 0.02);
    this.vy += rand(-0.02, 0.02);
    this.vx *= 0.98;
    this.vy *= 0.98;
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0) this.x += _canvas.width;
    if (this.x > _canvas.width) this.x -= _canvas.width;
    if (this.y < 0) this.y += _canvas.height;
    if (this.y > _canvas.height) this.y -= _canvas.height;
  }

  draw() {
    drawGlow(this.x, this.y, 12, 0, 255, 160, this.brightness * 0.3);
    _ctx.beginPath();
    _ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    _ctx.fillStyle = `rgba(0, 255, 160, ${this.brightness})`;
    _ctx.fill();
  }
}

class Jellyfish {
  constructor() {
    this.x = rand(50, _canvas.width - 50);
    this.y = rand(50, _canvas.height - 50);
    this.vx = rand(-0.2, 0.2);
    this.vy = rand(-0.3, 0.1);
    this.bellWidth = rand(30, 50);
    this.bellHeight = rand(20, 35);
    this.pulsePhase = rand(0, Math.PI * 2);
    this.pulseSpeed = rand(0.8, 1.2);
    this.brightness = 0.4;
    this.startled = false;
    this.startleTimer = 0;
  }

  startle() {
    if (this.startled) return;
    this.startled = true;
    this.startleTimer = 600;
    this.brightness = 1.0;
    this.pulsePhase = 0;
    waves.push(new Wave(this.x, this.y, CONFIG.jellyWaveRadius, CONFIG.jellyWaveDuration));
  }

  update(dt) {
    this.pulsePhase += dt * 0.0018 * this.pulseSpeed;
    const pulse = (Math.sin(this.pulsePhase) + 1) / 2;

    if (this.startleTimer > 0) {
      this.startleTimer -= dt;
      this.brightness = 0.4 + 0.6 * Math.max(0, this.startleTimer / 600);
      if (this.startleTimer <= 0) this.startled = false;
    } else {
      this.brightness = 0.3 + pulse * 0.2;
    }

    if (pulse > 0.7) this.vy -= 0.02;
    this.vy += 0.005;
    this.vx += rand(-0.01, 0.01);
    this.vx *= 0.99;
    this.vy *= 0.99;
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 30) this.vx += 0.05;
    if (this.x > _canvas.width - 30) this.vx -= 0.05;
    if (this.y < 30) this.vy += 0.05;
    if (this.y > _canvas.height - 30) this.vy -= 0.05;
  }

  draw() {
    const pulse = (Math.sin(this.pulsePhase) + 1) / 2;
    const contract = this.startled ? 0.6 : 1 - pulse * 0.2;
    const w = this.bellWidth * contract;
    const h = this.bellHeight * contract;

    drawGlow(this.x, this.y - h / 2, w * 1.5, 255, 48, 144, this.brightness * 0.25);

    _ctx.beginPath();
    _ctx.moveTo(this.x - w / 2, this.y);
    _ctx.bezierCurveTo(
      this.x - w / 2, this.y - h * 1.3,
      this.x + w / 2, this.y - h * 1.3,
      this.x + w / 2, this.y
    );
    _ctx.bezierCurveTo(
      this.x + w / 3, this.y + h * 0.15,
      this.x - w / 3, this.y + h * 0.15,
      this.x - w / 2, this.y
    );
    _ctx.fillStyle = `rgba(255, 48, 144, ${this.brightness * 0.6})`;
    _ctx.fill();

    for (let i = 0; i < 5; i++) {
      const tx = this.x - w * 0.3 + (w * 0.6 / 4) * i;
      _ctx.beginPath();
      _ctx.moveTo(tx, this.y);
      let cy = this.y;
      for (let j = 0; j < 4; j++) {
        cy += 8;
        const cx = tx + Math.sin(time * 0.002 + i * 1.5 + j * 0.8) * 6;
        _ctx.lineTo(cx, cy);
      }
      _ctx.strokeStyle = `rgba(255, 48, 144, ${this.brightness * 0.35})`;
      _ctx.lineWidth = 1;
      _ctx.stroke();
    }
  }
}

class Lanternfish {
  constructor() {
    this.x = rand(0, _canvas.width);
    this.y = rand(50, _canvas.height - 50);
    this.vx = rand(0.5, 1.5) * (Math.random() < 0.5 ? 1 : -1);
    this.vy = rand(-0.2, 0.2);
    this.bodyWidth = rand(12, 18);
    this.bodyHeight = rand(6, 10);
    this.brightness = 0.3;
    this.lureOn = false;
    this.lureTimer = rand(2000, 5000);
    this.lureBlink = 0;
    this.startleTimer = 0;
    this.direction = this.vx > 0 ? 1 : -1;
    this._lastWaveId = -1;
  }

  startle(wave) {
    if (wave.id === this._lastWaveId) return;
    this._lastWaveId = wave.id;
    this.startleTimer = 1000;
    this.lureBlink = 1000;
    const dx = this.x - wave.x;
    const dy = this.y - wave.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    this.vx = (dx / dist) * 3;
    this.vy = (dy / dist) * 2;
    this.direction = this.vx > 0 ? 1 : -1;
  }

  update(dt) {
    this.lureTimer -= dt;
    if (this.lureTimer <= 0) {
      this.lureOn = !this.lureOn;
      this.lureTimer = this.lureOn ? rand(200, 400) : rand(2000, 5000);
    }

    if (this.lureBlink > 0) {
      this.lureBlink -= dt;
      this.lureOn = Math.sin(this.lureBlink * 0.03) > 0;
    }

    if (this.startleTimer > 0) {
      this.startleTimer -= dt;
    } else {
      if (Math.random() < 0.002) {
        this.vx = rand(0.5, 1.5) * (Math.random() < 0.5 ? 1 : -1);
        this.direction = this.vx > 0 ? 1 : -1;
      }
      this.vy += rand(-0.02, 0.02);
    }

    this.vx *= 0.995;
    this.vy *= 0.99;
    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0 || this.x > _canvas.width) {
      this.vx *= -1;
      this.direction *= -1;
    }
    if (this.y < 20 || this.y > _canvas.height - 20) this.vy *= -1;
    this.x = Math.max(0, Math.min(_canvas.width, this.x));
    this.y = Math.max(20, Math.min(_canvas.height - 20, this.y));
  }

  draw() {
    const b = this.startleTimer > 0 ? 0.6 : 0.3;

    drawGlow(this.x, this.y, 20, 255, 176, 64, b * 0.2);

    _ctx.beginPath();
    _ctx.ellipse(this.x, this.y, this.bodyWidth, this.bodyHeight, 0, 0, Math.PI * 2);
    _ctx.fillStyle = `rgba(255, 176, 64, ${b * 0.5})`;
    _ctx.fill();

    if (this.lureOn) {
      const lureX = this.x + this.direction * (this.bodyWidth + 6);
      drawGlow(lureX, this.y - 3, 10, 255, 220, 100, 0.6);
      _ctx.beginPath();
      _ctx.arc(lureX, this.y - 3, 2, 0, Math.PI * 2);
      _ctx.fillStyle = 'rgba(255, 255, 200, 0.9)';
      _ctx.fill();
    }
  }
}

function animate(now) {
  const dt = lastTime ? Math.min(now - lastTime, 50) : 16;
  lastTime = now;
  time = now;

  _ctx.globalCompositeOperation = 'source-over';
  _ctx.fillStyle = '#030810';
  _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

  _ctx.globalCompositeOperation = 'lighter';

  // Spawn wave on click/tap
  if (_pointer.down && !prevPointerDown && _pointer.x !== -9999) {
    waves.push(new Wave(_pointer.x, _pointer.y, CONFIG.waveMaxRadius, CONFIG.waveDuration));
  }
  prevPointerDown = _pointer.down;

  // Update waves
  waves.forEach(w => w.update(dt));
  waves = waves.filter(w => w.active);

  // Update organisms — check wave hits
  plankton.forEach(p => {
    waves.forEach(w => { if (w.hits(p.x, p.y)) p.startle(w); });
    p.flock(plankton);
    p.update(dt);
    p.draw();
  });

  jellyfish.forEach(j => {
    waves.forEach(w => { if (w.hits(j.x, j.y)) j.startle(); });
    j.update(dt);
    j.draw();
  });

  lanternfish.forEach(l => {
    waves.forEach(w => { if (w.hits(l.x, l.y)) l.startle(w); });
    l.update(dt);
    l.draw();
  });

  _ctx.globalCompositeOperation = 'source-over';
  rafId = requestAnimationFrame(animate);
}

export function init(canvas, ctx, pointer) {
  if (rafId !== null) cancelAnimationFrame(rafId);
  _canvas = canvas;
  _ctx = ctx;
  _pointer = pointer;
  lastTime = 0;
  prevPointerDown = false;
  plankton = Array.from({ length: CONFIG.planktonCount }, () => new Plankton());
  jellyfish = Array.from({ length: randInt(CONFIG.jellyfishMin, CONFIG.jellyfishMax) }, () => new Jellyfish());
  waves = [];
  lanternfish = Array.from({ length: randInt(CONFIG.lanternfishMin, CONFIG.lanternfishMax) }, () => new Lanternfish());
  rafId = requestAnimationFrame(animate);
}

export function destroy() {
  cancelAnimationFrame(rafId);
  rafId = null;
  plankton = [];
  jellyfish = [];
  waves = [];
  lanternfish = [];
}

export function onKey(e) {
  if (e.key === '+' || e.key === '=') {
    CONFIG.planktonCount = Math.min(CONFIG.maxPlankton, CONFIG.planktonCount + CONFIG.planktonStep);
    plankton = Array.from({ length: CONFIG.planktonCount }, () => new Plankton());
  } else if (e.key === '-') {
    CONFIG.planktonCount = Math.max(CONFIG.minPlankton, CONFIG.planktonCount - CONFIG.planktonStep);
    plankton = Array.from({ length: CONFIG.planktonCount }, () => new Plankton());
  }
}
