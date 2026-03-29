export const name = 'void-runner';

// ── State ────────────────────────────────────────────────────────────────────
let _canvas, _ctx, _pointer;
let rafId = null;
let lastTime = 0;

const STATE = { READY: 0, PLAYING: 1, DEAD: 2 };
let state = STATE.READY;

let score = 0;
let highScore = 0;
let speed = 0.001;        // z-units per ms (faster start)
let spawnTimer = 0;
let spawnInterval = 600; // ms (more frequent)
let flashTimer = 0;       // white flash on death
let deadCooldown = 0;     // ms before restart input accepted

// ── Player ───────────────────────────────────────────────────────────────────
const player = {
  x: 0, y: 0,           // screen coords (set in init)
  tx: 0, ty: 0,         // target coords
  trail: [],            // [{x,y}] fading afterimages
};
const PLAYER_SPEED = 0.25; // lerp factor per frame (responsive)
const PLAYER_SIZE = 18;

// Arrow key state
const keys = { left: false, right: false, up: false, down: false };
const KEY_SPEED = 480; // px/s

// ── Obstacles ─────────────────────────────────────────────────────────────────
// Each: { wx, wy, z, type }  wx/wy = world position relative to vanishing point
// type 0 = red diamond, 1 = orange h-bar, 2 = yellow v-bar
const obstacles = [];
const OBS_TYPES = 3;

// ── Tunnel visuals ────────────────────────────────────────────────────────────
const NUM_RAYS = 14;
const NUM_RINGS = 8;
let ringOffset = 0; // 0..1 animated offset for conveyor effect

// ── Helpers ───────────────────────────────────────────────────────────────────
function vpX() { return _canvas.width / 2; }
function vpY() { return _canvas.height * 0.35; }

function project(wx, wy, z) {
  const s = 1 - z;
  const sx = vpX() + wx * s;
  const sy = vpY() + wy * s;
  return { sx, sy, s };
}

function reset() {
  score = 0;
  speed = 0.001;
  spawnTimer = 0;
  spawnInterval = 600;
  obstacles.length = 0;
  player.trail.length = 0;
  player.tx = player.x;
  player.ty = player.y;
}

function spawnObstacle() {
  // Bias toward player position so standing still isn't safe
  const hw = _canvas.width * 0.3;
  const hh = _canvas.height * 0.3;
  // 60% of obstacles aim near the player, 40% random
  let wx, wy;
  if (Math.random() < 0.6) {
    // Aim at player with some spread
    wx = (player.x - vpX()) + (Math.random() - 0.5) * hw * 0.8;
    wy = (player.y - vpY()) + (Math.random() - 0.5) * hh * 0.8;
  } else {
    wx = (Math.random() - 0.5) * hw * 2;
    wy = (Math.random() - 0.5) * hh * 2;
  }
  obstacles.push({ wx, wy, z: 1.0, type: Math.floor(Math.random() * OBS_TYPES) });
}

