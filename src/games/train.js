import { Game, clamp, lerp } from "../core.js";
import {
  bg,
  rr,
  text,
  circle,
  line,
  bar,
  panel,
  railBandit,
  cannon,
  coin,
  rock,
  C,
  poly,
  label,
  shadow,
  arrow,
  tree,
} from "../draw.js";
export const TYPES = ["Gun", "Shield", "Cargo", "Repair", "Mortar", "Railgun"];
const ROLES = [
  "15 damage / 0.68s",
  "+32 shield · regenerates",
  "+1 salvage per defeated foe",
  "+0.55 hull each second",
  "22 blast damage / 1.4s",
  "42 piercing damage / 1.65s",
];
const COLORS = [
  "#e9ad53",
  "#6bcbd5",
  "#ad91d2",
  "#8dca68",
  "#f19a65",
  "#b3b7fb",
];
const TRACKS = [103, 210, 317];
export class Train extends Game {
  constructor(seed, level, perks, saved) {
    super(seed, level, perks, saved);
    if (!saved)
      Object.assign(this.s, {
        hp: 100,
        shield: 30,
        wagons: [0, 0, 1, 2],
        selected: 0,
        enemies: [],
        shots: [],
        spawn: 1.5,
        leg: 1,
        legTime: 0,
        station: true,
        departure: true,
        focus: -1,
        kills: 0,
        gold: 55 + (perks.spares || 0) * 5,
        boost: 0,
        boostCD: 0,
        fire: 0,
        gunsCD: [0, 0, 0, 0],
        refit: false,
        distance: 0,
        route: 0,
        nextId: 0,
        track: 1,
        x: 210,
        barrages: [],
        barrageCD: 10,
        dodged: 0,
        smoke: [],
        notice: 0,
        captainSpawned: false,
      });
  }
  markTrack(track, delay = 1.7, damage = 28) {
    const s = this.s,
      x = TRACKS[track];
    const marked = new Set(
      s.barrages.filter((b) => b.timer > 0).map((b) => b.x),
    );
    // There must always be a safe rail. Steam surge is an extra escape, not a toll.
    if (marked.size >= 2 && !marked.has(x)) return;
    if (s.barrages.some((b) => b.x === x && b.timer > 0.4)) return;
    s.barrages.push({ x, timer: delay, duration: delay, damage, hit: false });
    this.audio("alert");
  }
  damage(amount) {
    const s = this.s;
    if (s.boost > 0) {
      s.dodged++;
      this.emit(s.x, 290, "#b9f3ff", 12);
      return;
    }
    const absorbed = Math.min(s.shield, amount);
    s.shield -= absorbed;
    s.hp -= amount - absorbed;
    this.burst(s.x, 275, C.red, 10);
  }
  update(dt) {
    const s = this.s;
    if (s.station) return;
    s.legTime += dt;
    s.distance += dt * (s.boost > 0 ? 2 : 1);
    s.x = lerp(s.x, TRACKS[s.track], Math.min(1, dt * 8));
    s.boost = Math.max(0, s.boost - dt);
    s.boostCD = Math.max(0, s.boostCD - dt);
    s.notice = Math.max(0, s.notice - dt);
    const shields = s.wagons.filter((v) => v === 1).length;
    s.shield = Math.min(shields * 32, s.shield + dt * shields * 0.55);
    s.hp = Math.min(
      100,
      s.hp + dt * s.wagons.filter((v) => v === 3).length * 0.55,
    );
    s.barrageCD -= dt;
    if (s.barrageCD <= 0) {
      s.barrageCD = Math.max(5.2, 10 - this.difficulty * 0.15 - s.leg * 0.7);
      if (!s.enemies.some((e) => e.type === 4))
        this.markTrack(s.track, 1.7, 25 + s.leg * 3);
    }
    for (const b of s.barrages) {
      b.timer -= dt;
      if (b.timer <= 0 && !b.hit) {
        b.hit = true;
        if (Math.abs(s.x - b.x) < 45) this.damage(b.damage || 25 + s.leg * 3);
        else {
          s.dodged++;
          s.score += 8;
          this.audio("coin");
        }
        this.burst(b.x, 310, "#f4a556", 20);
      }
    }
    s.barrages = s.barrages.filter((b) => b.timer > -0.45);
    s.spawn -= dt;
    if (s.spawn <= 0 && s.legTime < 27) {
      const type =
        s.nextId % 7 === 0 && this.level > 2
          ? 3
          : s.nextId % 6 === 0 && s.nextId > 0
            ? 2
            : s.nextId % 4 === 0
              ? 1
              : 0;
      const hp =
        (type === 3 ? 88 : type === 1 ? 66 : type === 2 ? 34 : 34) *
        (1 + this.difficulty * 0.045 + s.leg * 0.065);
      s.enemies.push({
        id: s.nextId++,
        x: 40 + this.random() * 340,
        y: 74,
        hp,
        max: hp,
        type,
        attack: 1.4,
        flash: 0,
      });
      s.spawn = Math.max(
        0.72,
        1.65 - s.leg * 0.1 - this.difficulty * 0.018 - (s.route ? 0.28 : 0),
      );
    }
    if (s.leg === 3 && s.legTime > 20 && !s.captainSpawned) {
      s.captainSpawned = true;
      const hp = 310 + this.difficulty * 35;
      s.enemies.push({
        id: s.nextId++,
        x: 210,
        y: 105,
        hp,
        max: hp,
        type: 4,
        attack: 3,
        flash: 0,
        salvo: 0,
      });
      this.audio("alert");
      this.toast("Iron Vulture · watch its marked rails!");
    }
    const live = s.enemies.filter((e) => e.hp > 0);
    for (let i = 0; i < 4; i++) {
      s.gunsCD[i] -= dt;
      const type = s.wagons[i];
      if (![0, 4, 5].includes(type) || s.gunsCD[i] > 0 || !live.length)
        continue;
      const target =
        live.find((e) => e.id === s.focus) ||
        [...live].sort((a, b) => b.y - a.y)[0];
      s.shots.push({
        x: s.x,
        y: 316 + i * 52,
        tx: target.x,
        ty: target.y,
        t: 0,
        id: target.id,
        type,
      });
      s.gunsCD[i] =
        (type === 4 ? 1.4 : type === 5 ? 1.65 : 0.68) * (s.boost > 0 ? 0.5 : 1);
      this.audio("shot");
    }
    for (const b of s.shots) {
      b.t += dt * 4.6;
      if (b.t >= 1) {
        const e = s.enemies.find((e) => e.id === b.id);
        if (e) {
          const targets =
            b.type === 4
              ? s.enemies.filter(
                  (v) => v.hp > 0 && Math.hypot(v.x - e.x, v.y - e.y) < 68,
                )
              : b.type === 5
                ? s.enemies.filter((v) => v.hp > 0 && Math.abs(v.x - e.x) < 27)
                : [e];
          for (const target of targets) {
            target.hp -=
              (b.type === 4 ? 22 : b.type === 5 ? 42 : 15) *
              (target.type === 3 && b.type === 0 ? 0.5 : 1);
            target.flash = 0.12;
          }
          this.emit(e.x, e.y, COLORS[b.type || 0], b.type === 4 ? 15 : 4);
          if (b.type === 4) this.audio("break");
        }
        b.dead = true;
      }
    }
    s.shots = s.shots.filter((b) => !b.dead);
    for (const e of s.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      if (e.hp <= 0) {
        e.dead = true;
        s.kills++;
        s.gold +=
          (e.type === 4 ? 35 : 2) + s.wagons.filter((v) => v === 2).length;
        s.score += e.type === 4 ? 150 : 15;
        this.burst(e.x, e.y, "#ffd77a", 10);
        continue;
      }
      if (e.type === 4) {
        e.x = 210 + Math.sin(s.time * 0.9) * 92;
        e.y = Math.min(135, e.y + dt * 20);
        e.attack -= dt;
        if (e.attack <= 0) {
          e.attack = e.hp < e.max * 0.5 ? 3.4 : 4.8;
          this.markTrack(s.track, 1.8, 35);
          if (this.level >= 5 || e.hp < e.max * 0.5)
            this.markTrack((s.track + (e.salvo++ % 2 ? 1 : 2)) % 3, 1.8, 35);
        }
        continue;
      }
      if (e.type === 1 && e.y >= 179) {
        e.y = 179;
        e.attack -= dt;
        if (e.attack <= 0) {
          e.attack = 4.5;
          this.markTrack(s.track, 1.45, 20);
        }
        continue;
      }
      e.y += dt * (e.type === 1 ? 22 : e.type === 2 ? 40 : 29);
      if (e.y > 160) e.x = lerp(e.x, s.x, dt * (e.type === 2 ? 1.2 : 0.55));
      if (e.y > 245) {
        e.y = 245;
        e.attack -= dt;
        if (e.attack <= 0) {
          this.damage(e.type === 1 ? 14 : e.type === 2 ? 11 : 7);
          e.attack = e.type === 1 ? 2 : 1.3;
        }
      }
    }
    s.enemies = s.enemies.filter((e) => !e.dead);
    if (s.hp <= 0) {
      this.end(false, "Convoy recovered · change your route or loadout");
      return;
    }
    if (s.legTime >= 27 && !s.enemies.length) {
      if (s.leg === 3) {
        this.end(true, "Express delivered!");
        return;
      }
      s.station = true;
      s.barrages = [];
      s.gold += 25;
      s.hp = Math.min(100, s.hp + 12);
      this.audio("build");
    }
  }
  pointer(x, y, type) {
    if (type !== "down") return;
    const s = this.s;
    const enemy = s.enemies.find((e) => Math.hypot(e.x - x, e.y - y) < 31);
    if (enemy) {
      s.focus = enemy.id;
      this.audio("click");
      return;
    }
    if (y > 295 && y < 516 && Math.abs(x - s.x) < 45) {
      s.selected = clamp(Math.floor((y - 295) / 52), 0, 3);
      this.audio("click");
    }
  }
  action(id) {
    const s = this.s;
    if (id === "left") {
      s.track = Math.max(0, s.track - 1);
      this.audio("click");
    }
    if (id === "right") {
      s.track = Math.min(2, s.track + 1);
      this.audio("click");
    }
    if (id === "boost" && s.boostCD <= 0 && !s.station) {
      s.boost = 2.4;
      s.boostCD = 14;
      this.audio("build");
    }
    if (id === "refit" && s.station) {
      s.refit = !s.refit;
      return;
    }
    if (id.startsWith("fit:") && s.station && s.gold >= 25) {
      const type = Number(id.split(":")[1]);
      if (
        Number.isInteger(type) &&
        type >= 0 &&
        type < TYPES.length &&
        type !== s.wagons[s.selected]
      ) {
        s.gold -= 25;
        s.wagons[s.selected] = type;
        s.refit = false;
        this.audio("build");
      }
    }
    if (s.station && (id === "safe" || id === "risk")) {
      if (!s.wagons.some((v) => [0, 4, 5].includes(v))) {
        this.toast("Fit at least one weapon before departing");
        return;
      }
      s.route = id === "risk" ? 1 : 0;
      if (!s.departure) s.leg++;
      s.departure = false;
      s.legTime = 0;
      s.station = false;
      s.spawn = 1;
      s.barrageCD = 7;
      if (s.route) s.gold += 30;
      this.audio("click");
    }
  }
  actions() {
    const s = this.s;
    if (s.station && s.refit)
      return [
        ...TYPES.map((type, i) => ({
          id: `fit:${i}`,
          label: `${type} · 25`,
          sub: ROLES[i],
          disabled: s.gold < 25 || s.wagons[s.selected] === i,
        })),
        { id: "refit", label: "Back to route", sub: "Keep this loadout" },
      ];
    if (s.station)
      return [
        {
          id: "refit",
          label: `Refit ${TYPES[s.wagons[s.selected]]}`,
          sub: "Tap a wagon · 6 options",
        },
        {
          id: "safe",
          label: s.departure ? "Depart" : "Valley route",
          sub: s.departure ? "Start your expedition" : "Normal encounter",
          disabled: !s.wagons.some((v) => [0, 4, 5].includes(v)),
        },
        ...(!s.departure
          ? [
              {
                id: "risk",
                label: "Bandit pass",
                sub: "+30 gold · more threats",
                disabled: !s.wagons.some((v) => [0, 4, 5].includes(v)),
              },
            ]
          : []),
      ];
    return [
      {
        id: "left",
        label: "← Switch track",
        sub: "Dodge marked rails",
        disabled: s.track === 0,
      },
      {
        id: "boost",
        label: "Steam surge",
        sub:
          s.boostCD > 0
            ? `${Math.ceil(s.boostCD)}s`
            : "Invulnerable · fast fire",
        disabled: s.boostCD > 0,
      },
      {
        id: "right",
        label: "Switch track →",
        sub: "Dodge marked rails",
        disabled: s.track === 2,
      },
    ];
  }

