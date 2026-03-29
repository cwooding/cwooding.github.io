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
  if (rafId !== null) cancelAnimationFrame(rafId);
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