// ── Draw tunnel background ────────────────────────────────────────────────────
function drawTunnel() {
  const cx = _canvas.width, cy = _canvas.height;
  const vx = vpX(), vy = vpY();

  _ctx.save();
  _ctx.globalCompositeOperation = 'lighter';

  // Radial lines from vanishing point to screen edges
  const corners = [
    [0, 0], [cx * 0.25, 0], [cx * 0.5, 0], [cx * 0.75, 0], [cx, 0],
    [cx, cy * 0.5], [cx, cy],
    [cx * 0.75, cy], [cx * 0.5, cy], [cx * 0.25, cy], [0, cy],
    [0, cy * 0.5],
    [0, cy * 0.25], [cx, cy * 0.25],
  ];
  // Pick evenly-spaced edges
  const step = corners.length / NUM_RAYS;
  _ctx.strokeStyle = 'rgba(40,60,160,0.25)';
  _ctx.lineWidth = 1;
  for (let i = 0; i < NUM_RAYS; i++) {
    const [ex, ey] = corners[Math.round(i * step) % corners.length];
    _ctx.beginPath();
    _ctx.moveTo(vx, vy);
    _ctx.lineTo(ex, ey);
    _ctx.stroke();
  }

  // Depth rings (ellipses that expand outward)
  const maxRW = cx * 0.6;
  const maxRH = cy * 0.5;
  for (let i = 0; i < NUM_RINGS; i++) {
    const t = ((i / NUM_RINGS) + ringOffset) % 1; // 0=near VP, 1=screen edge
    const alpha = 0.08 + t * 0.18;
    const rw = maxRW * t;
    const rh = maxRH * t;
    _ctx.strokeStyle = `rgba(60,80,200,${alpha.toFixed(2)})`;
    _ctx.lineWidth = 1;
    _ctx.beginPath();
    _ctx.ellipse(vx, vy, rw, rh, 0, 0, Math.PI * 2);
    _ctx.stroke();
  }

  _ctx.restore();
}

// ── Draw player ───────────────────────────────────────────────────────────────
function drawPlayer() {
  _ctx.save();
  _ctx.globalCompositeOperation = 'lighter';

  // Trail (older = more transparent)
  for (let i = 0; i < player.trail.length; i++) {
    const alpha = ((i + 1) / (player.trail.length + 1)) * 0.4;
    const sz = PLAYER_SIZE * 0.7;
    drawDiamond(_ctx, player.trail[i].x, player.trail[i].y, sz,
      `rgba(0,200,255,${alpha.toFixed(2)})`, null);
  }

  // Glow halo
  _ctx.shadowColor = '#00ffff';
  _ctx.shadowBlur = 18;

  // Main diamond
  drawDiamond(_ctx, player.x, player.y, PLAYER_SIZE, null, '#00ffff');

  _ctx.restore();
}

function drawDiamond(ctx, x, y, size, fillStyle, strokeStyle) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size * 0.6, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size * 0.6, y);
  ctx.closePath();
  if (fillStyle) { ctx.fillStyle = fillStyle; ctx.fill(); }
  if (strokeStyle) { ctx.strokeStyle = strokeStyle; ctx.lineWidth = 2; ctx.stroke(); }
}

// ── Draw obstacles ────────────────────────────────────────────────────────────
function drawObstacle(obs) {
  const { sx, sy, s } = project(obs.wx, obs.wy, obs.z);
  if (s <= 0) return;

  _ctx.save();
  _ctx.globalCompositeOperation = 'lighter';

  // Approach line from vanishing point — shows trajectory
  const lineAlpha = Math.min(s, 0.3) * 0.4;
  if (lineAlpha > 0.01) {
    const colors = ['#ff2244', '#ff8800', '#ffee00'];
    _ctx.strokeStyle = colors[obs.type].replace(')', `,${lineAlpha.toFixed(2)})`).replace('rgb', 'rgba').replace('#', '');
    // Use hex to rgba
    const c = colors[obs.type];
    const r = parseInt(c.slice(1, 3), 16);
    const g = parseInt(c.slice(3, 5), 16);
    const b = parseInt(c.slice(5, 7), 16);
    _ctx.strokeStyle = `rgba(${r},${g},${b},${lineAlpha.toFixed(2)})`;
    _ctx.lineWidth = 1;
    _ctx.beginPath();
    _ctx.moveTo(vpX(), vpY());
    _ctx.lineTo(sx, sy);
    _ctx.stroke();
  }

  const baseSize = 48 * s;

  if (obs.type === 0) {
    // Red diamond
    _ctx.shadowColor = '#ff2244';
    _ctx.shadowBlur = 12;
    _ctx.strokeStyle = '#ff2244';
    _ctx.lineWidth = 1.5;
    drawDiamond(_ctx, sx, sy, baseSize, null, '#ff2244');
    // Inner bright outline
    _ctx.strokeStyle = '#ff8899';
    _ctx.lineWidth = 0.8;
    drawDiamond(_ctx, sx, sy, baseSize * 0.55, null, '#ff8899');

  } else if (obs.type === 1) {
    // Orange horizontal bar
    _ctx.shadowColor = '#ff8800';
    _ctx.shadowBlur = 10;
    const bw = baseSize * 3.2;
    const bh = baseSize * 0.7;
    _ctx.strokeStyle = '#ff8800';
    _ctx.lineWidth = 1.5;
    _ctx.strokeRect(sx - bw / 2, sy - bh / 2, bw, bh);
    _ctx.strokeStyle = '#ffcc44';
    _ctx.lineWidth = 0.8;
    _ctx.strokeRect(sx - bw * 0.4, sy - bh * 0.3, bw * 0.8, bh * 0.6);

  } else {
    // Yellow vertical bar
    _ctx.shadowColor = '#ffee00';
    _ctx.shadowBlur = 10;
    const bw2 = baseSize * 0.7;
    const bh2 = baseSize * 3.2;
    _ctx.strokeStyle = '#ffee00';
    _ctx.lineWidth = 1.5;
    _ctx.strokeRect(sx - bw2 / 2, sy - bh2 / 2, bw2, bh2);
    _ctx.strokeStyle = '#ffffff';
    _ctx.lineWidth = 0.8;
    _ctx.strokeRect(sx - bw2 * 0.3, sy - bh2 * 0.4, bw2 * 0.6, bh2 * 0.8);
  }

  _ctx.restore();
}

