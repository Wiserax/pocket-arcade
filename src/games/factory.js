import { Game, clamp } from "../core.js";
import {
  bg,
  rr,
  text,
  circle,
  line,
  gear,
  cannon,
  bar,
  panel,
  creature,
  coin,
  arrow,
  C,
  label,
} from "../draw.js";
export const GUNS = [
  {
    name: "Repeater",
    short: "Rapid",
    cost: 0,
    ammo: 1,
    delay: 0.55,
    damage: 11,
    color: "#68c8df",
    desc: "1 shell · fast single shots",
  },
  {
    name: "Mortar",
    short: "Splash",
    cost: 30,
    ammo: 2,
    delay: 1.05,
    damage: 21,
    color: "#f2974f",
    desc: "2 shells · blast ignores armor",
  },
  {
    name: "Cryo coil",
    short: "Frost",
    cost: 30,
    ammo: 1,
    delay: 0.85,
    damage: 11,
    color: "#a8edff",
    desc: "1 shell · slows a group 55%",
  },
  {
    name: "Rail driver",
    short: "Pierce",
    cost: 40,
    ammo: 3,
    delay: 1.65,
    damage: 39,
    color: "#c6a2fa",
    desc: "3 shells · pierces an armored line",
  },
];
export class Factory extends Game {
  constructor(seed, level, perks, saved) {
    super(seed, level, perks, saved);
    if (!saved)
      Object.assign(this.s, {
        hp: 100,
        gold: 55 + (perks.supplies || 0) * 5,
        wave: 1,
        spawn: 0,
        waveTime: 0,
        spawned: 0,
        enemies: [],
        bullets: [],
        packs: [],
        furnace: 1,
        produce: 0,
        route: 0,
        toggle: 0,
        guns: [
          { level: 1, ammo: 5, cd: 0, type: 0 },
          { level: 1, ammo: 5, cd: 0, type: 0 },
        ],
        selected: 0,
        refit: false,
        kills: 0,
        nextId: 0,
        focus: -1,
        pattern: Math.floor(this.random() * 4),
        heat: 0,
        over: 0,
        overCD: 0,
        waves: 5 + Math.min(2, Math.floor(((level - 1) % 5) / 2)),
      });
  }
  update(dt) {
    const s = this.s;
    if (s.refit) return;
    s.waveTime += dt;
    s.produce -= dt;
    s.over = Math.max(0, s.over - dt);
    s.overCD = Math.max(0, s.overCD - dt);
    if (s.produce <= 0) {
      s.produce += (1.3 / (1 + s.furnace * 0.32)) * (s.over > 0 ? 0.45 : 1);
      const lane = s.route === 0 ? s.toggle++ % 2 : s.route - 1;
      s.packs.push({ lane, t: 0 });
    }
    for (const p of s.packs) {
      p.t += dt * 1.25;
      if (p.t >= 1) {
        s.guns[p.lane].ammo = Math.min(16, s.guns[p.lane].ammo + 2);
      }
    }
    s.packs = s.packs.filter((p) => p.t < 1);
    const total = 5 + s.wave * 2 + Math.floor(this.difficulty * 0.65),
      rate = Math.max(0.62, 1.7 - s.wave * 0.1 - this.difficulty * 0.015);
    s.spawn -= dt;
    if (s.spawn <= 0 && s.spawned < total) {
      const lane =
          s.wave === 1 && s.spawned < 3
            ? 0
            : s.pattern === 1 && s.spawned % 3 !== 0
              ? 0
              : s.pattern === 2 && s.spawned % 3 !== 0
                ? 1
                : (s.spawned + s.wave + Math.floor(this.level / 3)) % 2,
        type =
          s.wave === s.waves && this.level >= 3 && s.spawned === 0
            ? 4
            : s.wave === 1
              ? 0
              : s.wave > 2 && this.level > 1 && s.spawned % 7 === 0
                ? 3
                : s.spawned % 5 === 0
                  ? 2
                  : s.wave > 2 && s.spawned % 3 === 0
                    ? 1
                    : 0;
      s.enemies.push({
        id: s.nextId++,
        attack: 2,
        x: lane ? 310 : 110,
        y: 75,
        lane,
        type,
        hp:
          (type === 4
            ? 245
            : type === 2
              ? 67
              : type === 1
                ? 17
                : type === 3
                  ? 37
                  : 31) *
          (1 + this.difficulty * 0.075 + s.wave * 0.08),
        max: 0,
        hit: 0,
        slow: 0,
      });
      const e = s.enemies.at(-1);
      e.max = e.hp;
      s.spawned++;
      s.spawn = rate;
    }
    for (let i = 0; i < 2; i++) {
      const g = s.guns[i],
        spec = GUNS[g.type];
      g.flash = Math.max(0, (g.flash || 0) - dt);
      g.cd -= dt;
      const candidates = s.enemies.filter(
        (e) => e.lane === i && e.y > 145 && e.y < 358 && e.hp > 0,
      );
      const target =
        candidates.find((e) => e.id === s.focus) ||
        candidates.sort((a, b) => b.y - a.y)[0];
      if (g.cd <= 0 && g.ammo >= spec.ammo && target) {
        g.ammo -= spec.ammo;
        g.cd = spec.delay;
        g.flash = 0.16;
        s.bullets.push({
          x: i ? 310 : 110,
          y: 350,
          tx: target.x,
          ty: target.y,
          type: g.type,
          damage: spec.damage * (1 + (g.level - 1) * 0.28),
          splash: g.type === 1,
        });
        this.audio("shot");
      }
    }
    for (const b of s.bullets) {
      b.y -= 480 * dt;
      if (b.y <= b.ty) {
        const hit = s.enemies.filter(
          (e) =>
            e.hp > 0 &&
            e.lane === (b.x > 210 ? 1 : 0) &&
            (b.type === 3
              ? e.y > 95 && e.y < 360
              : Math.abs(e.y - b.ty) <
                (b.splash ? 53 : b.type === 2 ? 43 : 23)),
        );
        for (const e of hit) {
          e.hp -=
            b.damage * (e.type === 2 && !b.splash && b.type !== 3 ? 0.7 : 1);
          if (b.type === 2) e.slow = 2.6;
          e.hit = 0.15;
        }
        this.emit(b.x, b.ty, GUNS[b.type || 0].color, b.splash ? 12 : 4);
        if (b.type === 3) {
          for (let y = 105; y < 350; y += 30)
            this.emit(b.x, y, "#d9b9ff", 2, 20);
        }
        b.dead = true;
      }
    }
    s.bullets = s.bullets.filter((b) => !b.dead && b.y > 0);
    for (const e of s.enemies) {
      e.hit = Math.max(0, e.hit - dt);
      e.slow = Math.max(0, (e.slow || 0) - dt);
      if (e.hp <= 0) {
        s.gold += e.type === 4 ? 20 : 2;
        s.kills++;
        s.score += 10;
        this.emit(e.x, e.y, "#ffda59", 7);
        this.audio("coin");
        e.dead = true;
        continue;
      }
      if (e.type === 3 && e.y >= 183) {
        e.attack -= dt;
        if (e.attack <= 0) {
          s.hp -= 4;
          e.attack = 2.4;
          this.burst(e.x, 374, C.red, 5);
        }
      } else
        e.y +=
          dt *
          (e.type === 1 ? 42 : e.type === 4 ? 13 : e.type === 2 ? 18 : 26) *
          (e.slow > 0 ? 0.45 : 1) *
          (1 + this.difficulty * 0.02);
      if (e.y > 365) {
        s.hp -= e.type === 4 ? 38 : e.type === 2 ? 14 : e.type === 1 ? 5 : 8;
        e.dead = true;
        this.burst(e.x, 370, "#ff6b6b");
      }
    }
    s.enemies = s.enemies.filter((e) => !e.dead);
    if (s.hp <= 0) {
      this.end(false, "The supply line was overrun");
      return;
    }
    if (s.spawned >= total && !s.enemies.length) {
      if (s.wave >= s.waves) {
        this.end(true, "Factory secured!");
        return;
      }
      s.wave++;
      s.pattern = Math.floor(this.random() * 4);
      s.waveTime = 0;
      s.spawned = 0;
      s.spawn = 2;
      s.gold += 17;
      this.toast(
        `Wave ${s.wave} · ${s.pattern === 1 ? "Left lane pressure" : s.pattern === 2 ? "Right lane pressure" : "Both lanes"} · +17 salvage`,
      );
      this.audio("build");
    }
  }
  pointer(x, y, type) {
    if (type === "down") {
      const enemy = this.s.enemies.find(
        (e) => Math.hypot(e.x - x, e.y - y) < 28,
      );
      if (enemy) {
        this.s.focus = enemy.id;
        this.audio("click");
        return;
      }
    }
    if (type === "down" && y > 285 && y < 410) {
      this.s.selected = x < 210 ? 0 : 1;
      this.audio("click");
    }
  }
  action(id) {
    const s = this.s,
      g = s.guns[s.selected];
    let cost;
    if (id === "refit") {
      s.refit = !s.refit;
      return;
    }
    if (id.startsWith("fit:")) {
      const t = Number(id.split(":")[1]);
      if (!GUNS[t] || t === g.type) return;
      const price = t === 0 ? 15 : GUNS[t].cost;
      if (s.gold >= price) {
        s.gold -= price;
        g.type = t;
        s.refit = false;
        this.burst(s.selected ? 310 : 110, 345, GUNS[t].color);
        this.audio("build");
      }
      return;
    }
    if (id === "route") {
      s.route = (s.route + 1) % 3;
      this.audio("click");
      return;
    }
    if (id === "over" && s.overCD <= 0) {
      s.over = 6;
      s.overCD = 20;
      this.audio("build");
      return;
    }
    if (id === "furnace") {
      cost = 35 + s.furnace * 18;
      if (s.gold >= cost) {
        s.gold -= cost;
        s.furnace++;
        this.burst(210, 460, C.gold);
      }
    }
    if (id === "gun") {
      cost = 25 + g.level * 22;
      if (s.gold >= cost) {
        s.gold -= cost;
        g.level++;
        this.burst(s.selected ? 310 : 110, 345, C.blue);
      }
    }
    if (id === "type") {
      cost = 25;
      if (s.gold >= cost) {
        s.gold -= cost;
        g.type = 1 - g.type;
        this.audio("build");
      }
    }
  }
  actions() {
    const s = this.s,
      g = s.guns[s.selected];
    if (s.refit)
      return [
        ...GUNS.map((v, i) => ({
          id: `fit:${i}`,
          label: `${v.name} · ${i === 0 ? 15 : v.cost}g`,
          sub: v.desc,
          disabled: g.type === i || s.gold < (i === 0 ? 15 : v.cost),
        })),
        {
          id: "refit",
          label: "Back to controls",
          sub: "Choose a different supply strategy",
        },
      ];
    return [
      {
        id: "route",
        label: ["Split supply", "Supply left", "Supply right"][s.route],
        sub: "Tap to redirect",
      },
      {
        id: "furnace",
        label: `Furnace ${s.furnace}`,
        sub: `↑ ${35 + s.furnace * 18} gold`,
        disabled: s.gold < 35 + s.furnace * 18,
      },
      {
        id: "gun",
        label: `${s.selected ? "Right" : "Left"} gun ${g.level}`,
        sub: `↑ ${25 + g.level * 22} gold`,
        disabled: s.gold < 25 + g.level * 22,
      },
      {
        id: "refit",
        label: `${GUNS[g.type].short} · Refit`,
        sub: "4 weapon types · keep gun level",
      },
      {
        id: "over",
        label: "Overdrive",
        sub: s.overCD > 0 ? `${Math.ceil(s.overCD)}s` : "Double supply · 6s",
        disabled: s.overCD > 0,
      },
    ];
  }
  stats() {
    return [
      ["BASE", `${Math.max(0, Math.round(this.s.hp))}%`],
      ["GOLD", this.s.gold],
      ["WAVE", `${this.s.wave}/${this.s.waves}`],
    ];
  }
  objective() {
    return this.s.refit
      ? `Factory paused · choose a weapon for the ${this.s.selected ? "right" : "left"} gun`
      : "Tap a gun to improve it · tap threats to focus fire";
  }
  details() {
    return [
      ["Enemies stopped", this.s.kills],
      ["Factory level", this.s.furnace],
      ["Base integrity", `${Math.max(0, this.s.hp)}%`],
    ];
  }
  render(c) {
    const s = this.s;
    const region = Math.floor((this.level - 1) / 5) % 6;
    const palette = [
      ["#496c72", "#223e4e"],
      ["#947962", "#594c4e"],
      ["#8cb2bb", "#526b83"],
      ["#648e8e", "#355569"],
      ["#916254", "#4f3646"],
      ["#7b729c", "#3a3b5d"],
    ][region];
    bg(c, ...palette, true);
    for (let i = 0; i < 4; i++) {
      rr(c, 192, 92 + i * 56, 36, 30, 4, "#182e3b66", null);
      circle(c, 210, 107 + i * 56, 7, palette[0]);
    }

    for (const x of [110, 310]) {
      rr(c, x - 41, 72, 82, 282, 13, "#30424b", "#72919a", 2);
      for (let y = 80; y < 345; y += 32)
        line(
          c,
          [
            [x - 34, y],
            [x + 34, y],
          ],
          "#5c798066",
          2,
        );
      rr(c, x - 46, 352, 92, 32, 5, "#edb94d");
      for (let i = 0; i < 6; i++)
        line(
          c,
          [
            [x - 44 + i * 17, 378],
            [x - 29 + i * 17, 354],
          ],
          "#2a3945",
          7,
        );
    }
    panel(
      c,
      `WAVE ${s.wave} / ${s.waves}`,
      s.pattern === 1
        ? "LEFT PRESSURE · route shells or overdrive"
        : s.pattern === 2
          ? "RIGHT PRESSURE · route shells or overdrive"
          : "BOTH LANES · keep both magazines fed",
    );
    for (let i = 0; i < 2; i++) {
      const x = i ? 310 : 110;
      line(
        c,
        [
          [210, 476],
          [210, 410],
          [x, 410],
          [x, 357],
        ],
        "#172a36",
        25,
      );
      line(
        c,
        [
          [210, 476],
          [210, 410],
          [x, 410],
          [x, 357],
        ],
        "#74888b",
        19,
      );
      for (let j = 0; j < 5; j++)
        arrow(
          c,
          210 + ((x - 210) * j) / 5,
          410,
          x > 210 ? 0 : Math.PI,
          "#dce7ce77",
          0.5,
        );
    }
    for (const p of s.packs) {
      const x = p.lane ? 310 : 110;
      let px = 210,
        py = 476 - p.t * 180;
      if (p.t > 0.37) {
        px = 210 + (x - 210) * Math.min(1, (p.t - 0.37) / 0.43);
        py = 410;
      }
      if (p.t > 0.8) {
        px = x;
        py = 410 - (p.t - 0.8) * 265;
      }
      rr(c, px - 6, py - 6, 12, 12, 3, C.gold);
    }
    for (const e of s.enemies) {
      creature(
        c,
        e.x,
        e.y,
        e.type,
        e.type === 4 ? 29 : e.type === 2 ? 22 : 18,
        s.time,
        e.hit
          ? "#ffffff"
          : e.slow > 0
            ? "#a1e7fa"
            : e.type === 4
              ? "#dd997b"
              : undefined,
      );
      bar(
        c,
        e.x - 19,
        e.y - 28,
        38,
        6,
        e.hp / e.max,
        e.type === 2 ? "#cfadee" : C.red,
      );
      if (e.type === 4) {
        rr(c, e.x - 25, e.y - 7, 50, 24, 5, "#8c788c");
        rr(c, e.x - 32, e.y - 14, 13, 18, 3, "#e1b458");
        rr(c, e.x + 19, e.y - 14, 13, 18, 3, "#e1b458");
        text(c, "SIEGE", e.x, e.y - 40, 10, C.gold);
      }
      if (e.type === 2) rr(c, e.x - 17, e.y, 15, 21, 4, "#859aad");
      if (e.type === 3) cannon(c, e.x, e.y, "#b89ce8", Math.PI / 2, 0.45);
      if (e.id === s.focus) circle(c, e.x, e.y, 29, "#ffffff00", C.gold, 2);
    }
    for (let i = 0; i < 2; i++) {
      const g = s.guns[i],
        x = i ? 310 : 110;
      if (s.selected === i) circle(c, x, 345, 36, "#ffffff00", "#ffde63", 3);
      const tint = GUNS[g.type].color;
      for (let j = 0; j < Math.min(4, g.level - 1); j++)
        rr(c, x - 33 + j * 17, 356, 13, 13, 3, tint);
      if (g.type === 1) {
        rr(c, x - 30, 326, 60, 29, 8, "#665467");
        circle(c, x, 332, 24, tint);
      }
      if (g.type === 2) {
        c.save();
        c.globalAlpha = 0.12 + Math.sin(s.time * 3) * 0.04;
        circle(c, x, 338, 43, tint, null);
        c.restore();
        for (let j = 0; j < 3; j++) {
          rr(c, x - 25, 320 + j * 8, 50, 4, 2, tint, null);
        }
      }
      if (g.type === 3) {
        rr(c, x - 15, 299, 8, 45, 3, tint);
        rr(c, x + 7, 299, 8, 45, 3, tint);
      }
      cannon(c, x, 345, tint, -Math.PI / 2, 1 + (g.level - 1) * 0.035);
      if (g.flash > 0) {
        c.save();
        c.globalAlpha = g.flash * 5;
        circle(c, x, 304, 12, tint, null);
        c.restore();
      }
      for (let j = 0; j < Math.min(8, g.ammo); j++)
        rr(c, x - 32 + j * 8, 391, 5, 10, 1, C.gold, null);
      label(
        c,
        g.ammo ? `${g.ammo} shells` : "EMPTY",
        x,
        300,
        g.ammo ? "#203d4e" : "#8d3947",
      );
      text(c, `LV ${g.level}`, x, 377, 12);
    }
    for (const b of s.bullets)
      circle(c, b.x, b.y, b.splash ? 7 : 4, GUNS[b.type || 0].color, null);
    if (s.furnace >= 2) {
      rr(c, 137, 450, 13, 57, 4, "#93a9a9");
      rr(c, 270, 449, 13, 58, 4, "#93a9a9");
    }
    if (s.furnace >= 3) {
      rr(c, 164, 423, 20, 24, 4, "#597985");
      rr(c, 161, 420, 26, 7, 2, "#becdba");
    }
    if (s.furnace >= 4) {
      gear(c, 286, 488, 13, "#c4c6a5", -s.time * 2);
      gear(c, 133, 482, 13, "#c4c6a5", s.time * 2);
    }
    if (s.furnace >= 5) {
      c.save();
      c.globalAlpha = 0.16;
      circle(c, 210, 478, 75, "#ffdc77", null);
      c.restore();
    }
    rr(c, 150, 437, 120, 91, 12, "#6d8991", "#152331", 4);
    rr(c, 162, 450, 40, 56, 6, "#f7aa43");
    gear(c, 228, 475, 25, "#a6d4d8", s.time * (s.over ? 4 : 1));
    circle(c, 182, 470, 12, s.over ? "#ffeb8a" : "#ff7042");
    text(c, `FURNACE ${s.furnace}`, 210, 520, 14);
    bar(c, 145, 541, 130, 8, s.hp / 100);
  }
}
