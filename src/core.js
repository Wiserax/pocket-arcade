export const W = 420,
  H = 560;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function shuffle(a, r) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export const choice = (a, r) => a[Math.floor(r() * a.length)];
export class Game {
  constructor(seed, level = 1, perks = {}, saved = null) {
    this.seed = seed;
    this.level = level;
    this.difficulty =
      1 +
      ((level - 1) % 5) * 0.7 +
      (Math.floor((level - 1) / 5) % 6) * 0.45 +
      Math.min(0.6, Math.floor((level - 1) / 30) * 0.15);
    this.perks = perks;
    this.s = saved || {
      time: 0,
      score: 0,
      done: false,
      win: false,
      _rng: seed >>> 0,
    };
    this.random = () => {
      let a = (this.s._rng ?? seed) >>> 0;
      a = (a + 0x6d2b79f5) >>> 0;
      this.s._rng = a;
      let t = Math.imul(a ^ (a >>> 15), a | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    this.fx = [];
    this.shake = 0;
    this.audio = () => {};
    this.toast = () => {};
    this.input = { x: 210, y: 460, down: false, keys: new Set() };
  }
  emit(x, y, color = "#ffe16c", n = 8, force = 90) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        v = force * (0.3 + Math.random());
      this.fx.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 0.35 + Math.random() * 0.35,
        max: 0.7,
        color,
        size: 2 + Math.random() * 4,
      });
    }
    if (this.fx.length > 160) this.fx.splice(0, this.fx.length - 160);
  }
  burst(x, y, color, n = 15) {
    this.emit(x, y, color, n, 135);
    this.shake = 0.12;
    this.audio("hit");
  }
  tick(dt) {
    this.s.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    for (const p of this.fx) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 110 * dt;
    }
    this.fx = this.fx.filter((p) => p.life > 0);
    if (!this.s.done) this.update(dt);
    this.animate(dt);
  }
  drawFX(c) {
    for (const p of this.fx) {
      c.globalAlpha = Math.min(1, p.life * 3);
      c.fillStyle = p.color;
      c.fillRect(p.x, p.y, p.size, p.size);
    }
    c.globalAlpha = 1;
  }
  end(win, reason) {
    if (this.s.done) return;
    this.s.done = true;
    this.s.win = win;
    this.s.reason = reason;
    this.audio(win ? "win" : "lose");
    if (win) this.emit(210, 180, "#ffdf55", 55, 240);
  }
  update() {}
  animate() {}
  pointer() {}
  action() {}
  actions() {
    return [];
  }
  stats() {
    return [];
  }
  objective() {
    return "";
  }
  details() {
    return [];
  }
  save() {
    return JSON.parse(JSON.stringify(this.s));
  }
  reward() {
    return Math.max(8, Math.round(this.s.score * 0.15) + (this.s.win ? 35 : 8));
  }
  stars() {
    return this.s.win ? 3 : 0;
  }
}
export function moveStick(
  g,
  obj,
  dt,
  speed,
  bounds = { x: 20, y: 60, w: 380, h: 455 },
) {
  let dx = 0,
    dy = 0;
  const k = g.input.keys;
  if (k.has("ArrowLeft") || k.has("a")) dx--;
  if (k.has("ArrowRight") || k.has("d")) dx++;
  if (k.has("ArrowUp") || k.has("w")) dy--;
  if (k.has("ArrowDown") || k.has("s")) dy++;
  if (g.input.down) {
    dx = g.input.x - obj.x;
    dy = g.input.y - obj.y;
    if (Math.hypot(dx, dy) < 7) {
      dx = 0;
      dy = 0;
    }
  }
  const n = Math.hypot(dx, dy);
  if (n) {
    const d = g.input.down ? Math.min(speed * dt, n) : speed * dt;
    obj.x = clamp(obj.x + (dx / n) * d, bounds.x, bounds.x + bounds.w);
    obj.y = clamp(obj.y + (dy / n) * d, bounds.y, bounds.y + bounds.h);
    obj.angle = Math.atan2(dy, dx);
    return true;
  }
  return false;
}
