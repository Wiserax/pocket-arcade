import { navigate, clearPath } from "../navigation.js";
import { Game, moveStick, clamp } from "../core.js";
import {
  bg,
  rr,
  text,
  circle,
  line,
  bar,
  panel,
  tree,
  rock,
  C,
  poly,
  shadow,
  arrow,
} from "../draw.js";
const COLORS = ["#efb95e", "#a8dce3", "#c8a0e1"];
export class Cleanup extends Game {
  constructor(seed, level, perks, saved) {
    super(seed, level, perks, saved);
    this.path = [];
    this.pathTarget = null;
    this.pathClock = 0;
    if (!saved) {
      const obstacles =
        level % 3 === 1
          ? [
              { x: 70, y: 215, w: 110, h: 25 },
              { x: 242, y: 320, w: 115, h: 25 },
            ]
          : level % 3 === 2
            ? [
                { x: 90, y: 230, w: 24, h: 150 },
                { x: 275, y: 170, w: 24, h: 155 },
              ]
            : [
                { x: 105, y: 250, w: 210, h: 25 },
                { x: 192, y: 310, w: 25, h: 90 },
              ];
      const items = [];
      for (let i = 0; i < 180; i++) {
        let x, y;
        do {
          x = 30 + this.random() * 360;
          y = 145 + this.random() * 278;
        } while (
          obstacles.some(
            (o) =>
              x > o.x - 20 &&
              x < o.x + o.w + 20 &&
              y > o.y - 20 &&
              y < o.y + o.h + 20,
          )
        );
        items.push({
          x,
          y,
          type: i % 3,
          size: i % 8 === 0 ? 2 : 1,
          alive: true,
        });
      }
      Object.assign(this.s, {
        items,
        obstacles,
        player: { x: 210, y: 485, angle: -Math.PI / 2 },
        bag: [0, 0, 0],
        bank: [0, 0, 0],
        goals: [
          24 + Math.min(20, level),
          19 + Math.min(20, level),
          14 + Math.min(20, level),
        ],
        capacity: 14 + (perks.capacity || 0) * 2,
        timeLeft: 150,
        filter: false,
        attachment: 0,
        unloads: 0,
        cleaned: 0,
        swirls: [],
        boost: 0,
        boostCD: 0,
      });
    }
  }
  update(dt) {
    const s = this.s;
    s.timeLeft -= dt;
    s.boost = Math.max(0, s.boost - dt);
    s.boostCD = Math.max(0, s.boostCD - dt);
    const previous = { ...s.player };
    const target = { x: this.input.x, y: this.input.y };
    this.pathClock -= dt;
    if (this.input.down) {
      if (
        !this.pathTarget ||
        (this.pathClock <= 0 &&
          Math.hypot(
            target.x - this.pathTarget.x,
            target.y - this.pathTarget.y,
          ) > 12)
      ) {
        this.path = navigate(s.player, target, s.obstacles);
        this.pathTarget = target;
        this.pathClock = 0.18;
      }
      while (
        this.path.length &&
        Math.hypot(this.path[0].x - s.player.x, this.path[0].y - s.player.y) < 7
      )
        this.path.shift();
      if (this.path.length) {
        this.input.x = this.path[0].x;
        this.input.y = this.path[0].y;
      }
    } else this.pathTarget = null;
    moveStick(this, s.player, dt, s.attachment === 1 ? 95 : 120, {
      x: 24,
      y: 132,
      w: 372,
      h: 386,
    });
    this.input.x = target.x;
    this.input.y = target.y;
    for (const o of s.obstacles || []) {
      const p = s.player;
      if (
        p.x > o.x - 15 &&
        p.x < o.x + o.w + 15 &&
        p.y > o.y - 15 &&
        p.y < o.y + o.h + 15
      ) {
        if (previous.x <= o.x - 15 || previous.x >= o.x + o.w + 15)
          p.x = previous.x;
        else p.y = previous.y;
      }
    }
    const p = s.player,
      total = s.bag.reduce((a, b) => a + b, 0),
      range = s.boost > 0 ? 48 : s.attachment === 1 ? 33 : 24;
    let bag = total;
    for (const item of s.items) {
      if (!item.alive || bag >= s.capacity) continue;
      if (
        s.filter &&
        s.bank[item.type] + s.bag[item.type] >= s.goals[item.type]
      )
        continue;
      const d = Math.hypot(item.x - p.x, item.y - p.y);
      if (
        d < range &&
        clearPath(p, item, s.obstacles, 0) &&
        (item.size === 1 || s.attachment === 1 || s.boost > 0)
      ) {
        item.alive = false;
        s.bag[item.type]++;
        bag++;
        s.cleaned++;
        s.swirls.push({ x: item.x, y: item.y, type: item.type, t: 0 });
        this.audio("coin");
      }
    }
    for (const item of s.swirls) {
      item.t += dt * 3;
      item.x += (p.x - item.x) * dt * 9;
      item.y += (p.y - item.y) * dt * 9;
    }
    s.swirls = s.swirls.filter((i) => i.t < 1);
    if (p.y > 460 && Math.abs(p.x - 210) < 67 && bag > 0) {
      for (let i = 0; i < 3; i++) {
        s.bank[i] += s.bag[i];
        s.score += s.bag[i] * 4;
        s.bag[i] = 0;
      }
      s.unloads++;
      this.emit(210, 495, C.gold, 25);
      this.audio("build");
    }
    if (s.goals.every((n, i) => s.bank[i] >= n)) {
      s.score += Math.ceil(s.timeLeft) * 2;
      this.end(true, "A spotless little victory!");
      return;
    }
    if (s.timeLeft <= 0)
      this.end(false, "Good work · finish the job next time");
    if (s.items.every((i) => !i.alive) && bag === 0 && !s.done)
      this.end(false, "Try focusing on the requested materials");
  }
  action(id) {
    const s = this.s;
    if (id === "filter") {
      s.filter = !s.filter;
      this.audio("click");
    }
    if (id === "head") {
      s.attachment = 1 - s.attachment;
      this.audio("build");
    }
    if (id === "boost" && s.boostCD <= 0) {
      s.boost = 3;
      s.boostCD = 18;
      this.audio("build");
    }
  }
  actions() {
    return [
      {
        id: "filter",
        label: this.s.filter ? "Filter: job items" : "Filter: collect all",
        sub: "Toggle selective pickup",
      },
      {
        id: "head",
        label: this.s.attachment ? "Wide head" : "Quick head",
        sub: this.s.attachment
          ? "Collects heavy clutter"
          : "Move faster · small items",
      },
      {
        id: "boost",
        label: "Super suction",
        sub:
          this.s.boostCD > 0
            ? `${Math.ceil(this.s.boostCD)}s`
            : "Big pull · 3 seconds",
        disabled: this.s.boostCD > 0,
      },
    ];
  }
  stats() {
    return [
      ["BAG", `${this.s.bag.reduce((a, b) => a + b, 0)}/${this.s.capacity}`],
      ["TIME", `${Math.ceil(this.s.timeLeft)}s`],
      ["CLEANED", this.s.cleaned],
    ];
  }
  objective() {
    return this.s.bag.reduce((a, b) => a + b, 0) >= this.s.capacity
      ? "Bag full! Head to the three sorting bins below"
      : "Drag to vacuum · unload at the bottom sorting station";
  }
  details() {
    return [
      ["Items recycled", this.s.bank.reduce((a, b) => a + b, 0)],
      ["Bags unloaded", this.s.unloads],
      ["Time remaining", `${Math.ceil(Math.max(0, this.s.timeLeft))}s`],
    ];
  }
  stars() {
    return this.s.win
      ? this.s.timeLeft > 80
        ? 3
        : this.s.timeLeft > 35
          ? 2
          : 1
      : 0;
  }
  render(c) {
    const s = this.s,
      theme = Math.floor((this.level - 1) / 5) % 6;
    const palette = [
      ["#a1c997", "#698f82", "#d3ca9e"],
      ["#96b6bf", "#587285", "#bdc2b3"],
      ["#efc08b", "#bd8f77", "#e4d3ad"],
      ["#97cbd1", "#5795af", "#eddaa8"],
      ["#888bbb", "#535b83", "#9da4af"],
      ["#d2a2bd", "#907bb4", "#d7bf9e"],
    ][theme];
    bg(c, palette[0], palette[1]);
    rr(c, 12, 87, 396, 444, 20, palette[2], "#4c7468", 4);
    for (let y = 95; y < 460; y += 44)
      line(
        c,
        [
          [19, y],
          [402, y],
        ],
        "#ada77d55",
        1,
      );
    for (let x = 18; x < 408; x += 48)
      line(
        c,
        [
          [x, 90],
          [x, 453],
        ],
        "#ada77d55",
        1,
      );
    panel(
      c,
      [
        "POCKET PARK",
        "THE WORKSHOP",
        "SUNNY PLAZA",
        "SEASIDE WALK",
        "MOON MARKET",
        "FESTIVAL SQUARE",
      ][theme],
      "Collect the job materials · unload to count them",
    );
    for (let i = 0; i < 3; i++) {
      if (!s.goals[i]) continue;
      rr(c, 24 + i * 132, 92, 121, 36, 9, "#274d54");
      circle(c, 41 + i * 132, 110, 7, COLORS[i], null);
      text(
        c,
        `${s.bank[i]}/${s.goals[i]}`,
        91 + i * 132,
        111,
        18,
        s.bank[i] >= s.goals[i] ? C.green : C.cream,
      );
    }
    for (const o of s.obstacles || []) {
      shadow(c, o.x + o.w / 2, o.y + o.h, o.w * 0.55, 9);
      rr(c, o.x, o.y, o.w, o.h, 7, "#aa8560", "#5b6654", 2);
      for (let j = 0; j < 3; j++)
        line(
          c,
          [
            [o.x + 6, o.y + 5 + j * 6],
            [o.x + o.w - 6, o.y + 5 + j * 6],
          ],
          "#d4b58a",
          2,
        );
    }
    for (const item of s.items)
      if (item.alive) {
        c.save();
        c.translate(item.x, item.y);
        c.rotate(item.x);
        const sz = item.size === 2 ? 10 : 6;
        shadow(c, 0, 3, sz);
        if (item.type === 0)
          rr(c, -sz, -sz, sz * 2, sz * 2, 3, COLORS[0], "#856d4f", 1);
        if (item.type === 1) {
          rr(c, -sz * 0.6, -sz, sz * 1.2, sz * 2, 3, COLORS[1], "#69888c", 1);
          rr(c, -sz * 0.35, -sz * 1.4, sz * 0.7, sz * 0.5, 1, "#f5f8db", null);
        }
        if (item.type === 2)
          poly(
            c,
            [
              [-sz, 0],
              [0, -sz],
              [sz, 0],
              [0, sz],
            ],
            COLORS[2],
            "#887096",
            1,
          );
        c.restore();
      }
    rr(c, 133, 462, 154, 67, 14, "#698a81", "#2b5057", 3);
    for (let i = 0; i < 3; i++) {
      rr(c, 145 + i * 44, 474, 36, 40, 6, COLORS[i]);
      arrow(c, 163 + i * 44, 492, Math.PI / 2, "#31565b", 0.6);
    }
    text(c, "UNLOAD HERE", 210, 543, 14);
    if (this.input.down && this.path.length) {
      c.save();
      c.setLineDash([3, 9]);
      line(
        c,
        [[s.player.x, s.player.y], ...this.path.map((p) => [p.x, p.y])],
        "#fff5bb66",
        2,
      );
      c.restore();
    }
    const p = s.player;
    shadow(c, p.x, p.y + 18, 28);
    if (s.boost > 0)
      circle(
        c,
        p.x,
        p.y,
        52 + Math.sin(s.time * 10) * 8,
        "#bceeff22",
        "#b3e8ee88",
        2,
      );
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.angle);
    rr(c, -23, -19, 43, 38, 14, "#efb75e");
    rr(c, -11, -24, 21, 7, 3, "#426570");
    rr(c, -11, 17, 21, 7, 3, "#426570");
    rr(c, -13, -11, 23, 22, 7, "#b9edf0");
    rr(
      c,
      14,
      -(s.attachment ? 22 : 13),
      17,
      s.attachment ? 44 : 26,
      4,
      "#527b8d",
    );
    c.restore();
    for (const i of s.swirls) {
      circle(c, i.x, i.y, (1 - i.t) * 7, COLORS[i.type], null);
    }
    const n = s.bag.reduce((a, b) => a + b, 0);
    bar(
      c,
      p.x - 22,
      p.y - 33,
      44,
      6,
      n / s.capacity,
      n >= s.capacity ? C.red : C.gold,
    );
    if (n >= s.capacity) text(c, "FULL", p.x, p.y - 47, 13, C.gold);
  }
}