  stats() {
    return [
      ["HULL", `${Math.max(0, Math.ceil(this.s.hp))}%`],
      ["LEG", `${this.s.leg}/3`],
      ["GOLD", this.s.gold],
    ];
  }
  objective() {
    return this.s.station
      ? "Tap a wagon to refit · then choose the next route"
      : this.s.barrages.some((b) => b.timer > 0)
        ? "ARTILLERY! Switch away from the marked track"
        : "Tap enemies to focus fire · switch tracks to dodge artillery";
  }
  details() {
    return [
      ["Bandits stopped", this.s.kills],
      ["Attacks dodged", this.s.dodged],
      ["Salvage delivered", this.s.gold],
    ];
  }
  reward() {
    return super.reward() + (this.s.win ? Math.floor(this.s.gold * 0.15) : 0);
  }
  stars() {
    return this.s.win ? (this.s.hp > 75 ? 3 : this.s.hp > 35 ? 2 : 1) : 0;
  }
  render(c) {
    const s = this.s;
    const region = Math.floor((this.level - 1) / 5) % 6;
    const palette = [
      ["#bca477", "#7f8060"],
      ["#c69778", "#9c6c59"],
      ["#89ac8b", "#4c766a"],
      ["#c7dbda", "#8babbd"],
      ["#b58075", "#665464"],
      ["#9b97b6", "#5d648a"],
    ][region];
    bg(c, ...palette);
    for (const x of TRACKS) {
      for (let y = -50; y < 590; y += 36) {
        const yy = y + ((s.distance * 48) % 36);
        line(
          c,
          [
            [x - 27, yy],
            [x + 27, yy],
          ],
          "#665d48",
          7,
        );
      }
      line(
        c,
        [
          [x - 19, 75],
          [x - 19, 560],
        ],
        "#364850",
        6,
      );
      line(
        c,
        [
          [x + 19, 75],
          [x + 19, 560],
        ],
        "#364850",
        6,
      );
      line(
        c,
        [
          [x - 19, 75],
          [x - 19, 560],
        ],
        "#b3bdab",
        2,
      );
      line(
        c,
        [
          [x + 19, 75],
          [x + 19, 560],
        ],
        "#b3bdab",
        2,
      );
    }
    for (let i = 0; i < 8; i++) {
      const x = i % 2 ? 394 : 24,
        y = ((i * 91 + s.distance * 27) % 610) - 25;
      if (i % 3 === 0) tree(c, x, y, 0.6, region === 2 ? 1 : 0);
      else rock(c, x, y, 0.6, region === 1 ? "#9ebbc4" : "#999079");
    }
    for (const b of s.barrages) {
      if (b.timer > 0) {
        c.globalAlpha = 0.25 + Math.sin(s.time * 17) * 0.1;
        rr(c, b.x - 38, 226, 76, 322, 10, "#ed5353", null);
        c.globalAlpha = 1;
        circle(c, b.x, 283, 24, "#dd584a44", "#ffe5a4", 2);
        text(c, "!", b.x, 282, 28);
        bar(c, b.x - 26, 247, 52, 6, 1 - b.timer / (b.duration || 1.7), C.red);
      } else {
        circle(
          c,
          b.x,
          305,
          Math.max(1, (0.45 + b.timer) * 150),
          "#ffb45344",
          null,
        );
      }
    }
    for (const e of s.enemies) {
      if (e.type === 4) {
        shadow(c, e.x, e.y + 39, 56, 12);
        poly(
          c,
          [
            [e.x - 64, e.y + 8],
            [e.x - 25, e.y - 14],
            [e.x + 25, e.y - 14],
            [e.x + 64, e.y + 8],
            [e.x + 31, e.y + 20],
            [e.x - 31, e.y + 20],
          ],
          e.flash ? "#fff0cf" : "#6e728f",
        );
        rr(c, e.x - 26, e.y - 32, 52, 63, 20, e.flash ? "#fff0cf" : "#b35f58");
        rr(c, e.x - 19, e.y - 20, 38, 19, 7, "#34354f");
        circle(c, e.x - 8, e.y - 11, 4, "#ffda69", null);
        circle(c, e.x + 8, e.y - 11, 4, "#ffda69", null);
        for (const dx of [-44, 44]) {
          circle(c, e.x + dx, e.y + 9, 13, "#d0a269");
          line(
            c,
            [
              [e.x + dx - 17, e.y + 9 + Math.sin(s.time * 30) * 5],
              [e.x + dx + 17, e.y + 9 - Math.sin(s.time * 30) * 5],
            ],
            "#30334a",
            4,
          );
        }
        bar(c, e.x - 44, e.y - 45, 88, 7, e.hp / e.max, C.red);
        text(c, "IRON VULTURE", e.x, e.y - 56, 12, "#ffdb87");
        if (e.id === s.focus) circle(c, e.x, e.y, 48, "#00000000", C.gold, 2);
        continue;
      }
      railBandit(c, e.x, e.y, e.type, s.time, e.flash > 0);
      bar(c, e.x - 20, e.y - 44, 40, 6, e.hp / e.max, C.red);
      if (e.id === s.focus) circle(c, e.x, e.y, 31, "#00000000", C.gold, 2);
    }
    shadow(c, s.x + 7, 507, 36, 10);
    rr(c, s.x - 22, 250, 44, 58, 13, "#dca146", C.ink, 3);
    rr(c, s.x - 16, 266, 32, 27, 7, "#294e60");
    circle(c, s.x, 254, 11, "#516a71");
    poly(
      c,
      [
        [s.x - 26, 251],
        [s.x, 234],
        [s.x + 26, 251],
      ],
      "#cab98a",
    );
    for (let i = 0; i < 4; i++) {
      const y = 324 + i * 52,
        t = s.wagons[i];
      line(
        c,
        [
          [s.x, y - 28],
          [s.x, y - 40],
        ],
        "#1f3039",
        6,
      );
      for (const dx of [-24, 24])
        rr(c, s.x + dx - 4, y - 15, 8, 28, 3, "#223641");
      rr(
        c,
        s.x - 25,
        y - 23,
        50,
        46,
        8,
        COLORS[t],
        i === s.selected ? "#fff0a1" : C.ink,
        3,
      );
      rr(c, s.x - 20, y - 19, 40, 6, 3, "#ffffff44", null);
      if (t === 0) cannon(c, s.x, y, "#e5ab5f", -Math.PI / 2, 0.5);
      if (t === 4) {
        circle(c, s.x, y, 17, "#5e6173");
        circle(c, s.x, y - 3, 11, "#282f49");
        circle(c, s.x, y - 3, 5, "#efb06c");
      }
      if (t === 5) {
        rr(c, s.x - 10, y - 25, 7, 36, 3, "#d0cfff");
        rr(c, s.x + 3, y - 25, 7, 36, 3, "#d0cfff");
        circle(c, s.x, y + 3, 6, "#7c75bd");
      }
      if (t === 1)
        poly(
          c,
          [
            [s.x - 13, y - 13],
            [s.x + 13, y - 13],
            [s.x + 11, y + 6],
            [s.x, y + 15],
            [s.x - 11, y + 6],
          ],
          "#d2f3e9",
        );
      if (t === 2) {
        rr(c, s.x - 14, y - 13, 28, 25, 4, "#745340");
        coin(c, s.x, y, 9);
      }
      if (t === 3) text(c, "+", s.x, y, 31, "#efffc9");
      if (s.station) label(c, TYPES[t], s.x < 200 ? s.x + 64 : s.x - 64, y);
    }
    for (let i = 0; i < 5; i++) {
      const age = (s.time * 1.7 + i * 0.24) % 1;
      circle(
        c,
        s.x + Math.sin(i + age * 3) * 10,
        245 - age * 65,
        4 + age * 8,
        `rgba(236,229,206,${(1 - age) * 0.35})`,
        null,
      );
    }
    for (const b of s.shots) {
      const x = b.x + (b.tx - b.x) * b.t,
        y = b.y + (b.ty - b.y) * b.t;
      line(
        c,
        [
          [x, y + 8],
          [x, y],
        ],
        COLORS[b.type || 0],
        b.type === 4 ? 7 : b.type === 5 ? 5 : 3,
      );
    }
    if (s.boost > 0) {
      for (let i = 0; i < 6; i++)
        line(
          c,
          [
            [s.x - 35 + i * 14, 491],
            [s.x - 35 + i * 14, 520],
          ],
          "#b9effa99",
          3,
        );
    }
    bar(c, 61, 541, 298, 9, s.hp / 100);
    bar(c, 61, 553, 298, 4, s.shield / 64, C.blue);
    panel(
      c,
      s.station
        ? s.departure
          ? "THE DEPOT"
          : "WAYSTATION"
        : `${["PRAIRIE LINE", "COPPER CANYON", "PINE EXPRESS", "SNOWBOUND", "EMBER ROUTE", "LAST EXPRESS"][region]} · ${s.leg}`,
      s.station
        ? "Choose a wagon, then refit it below"
        : "Three tracks. One way home.",
    );
    if (s.station) {
      rr(c, 48, 111, 324, 96, 17, "#20364beb", "#e7cc88", 3);
      text(c, "THE SIGNAL IS GREEN", 210, 141, 24);
      text(
        c,
        s.refit
          ? "Gun · mortar · rail · shield · cargo · repair"
          : "Tap a car to refit · cargo boosts your final reward",
        210,
        177,
        12,
      );
    }
  }
}