// ── Collision ─────────────────────────────────────────────────────────────────
// Sample multiple z-values between prevZ and obs.z to prevent tunneling.
function hitsAt(obs, z) {
  const { sx, sy, s } = project(obs.wx, obs.wy, z);
  if (s <= 0) return false;
  const pr = PLAYER_SIZE * 0.45; // tight player hitbox

  if (obs.type === 0) {
    // Diamond — use 50% of visual radius
    const or = 48 * s * 0.5;
    const dx = sx - player.x, dy = sy - player.y;
    return dx * dx + dy * dy < (pr + or) * (pr + or);
  } else {
    // Bars — use 55% of visual size
    const isH = obs.type === 1;
    const hw = 48 * (isH ? 3.2 : 0.7) * s * 0.5 * 0.55;
    const hh = 48 * (isH ? 0.7 : 3.2) * s * 0.5 * 0.55;
    return Math.abs(player.x - sx) < hw + pr && Math.abs(player.y - sy) < hh + pr;
  }
}

function checkCollision(obs, prevZ) {
  // Only check obstacles in the danger zone
  if (obs.z > 0.15 && prevZ > 0.15) return false;
  if (obs.z < -0.15 && prevZ < -0.15) return false;

  // Sample along the path — more samples for bigger z steps
  const dz = Math.abs(prevZ - obs.z);
  const steps = Math.max(2, Math.ceil(dz / 0.02));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const z = prevZ + (obs.z - prevZ) * t;
    if (hitsAt(obs, z)) return true;
  }
  return false;
}

// ── HUD & screens ─────────────────────────────────────────────────────────────
function drawHUD() {
  _ctx.save();
  _ctx.globalCompositeOperation = 'source-over';
  _ctx.fillStyle = '#ffffff';
  _ctx.font = 'bold 22px monospace';
  _ctx.textAlign = 'center';
  _ctx.fillText(Math.floor(score).toString().padStart(6, '0'),
    _canvas.width / 2, 36);
  _ctx.restore();
}

