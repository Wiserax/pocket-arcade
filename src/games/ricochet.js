import { Game, clamp, shuffle } from "../core.js";
import {
  bg,
  rr,
  text,
  circle,
  line,
  bar,
  panel,
  creature,
  rock,
  C,
  star,
} from "../draw.js";
export function stepBall(b, dt, enemies, onHit = () => {}, obstacles = []) {
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.age += dt;
  b.cool = Math.max(0, (b.cool || 0) - dt);
  if (b.x < 25) {
    b.x = 25;
    b.vx = Math.abs(b.vx);
  }
  if (b.x > 395) {
    b.x = 395;
    b.vx = -Math.abs(b.vx);
  }
  if (b.y < 86) {
    b.y = 86;
    b.vy = Math.abs(b.vy);
  }
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const dx = b.x - e.x,
      dy = b.y - e.y,
      d = Math.hypot(dx, dy);
    if (d < 26 && b.cool <= 0) {
      const nx = dx / (d || 1),
        ny = dy / (d || 1),
        dot = b.vx * nx + b.vy * ny;
      b.incomingX = b.vx;
      b.incomingY = b.vy;
      b.vx -= 2 * dot * nx;
      b.vy -= 2 * dot * ny;
      b.x = e.x + nx * 27;
      b.y = e.y + ny * 27;
      b.cool = 0.06;
      onHit(e, b, ny);
      break;
    }
  }
  for (const o of obstacles) {
    if (o.hp <= 0 || b.cool > 0) continue;
    if (o.type === "mirror") {
      const ax = o.x - 25,
        ay = o.y + o.slant * 23,
        bx = o.x + 25,
        by = o.y - o.slant * 23,
        vx = bx - ax,
        vy = by - ay,
        t = clamp(
          ((b.x - ax) * vx + (b.y - ay) * vy) / (vx * vx + vy * vy),
          0,
          1,
        ),
        px = ax + t * vx,
        py = ay + t * vy,
        dx = b.x - px,
        dy = b.y - py,
        d = Math.hypot(dx, dy);
      if (d < 8) {
        const nx = dx / (d || 1),
          ny = dy / (d || 1),
          dot = b.vx * nx + b.vy * ny;
        b.vx -= 2 * dot * nx;
        b.vy -= 2 * dot * ny;
        b.x = px + nx * 9;
        b.y = py + ny * 9;
        b.cool = 0.045;
        onHit(o, b, ny);
      }
    } else {
      const dx = b.x - o.x,
        dy = b.y - o.y;
      if (Math.abs(dx) < o.w / 2 + 6 && Math.abs(dy) < o.h / 2 + 6) {
        if (o.w / 2 + 6 - Math.abs(dx) < o.h / 2 + 6 - Math.abs(dy)) {
          b.vx = -b.vx;
          b.x = o.x + Math.sign(dx) * (o.w / 2 + 7);
        } else {
          b.vy = -b.vy;
          b.y = o.y + Math.sign(dy) * (o.h / 2 + 7);
        }
        b.cool = 0.045;
        onHit(o, b, 0);
      }
    }
  }
  if (b.y > 512 && b.age > 0.15) b.dead = true;
  if (b.age > 5.5) b.dead = true;
}
export const POWERS = {
  volley: {
    label: "Twin volley",
    sub: "+2 balls every shot",
    color: "#ffe59b",
  },
  blast: {
    label: "Shockwave",
    sub: "Each kill damages nearby foes",
    color: "#ffac73",
  },
  pierce: {
    label: "Ghost shot",
    sub: "First enemy per ball is pierced",
    color: "#b8a1ff",
  },
  split: {
    label: "Split spark",
    sub: "First hit splits into 2 weaker balls",
    color: "#f4a6e8",
  },
  freeze: {
    label: "Frost touch",
    sub: "Hit enemies advance 50% less",
    color: "#a4e7fc",
  },
  power: {
    label: "Heavy shot",
    sub: "+0.5 damage on every impact",
    color: "#ffcf5b",
  },
};
export class Ricochet extends Game {
  constructor(seed, level, perks, saved) {
    super(seed, level, perks, saved);
    if (!saved) {
      Object.assign(this.s, {
        hp: 4,
        room: 1,
        rooms: 5,
        turn: 0,
        enemies: [],
        balls: [],
        pending: 0,
        spawn: 0,
        obstacles: [],
        aim: { x: 230, y: 160 },
        firing: false,
        aiming: false,
        damage: 1,
        volley: 7,
        blast: 0,
        pierce: 0,
        split: 0,
        freeze: 0,
        choices: [],
        draft: false,
        kills: 0,
        shots: 0,
      });
      this.room();
    }
  }
  room() {
    const s = this.s;
    s.enemies = [];
    s.obstacles = [];
    const n = 6 + Math.min(9, Math.floor(this.difficulty) + s.room);
    for (let i = 0; i < n; i++) {
      const col = (i + Math.floor(this.seed % 6)) % 6,
        row = Math.floor(i / 6);
      const type =
        i % 7 === 0 && s.room > 1
          ? 2
          : i % 5 === 0
            ? 1
            : this.level >= 6 && s.room > 1 && i % 4 === 2
              ? 3
              : 0;
      s.enemies.push({
        x: 55 + col * 62,
        y: 128 + row * 64,
        hp:
          type === 2
            ? 1
            : type === 3
              ? 2 + Math.floor(this.difficulty / 3)
              : 2 + Math.floor((s.room + this.difficulty) / 3),
        max: 0,
        type,
        shield: type === 1,
        hit: 0,
        frozen: 0,
      });
      s.enemies.at(-1).max = s.enemies.at(-1).hp;
    }
    const layout =
      (s.room + this.level - 2 + Math.floor(this.random() * 3)) % 5;
    if (s.room > 1 || this.level > 2) {
      if (layout === 0 || layout === 3)
        s.obstacles.push(
          { type: "mirror", x: 110, y: 310, slant: 1, hp: 999 },
          { type: "mirror", x: 310, y: 270, slant: -1, hp: 999 },
        );
      if (layout === 1)
        s.obstacles.push(
          { type: "wall", x: 60, y: 275, w: 48, h: 65, hp: 999 },
          { type: "wall", x: 360, y: 275, w: 48, h: 65, hp: 999 },
          { type: "crate", x: 210, y: 273, w: 60, h: 28, hp: 3 },
        );
      if (layout === 2 || layout === 4)
        s.obstacles.push(
          { type: "crate", x: 150, y: 295, w: 52, h: 28, hp: 2 },
          { type: "mirror", x: 275, y: 295, slant: 1, hp: 999 },
        );
    }
    if (s.room === 5) {
      s.enemies.push({
        x: 210,
        y: 100,
        hp: 14 + Math.floor(this.difficulty * 2),
        max: 14 + Math.floor(this.difficulty * 2),
        type: 4,
        shield: false,
        hit: 0,
        frozen: 0,
      });
    }
    s.turn = 0;
  }
  pointer(x, y, type) {
    if (this.s.firing || this.s.draft || this.s.done) return;
    if (type === "down" || type === "move") {
      this.s.aim = { x: clamp(x, 25, 395), y: clamp(y, 90, 465) };
      if (type === "down") this.s.aiming = true;
    }
    if (type === "up" && this.s.aiming) {
      this.s.aiming = false;
      this.fire();
    }
  }
  fire() {
    const s = this.s;
    if (s.firing || s.draft) return;
    const dx = s.aim.x - 210,
      dy = Math.min(-45, s.aim.y - 510),
      d = Math.hypot(dx, dy);
    s.dir = { x: (dx / d) * 550, y: (dy / d) * 550 };
    s.pending = s.volley;
    s.spawn = 0;
    s.firing = true;
    s.shots++;
    this.audio("shot");
  }
  impact(e, b, ny) {
    const s = this.s;
    if (e.type === "mirror" || e.type === "wall") {
      this.audio("click");
      return;
    }
    if (e.type === "crate") {
      e.hp -= s.damage * (b.power ?? 1);
      this.emit(e.x, e.y, "#d4a877", 5);
      this.audio("hit");
      return;
    }
    if (e.shield && ny > 0.2) {
      e.shield = false;
      this.emit(e.x, e.y, "#bcdeef", 7);
      this.audio("click");
      return;
    }
    const damage = s.damage * (b.power ?? 1);
    e.hp -= damage;
    if (s.freeze) e.frozen = 1;
    if (s.pierce && !b.pierced) {
      b.pierced = true;
      b.vx = b.incomingX ?? b.vx;
      b.vy = b.incomingY ?? b.vy;
      const speed = Math.hypot(b.vx, b.vy);
      b.x = e.x + (b.vx / speed) * 29;
      b.y = e.y + (b.vy / speed) * 29;
    }
    if (s.split && !b.child && !b.splitDone && s.balls.length < 30) {
      b.splitDone = true;
      const a = Math.atan2(b.vy, b.vx),
        speed = Math.hypot(b.vx, b.vy);
      for (const turn of [-0.5, 0.5])
        s.balls.push({
          x: b.x,
          y: b.y,
          vx: Math.cos(a + turn) * speed,
          vy: Math.sin(a + turn) * speed,
          age: b.age,
          cool: 0.08,
          child: true,
          power: 0.45,
        });
      this.emit(e.x, e.y, "#f5a2ef", 7);
    }
    e.hit = 0.12;
    this.audio("hit");
    this.emit(e.x, e.y, C.gold, 4);
    if (e.hp <= 0) {
      s.kills++;
      s.score += 15;
      this.burst(e.x, e.y, e.type === 2 ? "#ffae43" : "#a4e96f", 10);
      if (e.type === 2 || s.blast) {
        for (const other of s.enemies)
          if (
            other !== e &&
            other.hp > 0 &&
            Math.hypot(other.x - e.x, other.y - e.y) < (e.type === 2 ? 100 : 72)
          ) {
            other.hp -= e.type === 2 ? 3 : 1 + Math.max(0, s.blast - 1) * 0.35;
            if (other.hp <= 0) {
              s.kills++;
              s.score += 15;
              this.emit(other.x, other.y, "#ffd584", 10);
            }
          }
      }
    }
  }
  update(dt) {
    const s = this.s;
    for (const e of s.enemies) e.hit = Math.max(0, e.hit - dt);
    if (!s.firing) return;
    s.spawn -= dt;
    if (s.pending && s.spawn <= 0) {
      s.balls.push({
        x: 210,
        y: 507,
        vx: s.dir.x,
        vy: s.dir.y,
        age: 0,
        cool: 0,
      });
      s.pending--;
      s.spawn = 0.075;
    }
    const sub = Math.ceil(dt / 0.008);
    for (let i = 0; i < sub; i++)
      for (const b of [...s.balls])
        if (!b.dead)
          stepBall(
            b,
            dt / sub,
            s.enemies,
            (e, b, ny) => this.impact(e, b, ny),
            s.obstacles,
          );
    s.balls = s.balls.filter((b) => !b.dead);
    if (!s.balls.length && !s.pending) {
      s.firing = false;
      s.enemies = s.enemies.filter((e) => e.hp > 0);
      if (!s.enemies.length) {
        if (s.room >= s.rooms) {
          this.end(true, "The vault is yours!");
          return;
        }
        this.roomComplete();
        return;
      }
      s.turn++;
      for (const e of s.enemies) {
        e.y +=
          (e.type === 1 ? 29 : e.type === 3 ? 57 : 38) * (e.frozen ? 0.5 : 1);
        e.frozen = 0;
        if (e.y > 450) {
          s.hp--;
          e.hp = 0;
          this.burst(e.x, 460, C.red);
        }
      }
      s.enemies = s.enemies.filter((e) => e.hp > 0);
      if (s.hp <= 0) this.end(false, "The raiders broke through");
      else if (!s.enemies.length) {
        this.roomComplete();
      }
    }
  }
  roomComplete() {
    const s = this.s;
    if (s.room >= s.rooms) {
      this.end(true, "The vault is yours!");
      return;
    }
    if (s.room === 2 || s.room === 4) {
      s.draft = true;
      s.choices =
        s.room === 2
          ? ["volley", "pierce", "blast"]
          : shuffle(
              ["power", "split", "freeze", "volley", "blast"].filter(
                (k) => !s[k] || k === "volley" || k === "power",
              ),
              this.random,
            ).slice(0, 3);
      this.audio("build");
    } else {
      s.room++;
      this.room();
      this.toast(`Room ${s.room} opened`);
      this.audio("coin");
    }
  }
  action(id) {
    const s = this.s;
    if (id === "fire") this.fire();
    if (s.draft) {
      if (!s.choices.includes(id)) return;
      if (id === "volley") s.volley += 2;
      else if (id === "blast") s.blast++;
      else if (id === "power") s.damage += 0.5;
      else if (["pierce", "split", "freeze"].includes(id)) s[id]++;
      else return;
      s.room++;
      if (s.room % 2 === 1)
        s.hp = Math.min(4, s.hp + (this.perks.recovery || 0));
      s.draft = false;
      this.room();
      this.audio("build");
    }
  }
  actions() {
    return this.s.draft
      ? this.s.choices.map((id) => ({
          id,
          label: POWERS[id].label,
          sub: POWERS[id].sub,
        }))
      : [
          {
            id: "fire",
            label: this.s.firing ? "Volley in flight" : "Fire at marker",
            sub: this.s.firing ? "Returns within 6 sec" : "Or drag & release",
            disabled: this.s.firing,
          },
        ];
  }
  stats() {
    return [
      ["HEARTS", "♥".repeat(Math.max(0, this.s.hp))],
      ["ROOM", `${this.s.room}/${this.s.rooms}`],
      ["BALLS", this.s.volley],
    ];
  }
  objective() {
    return this.s.draft
      ? "Choose a power for the next room"
      : this.level >= 6 && this.s.enemies.some((e) => e.type === 3 && e.hp > 0)
        ? "Orange runners advance faster · slow them or clear them first"
        : "Drag to aim · release to fire · bank around shields";
  }
  stars() {
    return this.s.win ? (this.s.hp === 4 ? 3 : this.s.hp >= 2 ? 2 : 1) : 0;
  }
  details() {
    return [
      ["Hearts protected", `${Math.max(0, this.s.hp)}/4`],
      ["Raiders cleared", this.s.kills],
      ["Volleys fired", this.s.shots],
      ["Rooms cleared", this.s.room - (this.s.win ? 0 : 1)],
    ];
  }
  render(c) {
    const s = this.s;
    const theme = Math.floor((this.level - 1) / 5) % 6;
    const palette = [
      ["#407b78", "#19423f", "#d9c994"],
      ["#438c9d", "#264858", "#9fc9c7"],
      ["#8275b1", "#443966", "#d1c5e0"],
      ["#89534c", "#422b39", "#cfa58c"],
      ["#596c99", "#24364b", "#b8c2d3"],
      ["#997744", "#4d3e2b", "#e4cf91"],
    ][theme];
    bg(c, palette[0], palette[1]);
    for (let i = 0; i < 9; i++) {
      rr(c, 4, 80 + i * 49, 16, 42, 4, "#597b73");
      rr(c, 400, 80 + i * 49, 16, 42, 4, "#597b73");
    }
    rr(c, 20, 78, 380, 444, 10, "#bdac74", "#112e32", 5);
    rr(c, 29, 86, 362, 420, 4, palette[2], null);
    for (let y = 100; y < 500; y += 49)
      line(
        c,
        [
          [30, y],
          [390, y],
        ],
        "#a9956b33",
        1,
      );
    panel(
      c,
      s.draft
        ? "ROOM CLEAR!"
        : `${["MOSS VAULT", "SUNKEN TEMPLE", "CRYSTAL ROOM", "ASH CITADEL", "MOON KEEP", "GOLDEN TOMB"][theme]} · ${s.room}`,
      s.draft
        ? "Choose your next projectile upgrade"
        : "Shields block the first frontal hit",
    );
    line(
      c,
      [
        [28, 468],
        [392, 468],
      ],
      "#ce5b4a",
      3,
    );
    if (!s.firing && !s.draft) {
      const dx = s.aim.x - 210,
        dy = Math.min(-45, s.aim.y - 510),
        d = Math.hypot(dx, dy);
      let b = {
        x: 210,
        y: 510,
        vx: (dx / d) * 550,
        vy: (dy / d) * 550,
        age: 0,
        cool: 0,
      };
      const preview = s.enemies.map((e) => ({ ...e }));
      for (let i = 0; i < 150 && !b.dead; i++) {
        stepBall(
          b,
          1 / 120,
          preview,
          (e, ball) => {
            if (
              typeof e.type === "number" &&
              s.pierce &&
              !ball.pierced &&
              !(e.shield && ball.y > e.y)
            ) {
              ball.pierced = true;
              ball.vx = ball.incomingX;
              ball.vy = ball.incomingY;
              const speed = Math.hypot(ball.vx, ball.vy);
              ball.x = e.x + (ball.vx / speed) * 29;
              ball.y = e.y + (ball.vy / speed) * 29;
            }
          },
          s.obstacles,
        );
        if (i % 4 === 0) circle(c, b.x, b.y, 2.7, "#fffce7", null);
      }
    }
    for (const o of s.obstacles || []) {
      if (o.hp <= 0) continue;
      if (o.type === "mirror") {
        line(
          c,
          [
            [o.x - 25, o.y + o.slant * 23],
            [o.x + 25, o.y - o.slant * 23],
          ],
          "#294954",
          12,
        );
        line(
          c,
          [
            [o.x - 25, o.y + o.slant * 23],
            [o.x + 25, o.y - o.slant * 23],
          ],
          "#b4f1ee",
          7,
        );
        line(
          c,
          [
            [o.x - 22, o.y + o.slant * 21],
            [o.x + 22, o.y - o.slant * 21],
          ],
          "#fcffee",
          2,
        );
      } else {
        rr(
          c,
          o.x - o.w / 2,
          o.y - o.h / 2,
          o.w,
          o.h,
          5,
          o.type === "crate" ? "#bf9567" : "#7f9290",
        );
        if (o.type === "crate") {
          line(
            c,
            [
              [o.x - o.w / 2 + 5, o.y - o.h / 2 + 4],
              [o.x + o.w / 2 - 5, o.y + o.h / 2 - 4],
            ],
            "#e4c48a",
            4,
          );
          text(c, Math.ceil(o.hp), o.x, o.y, 15);
        } else
          line(
            c,
            [
              [o.x - o.w / 2 + 3, o.y],
              [o.x + o.w / 2 - 3, o.y],
            ],
            "#596e71",
            2,
          );
      }
    }
    for (const e of s.enemies)
      if (e.hp > 0) {
        if (e.type === 2) {
          rr(c, e.x - 18, e.y - 21, 36, 40, 8, "#b66932");
          rr(c, e.x - 21, e.y - 14, 42, 7, 3, "#66727c");
          rr(c, e.x - 21, e.y + 9, 42, 7, 3, "#66727c");
          text(c, "!", e.x, e.y, 20, C.gold);
        } else {
          creature(
            c,
            e.x,
            e.y,
            e.type,
            e.type === 4 ? 32 : 22,
            s.time,
            e.hit ? "#fff8cf" : e.type === 3 ? "#efa45a" : undefined,
          );
          if (e.type === 3) {
            for (const dx of [-8, 8])
              line(
                c,
                [
                  [e.x + dx - 4, e.y + 17],
                  [e.x + dx, e.y + 23],
                  [e.x + dx + 4, e.y + 17],
                ],
                "#ffe2a1",
                3,
              );
          }
          if (e.shield)
            rr(c, e.x - 24, e.y + 10, 48, 14, 5, "#67b9d9", "#203346", 3);
          text(c, Math.ceil(e.hp), e.x, e.y - 30, 16);
        }
      }
    for (const b of s.balls) {
      circle(c, b.x, b.y, 6, "#fff5bd", "#9b6d36", 1.5);
      circle(c, b.x - 1, b.y - 2, 2, "#ffffff", null);
    }
    circle(c, 210, 511, 20, "#9671d6");
    circle(c, 210, 511, 11, "#ddbeff");
    if (s.draft) {
      rr(c, 45, 175, 330, 205, 18, "#264454ee", C.gold, 3);
      text(c, "Choose your next trick", 210, 210, 25, C.cream);
      s.choices.forEach((id, i) => {
        const x = 105 + i * 105;
        circle(c, x, 278, 33, POWERS[id].color);
        text(
          c,
          {
            volley: "+2",
            pierce: "➜",
            blast: "✦",
            split: "×3",
            freeze: "❄",
            power: "+½",
          }[id],
          x,
          279,
          27,
          "#344251",
          "center",
          false,
        );
        text(c, POWERS[id].label.split(" ")[0], x, 337, 16, C.cream);
      });
    }
  }
}
