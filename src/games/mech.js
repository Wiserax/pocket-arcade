import { Game, moveStick, clamp } from "../core.js";
import {
  bg,
  rr,
  text,
  circle,
  line,
  bar,
  panel,
  creature,
  gear,
  bolt,
  C,
  poly,
  shadow,
  label,
} from "../draw.js";
export const PARTS = [
  "Empty",
  "Repeater",
  "Beam",
  "Scatter",
  "Armor",
  "Battery",
];
const PC = ["#3b5361", "#eab765", "#6edbeb", "#d490f3", "#8eae9b", "#f5d650"];
const COST = [0, 20, 30, 30, 20, 15];
const OFF = [
  [-23, -14],
  [23, -14],
  [-23, 20],
  [23, 20],
];
export function mechStats(parts) {
  const batteries = parts.filter((p) => p === 5).length,
    armor = parts.filter((p) => p === 4).length,
    weapons = parts.filter((p) => p > 0 && p < 4).length;
  return {
    energy: 2 + batteries * 2,
    need: parts.reduce(
      (a, p) => a + (p === 2 ? 2 : p === 1 || p === 3 ? 1 : 0),
      0,
    ),
    speed: 143 - armor * 18,
    maxHP: 100 + armor * 35,
    weapons,
  };
}
export class Mech extends Game {
  constructor(seed, level, perks, saved) {
    super(seed, level, perks, saved);
    if (!saved)
      Object.assign(this.s, {
        phase: "build",
        parts: [1, 0, 5, 0],
        selected: 1,
        gold: 75 + (perks.spares || 0) * 5,
        player: { x: 210, y: 400, angle: -Math.PI / 2 },
        hp: 100,
        arena: 1,
        kills: 0,
        goal: 12 + Math.floor(this.difficulty * 2),
        enemies: [],
        shots: [],
        spawn: 1,
        fire: [0, 0, 0, 0],
        nextId: 0,
        arenaKills: 0,
        phaseTime: 0,
        dash: 0,
        dashCD: 0,
        hitCD: 0,
        hazards:
          level > 1
            ? [
                { x: 105, y: 220 },
                { x: 315, y: 385 },
              ]
            : [],
      });
  }
  update(dt) {
    const s = this.s;
    if (s.phase !== "fight") return;
    const st = mechStats(s.parts);
    s.phaseTime += dt;
    s.dash = Math.max(0, s.dash - dt);
    s.dashCD = Math.max(0, s.dashCD - dt);
    s.hitCD = Math.max(0, s.hitCD - dt);
    moveStick(this, s.player, dt, st.speed * (s.dash > 0 ? 2.3 : 1), {
      x: 36,
      y: 100,
      w: 348,
      h: 407,
    });
    s.spawn -= dt;
    if (s.spawn <= 0 && s.arenaKills + s.enemies.length < s.goal) {
      const type =
        s.arena === 3 && s.arenaKills === 0 && s.enemies.length === 0
          ? 4
          : (s.arena > 1 || this.level > 2) && s.nextId % 6 === 0
            ? 3
            : s.nextId % 5 === 0
              ? 2
              : s.nextId % 3 === 0
                ? 1
                : 0;
      s.enemies.push({
        id: s.nextId++,
        x: this.random() < 0.5 ? 35 : 385,
        y: 105 + this.random() * 260,
        hp:
          (type === 4 ? 320 : type === 3 ? 65 : type === 2 ? 70 : 25) *
          (1 + this.difficulty * 0.06 + s.arena * 0.13),
        type,
        shoot: 1.5,
        charge: 0,
        windup: 0,
        chargeCD: 2,
        dx: 0,
        dy: 0,
        max: 0,
        hit: 0,
      });
      s.enemies.at(-1).max = s.enemies.at(-1).hp;
      if (type === 4) {
        this.toast("The yard boss is here! Watch the three-shot fan.");
        this.audio("alert");
      }
      s.spawn = Math.max(0.5, 1.3 - this.difficulty * 0.025);
    }
    const p = s.player;
    const nearest = s.enemies
      .filter((e) => e.hp > 0)
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      )[0];
    if (nearest) p.angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
    for (let i = 0; i < 4; i++) {
      s.fire[i] -= dt;
      const type = s.parts[i];
      if (type < 1 || type > 3) continue;
      let target = s.enemies
        .filter(
          (e) => Math.cos(Math.atan2(e.y - p.y, e.x - p.x) - p.angle) > -0.12,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
        )[0];
      if (s.fire[i] <= 0 && target) {
        const angle = Math.atan2(target.y - p.y, target.x - p.x);
        for (let j = 0; j < (type === 3 ? 3 : 1); j++) {
          const a = angle + (type === 3 ? (j - 1) * 0.16 : 0);
          s.shots.push({
            x: p.x,
            y: p.y,
            vx: Math.cos(a) * (type === 2 ? 640 : 400),
            vy: Math.sin(a) * (type === 2 ? 640 : 400),
            life: 1.2,
            damage: type === 2 ? 32 : type === 3 ? 9 : 13,
            hits: [],
            type,
          });
        }
        s.fire[i] = type === 2 ? 0.8 : type === 3 ? 0.75 : 0.4;
        this.audio("shot");
      }
    }
    for (const b of s.shots) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.enemy) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < 23 && s.dash <= 0) {
          s.hp -= 9;
          b.life = 0;
          this.burst(p.x, p.y, C.red, 7);
        }
      } else {
        const e = s.enemies.find(
          (e) =>
            e.hp > 0 &&
            !b.hits.includes(e.id) &&
            Math.hypot(e.x - b.x, e.y - b.y) < (e.type === 4 ? 31 : 20),
        );
        if (e) {
          e.hp -= b.damage;
          e.hit = 0.1;
          b.hits.push(e.id);
          if (b.type !== 2) b.life = 0;
          this.emit(e.x, e.y, PC[b.type], 5);
        }
      }
    }
    s.shots = s.shots.filter(
      (b) => b.life > 0 && b.x > 0 && b.x < 420 && b.y > 75 && b.y < 550,
    );
    for (const e of s.enemies) {
      e.hit = Math.max(0, e.hit - dt);
      if (e.hp <= 0) {
        e.dead = true;
        s.kills++;
        s.arenaKills++;
        s.gold += e.type === 4 ? 25 : 3;
        s.score += 20;
        this.burst(e.x, e.y, PC[e.type + 1], 10);
        continue;
      }
      const dx = p.x - e.x,
        dy = p.y - e.y,
        d = Math.hypot(dx, dy);
      const speed =
        e.type === 1 ? 75 : e.type === 4 ? 23 : e.type === 2 ? 32 : 48;
      if (e.type === 3) {
        e.chargeCD -= dt;
        if (e.charge > 0) {
          e.charge -= dt;
          e.x = clamp(e.x + e.dx * 230 * dt, 30, 390);
          e.y = clamp(e.y + e.dy * 230 * dt, 100, 515);
        } else if (e.windup > 0) {
          e.windup -= dt;
          if (e.windup <= 0) e.charge = 0.8;
        } else if (e.chargeCD <= 0) {
          e.dx = dx / (d || 1);
          e.dy = dy / (d || 1);
          e.windup = 0.8;
          e.chargeCD = 4;
          this.audio("alert");
        }
      }
      if (
        d > 25 &&
        (e.type !== 2 || d > 170) &&
        e.charge <= 0 &&
        e.windup <= 0
      ) {
        e.x += (dx / (d || 1)) * speed * dt;
        e.y += (dy / (d || 1)) * speed * dt;
      }
      if (d < 35 && s.hitCD <= 0 && s.dash <= 0) {
        s.hp -= e.type === 4 ? 22 : e.type === 3 ? 18 : e.type === 1 ? 7 : 13;
        s.hitCD = 0.65;
        this.burst(p.x, p.y, C.red, 8);
      }
      if (e.type === 2 || e.type === 4) {
        e.shoot -= dt;
        if (e.shoot <= 0) {
          const a = Math.atan2(dy, dx);
          for (let j = 0; j < (e.type === 4 ? 3 : 1); j++) {
            const angle = a + (e.type === 4 ? (j - 1) * 0.28 : 0);
            s.shots.push({
              x: e.x,
              y: e.y,
              vx: Math.cos(angle) * 145,
              vy: Math.sin(angle) * 145,
              enemy: true,
              life: 3.5,
            });
          }
          e.shoot = e.type === 4 ? 1.5 : 2.3;
        }
      }
    }
    s.enemies = s.enemies.filter((e) => !e.dead);
    for (let i = 0; i < s.hazards.length; i++) {
      const h = s.hazards[i],
        t = (s.phaseTime + i * 4) % 10;
      if (
        t > 8 &&
        Math.hypot(p.x - h.x, p.y - h.y) < 42 &&
        s.hitCD <= 0 &&
        s.dash <= 0
      ) {
        s.hp -= 12;
        s.hitCD = 0.8;
        this.burst(p.x, p.y, C.red, 8);
      }
    }
    if (s.hp <= 0) {
      this.end(false, "Chassis recovered · try a different build");
      return;
    }
    if (s.arenaKills >= s.goal) {
      if (s.arena === 3) {
        s.score += Math.max(0, Math.round(s.hp)) * 2;
        this.end(true, "Scrapyard champion!");
        return;
      }
      s.phase = "build";
      s.arena++;
      s.arenaKills = 0;
      s.phaseTime = 0;
      s.gold += 35;
      s.hp = Math.min(st.maxHP, s.hp + 45);
      this.audio("build");
    }
  }
  pointer(x, y, type) {
    if (this.s.phase === "build" && type === "down") {
      if (y >= 420 && y <= 518) {
        const next = Math.floor((x - 12) / 67);
        if (next >= 0 && next < 6) this.action(`fit:${next}`);
        return;
      }
      const i = OFF.findIndex(
        ([dx, dy]) =>
          Math.hypot(x - (210 + dx * 2.6), y - (260 + dy * 2.6)) < 49,
      );
      if (i >= 0) {
        this.s.selected = i;
        this.audio("click");
      }
    }
  }
  action(id) {
    const s = this.s;
    if (id.startsWith("fit:") && s.phase === "build") {
      const next = Number(id.split(":")[1]),
        old = s.parts[s.selected];
      if (!Number.isInteger(next) || next < 0 || next > 5 || next === old)
        return;
      const cost = COST[next] - Math.floor(COST[old] * 0.8);
      if (s.gold >= cost) {
        s.gold -= cost;
        s.parts[s.selected] = next;
        this.audio("build");
        this.emit(210, 260, PC[next], 12);
      }
      return;
    }
    if (id === "cycle" && s.phase === "build") {
      const old = s.parts[s.selected],
        next = (old + 1) % 6,
        cost = COST[next] - Math.floor(COST[old] * 0.8);
      if (s.gold >= cost) {
        s.gold -= cost;
        s.parts[s.selected] = next;
        this.audio("build");
      }
    }
    if (id === "launch" && s.phase === "build") {
      const st = mechStats(s.parts);
      if (!st.weapons || st.need > st.energy) return;
      s.phase = "fight";
      s.hp = Math.min(st.maxHP, s.hp + 15);
      s.player = { x: 210, y: 400, angle: -Math.PI / 2 };
      s.shots = [];
      this.audio("build");
    }
    if (id === "dash" && s.dashCD <= 0 && s.phase === "fight") {
      s.dash = 0.7;
      s.dashCD = 5;
      this.audio("shot");
    }
  }
  actions() {
    const s = this.s,
      st = mechStats(s.parts),
      old = s.parts[s.selected],
      next = (old + 1) % 6,
      cost = COST[next] - Math.floor(COST[old] * 0.8);
    return s.phase === "build"
      ? [
          {
            id: "launch",
            label: `Arena ${s.arena}`,
            sub:
              st.need > st.energy
                ? "Needs more battery"
                : !st.weapons
                  ? "Fit a weapon first"
                  : "Drive & fight",
            disabled: !st.weapons || st.need > st.energy,
          },
        ]
      : [
          {
            id: "dash",
            label: "Dash",
            sub:
              s.dashCD > 0 ? `${s.dashCD.toFixed(1)}s` : "Dodge through danger",
            disabled: s.dashCD > 0,
          },
        ];
  }
  stats() {
    const st = mechStats(this.s.parts);
    return this.s.phase === "build"
      ? [
          ["SCRAP", this.s.gold],
          ["POWER", `${st.need}/${st.energy}`],
          ["ARMOR", st.maxHP],
        ]
      : [
          ["HULL", Math.ceil(this.s.hp)],
          ["TARGETS", `${this.s.arenaKills}/${this.s.goal}`],
          ["ARENA", `${this.s.arena}/3`],
        ];
  }
  objective() {
    return this.s.phase === "build"
      ? "Tap a socket, then a part below · power limits your build"
      : "Drag to drive · guns track the nearest target · dash to dodge";
  }
  details() {
    return [
      ["Targets scrapped", this.s.kills],
      ["Scrap recovered", this.s.gold],
      ["Arena reached", this.s.arena],
    ];
  }
  drawMech(c, x, y, scale = 1, angle = -Math.PI / 2) {
    const s = this.s;
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    c.rotate(angle + Math.PI / 2);
    shadow(c, 0, 30, 34);
    rr(c, -22, -30, 44, 63, 12, "#547b94");
    rr(c, -11, -22, 22, 34, 9, "#8cd5e6");
    for (let i = 0; i < 4; i++) {
      const [dx, dy] = OFF[i],
        p = s.parts[i];
      rr(
        c,
        dx - 12,
        dy - 13,
        24,
        26,
        5,
        PC[p],
        s.phase === "build" && s.selected === i ? C.gold : C.ink,
        2,
      );
      if (p === 1) rr(c, dx - 4, dy - 23, 8, 21, 2, "#c7d7df");
      if (p === 2) {
        poly(
          c,
          [
            [dx, dy - 23],
            [dx + 8, dy - 8],
            [dx, dy + 3],
            [dx - 8, dy - 8],
          ],
          "#c0f5fa",
        );
      }
      if (p === 3) {
        for (let j = -1; j <= 1; j++)
          rr(c, dx - 2 + j * 5, dy - 22, 4, 18, 1, "#d9b7fc");
      }
      if (p === 4)
        line(
          c,
          [
            [dx - 8, dy],
            [dx, dy + 7],
            [dx + 8, dy],
          ],
          "#d7efcf",
          4,
        );
      if (p === 5) bolt(c, dx, dy, 9);
    }
    poly(
      c,
      [
        [0, -38],
        [-7, -27],
        [7, -27],
      ],
      "#e7f9f0",
    );
    c.restore();
  }
  render(c) {
    const s = this.s;
    const region = Math.floor((this.level - 1) / 5) % 6;
    const palette = [
      ["#273b56", "#131f34"],
      ["#454369", "#252c49"],
      ["#816b56", "#423d4b"],
      ["#7194a8", "#354764"],
      ["#704953", "#352839"],
      ["#6c5d91", "#322f50"],
    ][region];
    bg(c, ...palette, true);
    if (s.phase === "fight") {
      rr(c, 16, 84, 388, 435, 12, "#00000000", palette[0], 8);
      for (let i = 0; i < 8; i++) {
        rr(c, 13, 100 + i * 52, 12, 31, 2, "#758c9955", null);
        rr(c, 395, 100 + i * 52, 12, 31, 2, "#758c9955", null);
      }
      circle(c, 210, 305, 112, "#00000000", "#a6c6d511", 3);
      circle(c, 210, 305, 70, "#00000000", "#a6c6d511", 3);
    }
    panel(
      c,
      s.phase === "build" ? "BUILD YOUR SCRAP MECH" : `SCRAPYARD ${s.arena}`,
      s.phase === "build"
        ? "A physical build. No hidden synergy rules."
        : "Guns track nearby threats · keep moving to dodge",
    );
    if (s.phase === "build") {
      circle(c, 210, 260, 128, "#243e56", "#517990", 3);
      circle(c, 210, 260, 106, "#1b304c", "#3b607c", 1);
      this.drawMech(c, 210, 260, 2.6);
      text(
        c,
        PARTS[s.parts[s.selected]].toUpperCase(),
        210,
        376,
        25,
        s.parts[s.selected] ? PC[s.parts[s.selected]] : C.cream,
      );
      text(
        c,
        [
          "Choose a part",
          "13 damage / 0.4s · 1 power",
          "32 damage / 0.8s · pierces · 2 power",
          "3 × 9 damage / 0.75s · 1 power",
          "+35 armor · slower",
          "+2 energy capacity",
        ][s.parts[s.selected]],
        210,
        401,
        15,
      );
      for (let i = 0; i < 6; i++) {
        const old = s.parts[s.selected],
          cost = COST[i] - Math.floor(COST[old] * 0.8),
          x = 14 + i * 67;
        rr(
          c,
          x,
          423,
          61,
          98,
          8,
          i === old ? "#a9cfaa" : "#344d67",
          i === old ? C.gold : C.ink,
          2,
        );
        circle(c, x + 30, 447, 14, PC[i]);
        if (i === 5) bolt(c, x + 30, 447, 10);
        else
          text(
            c,
            ["−", "I", "II", "III", "+", ""][i],
            x + 30,
            448,
            16,
            C.ink,
            "center",
            false,
          );
        text(c, PARTS[i], x + 30, 477, 12, C.cream, "center", false);
        text(
          c,
          i === old ? "Fitted" : cost <= 0 ? `+${-cost}` : `${cost}g`,
          x + 30,
          501,
          14,
          i === old ? C.gold : s.gold < cost ? C.red : C.cream,
        );
      }
      text(
        c,
        "Switching refunds 80% of the old part",
        210,
        542,
        12,
        "#b8cbd2",
        "center",
        false,
      );
      return;
    }
    for (let i = 0; i < s.hazards.length; i++) {
      const h = s.hazards[i],
        t = (s.phaseTime + i * 4) % 10;
      circle(
        c,
        h.x,
        h.y,
        40,
        t > 8 ? "#ef754788" : t > 6 ? "#efb34e33" : "#142636",
        t > 6 ? C.gold : "#3e5870",
        2,
      );
      gear(c, h.x, h.y, 22, "#5c7482", s.time * 0.3);
      if (t > 6) text(c, t > 8 ? "HOT" : "!", h.x, h.y, 16, C.gold);
    }
    for (const e of s.enemies) {
      if (e.windup > 0)
        line(
          c,
          [
            [e.x, e.y],
            [e.x + e.dx * 180, e.y + e.dy * 180],
          ],
          "#ff726780",
          18,
        );
      creature(
        c,
        e.x,
        e.y,
        e.type,
        e.type === 4 ? 33 : e.type === 2 ? 23 : e.type === 3 ? 22 : 17,
        s.time,
        e.hit > 0
          ? "#ffffff"
          : ["#e18077", "#d5bb69", "#b6a1ed", "#d88356", "#968acc"][e.type],
      );
      if (e.hp < e.max)
        bar(
          c,
          e.x - 20,
          e.y - (e.type === 4 ? 43 : 29),
          40,
          5,
          e.hp / e.max,
          C.red,
        );
      if (e.type === 4) {
        rr(c, e.x - 29, e.y - 12, 58, 15, 4, "#465971");
        circle(c, e.x, e.y - 4, 7, C.gold);
      }
    }
    for (const b of s.shots) {
      if (b.type === 2)
        line(
          c,
          [
            [b.x - b.vx * 0.02, b.y - b.vy * 0.02],
            [b.x, b.y],
          ],
          PC[2],
          5,
        );
      else
        circle(
          c,
          b.x,
          b.y,
          b.enemy ? 5 : 3,
          b.enemy ? C.red : PC[b.type],
          null,
        );
    }
    this.drawMech(c, s.player.x, s.player.y, 1, s.player.angle);
    if (s.dash > 0)
      circle(c, s.player.x, s.player.y, 38, "#7fddff22", "#9ceaff", 2);
    bar(c, 30, 539, 360, 11, s.hp / mechStats(s.parts).maxHP);
  }
}