function drawReady(pulse) {
  _ctx.save();
  _ctx.globalCompositeOperation = 'source-over';
  _ctx.textAlign = 'center';

  // Title glow
  _ctx.shadowColor = '#00ffff';
  _ctx.shadowBlur = 30;
  _ctx.fillStyle = '#00ffff';
  _ctx.font = 'bold 58px monospace';
  _ctx.fillText('VOID RUNNER', _canvas.width / 2, _canvas.height * 0.55);

  // Subtitle pulse
  _ctx.shadowBlur = 0;
  const alpha = 0.5 + 0.5 * Math.sin(pulse * 3.5);
  _ctx.fillStyle = `rgba(200,200,255,${alpha.toFixed(2)})`;
  _ctx.font = '22px monospace';
  const hint = 'ontouchstart' in window ? 'TAP TO START' : 'PRESS ANY KEY';
  _ctx.fillText(hint, _canvas.width / 2, _canvas.height * 0.65);

  _ctx.restore();
}

function drawDead(pulse) {
  _ctx.save();
  _ctx.globalCompositeOperation = 'source-over';
  _ctx.textAlign = 'center';

  _ctx.shadowColor = '#ff2244';
  _ctx.shadowBlur = 24;
  _ctx.fillStyle = '#ff4466';
  _ctx.font = 'bold 52px monospace';
  _ctx.fillText('GAME OVER', _canvas.width / 2, _canvas.height * 0.48);

  _ctx.shadowBlur = 0;
  _ctx.fillStyle = '#ffffff';
  _ctx.font = '24px monospace';
  _ctx.fillText(`SCORE  ${Math.floor(score).toString().padStart(6, '0')}`,
    _canvas.width / 2, _canvas.height * 0.58);
  _ctx.fillStyle = '#aaaaff';
  _ctx.fillText(`BEST   ${Math.floor(highScore).toString().padStart(6, '0')}`,
    _canvas.width / 2, _canvas.height * 0.65);

  const alpha = 0.5 + 0.5 * Math.sin(pulse * 3.5);
  _ctx.fillStyle = `rgba(200,200,255,${alpha.toFixed(2)})`;
  _ctx.font = '20px monospace';
  const hint = 'ontouchstart' in window ? 'TAP TO RETRY' : 'PRESS ANY KEY';
  _ctx.fillText(hint, _canvas.width / 2, _canvas.height * 0.74);

  _ctx.restore();
}

// ── Main loop ─────────────────────────────────────────────────────────────────
let pulseTime = 0;
let prevPointerDown = false; // track pointer press edges for tap-to-start

function loop(ts) {
  rafId = requestAnimationFrame(loop);

  const rawDt = ts - lastTime;
  lastTime = ts;

  const dt = Math.min(rawDt > 200 ? 16 : rawDt, 50); // clamp; skip huge gaps
  pulseTime += dt / 1000;

  // Dead cooldown
  if (deadCooldown > 0) deadCooldown -= dt;

  // Touch/click state transitions (rising edge of pointer.down)
  const pointerTapped = _pointer.down && !prevPointerDown;
  prevPointerDown = _pointer.down;
  if (pointerTapped) {
    if (state === STATE.READY) {
      startGame();
    } else if (state === STATE.DEAD && deadCooldown <= 0) {
      state = STATE.READY;
    }
  }

  // Clear
  _ctx.fillStyle = '#050510';
  _ctx.fillRect(0, 0, _canvas.width, _canvas.height);

  // Tunnel always animates
  ringOffset = (ringOffset + dt * 0.0004) % 1;
  drawTunnel();

  if (state === STATE.READY) {
    drawPlayer();
    drawReady(pulseTime);

  } else if (state === STATE.PLAYING) {
    updatePlayer(dt);
    updateObstacles(dt);
    drawObstacles();
    drawPlayer();
    drawHUD();

  } else if (state === STATE.DEAD) {
    // Flash overlay
    if (flashTimer > 0) {
      flashTimer -= dt;
      const alpha = Math.min(flashTimer / 200, 1) * 0.85;
      _ctx.save();
      _ctx.globalCompositeOperation = 'source-over';
      _ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
      _ctx.restore();
    }
    drawObstacles();
    drawPlayer();
    drawDead(pulseTime);
  }
}

function updatePlayer(dt) {
  const cx = _canvas.width;
  const cy = _canvas.height;
  const margin = PLAYER_SIZE * 2;

  // Keyboard movement: adjust target
  if (keys.left)  player.tx -= KEY_SPEED * dt / 1000;
  if (keys.right) player.tx += KEY_SPEED * dt / 1000;
  if (keys.up)    player.ty -= KEY_SPEED * dt / 1000;
  if (keys.down)  player.ty += KEY_SPEED * dt / 1000;

  // Touch/mouse drag
  if (_pointer.down) {
    player.tx = _pointer.x;
    player.ty = _pointer.y;
  }

  // Clamp target to screen
  player.tx = Math.max(margin, Math.min(cx - margin, player.tx));
  player.ty = Math.max(margin, Math.min(cy - margin, player.ty));

  // Push trail
  player.trail.push({ x: player.x, y: player.y });
  if (player.trail.length > 4) player.trail.shift();

  // Smooth lerp
  const lf = 1 - Math.pow(1 - PLAYER_SPEED, dt / 16);
  player.x += (player.tx - player.x) * lf;
  player.y += (player.ty - player.y) * lf;
}

function updateObstacles(dt) {
  // Speed ramp
  const speedSec = dt / 1000;
  speed = Math.min(speed + 0.00001 * speedSec, 0.002);
  spawnInterval = Math.max(200, 600 - (speed - 0.001) / 0.000001 * 0.4);

  // Score
  score += speedSec * (speed / 0.001) * 60;

  // Spawn
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnObstacle();
    spawnTimer = spawnInterval;
  }

  // Move & cull
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obs = obstacles[i];
    const prevZ = obs.z;
    obs.z -= speed * dt;

    if (checkCollision(obs, prevZ)) {
      die();
      return;
    }

    if (obs.z < -0.5) {
      obstacles.splice(i, 1);
    }
  }
}

function drawObstacles() {
  // Draw back-to-front (largest z first = furthest back)
  const sorted = obstacles.slice().sort((a, b) => b.z - a.z);
  for (const obs of sorted) {
    if (obs.z < 0.995) drawObstacle(obs);
  }
}

function die() {
  if (score > highScore) {
    highScore = score;
    try { localStorage.setItem('voidrunner-highscore', highScore); } catch (_) {}
  }
  state = STATE.DEAD;
  flashTimer = 200;
  deadCooldown = 800;
}

function startGame() {
  reset();
  state = STATE.PLAYING;
}

// ── Public API ────────────────────────────────────────────────────────────────
export function init(canvas, ctx, pointer) {
  _canvas = canvas;
  _ctx = ctx;
  _pointer = pointer;

  // Load high score
  try {
    const saved = localStorage.getItem('voidrunner-highscore');
    if (saved) highScore = parseFloat(saved) || 0;
  } catch (_) {}

  // Place player in lower-center
  player.x = canvas.width / 2;
  player.y = canvas.height * 0.78;
  player.tx = player.x;
  player.ty = player.y;

  state = STATE.READY;
  lastTime = performance.now();
  rafId = requestAnimationFrame(loop);
}

export function destroy() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  obstacles.length = 0;
  player.trail.length = 0;
  keys.left = keys.right = keys.up = keys.down = false;
}

export function onKey(e) {
  const down = e.type === 'keydown';
  switch (e.key) {
    case 'ArrowLeft':  keys.left  = down; break;
    case 'ArrowRight': keys.right = down; break;
    case 'ArrowUp':    keys.up    = down; break;
    case 'ArrowDown':  keys.down  = down; break;
  }

  if (down) {
    if (state === STATE.READY) {
      startGame();
    } else if (state === STATE.DEAD && deadCooldown <= 0) {
      state = STATE.READY;
    }
  }
}
