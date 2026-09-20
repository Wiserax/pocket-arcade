import { Game, clamp } from "../core.js";
import {
  bg,
  rr,
  text,
  circle,
  line,
  panel,
  tree,
  creature,
  gear,
  star,
  C,
  poly,
  shadow,
} from "../draw.js";
const THEMES = [
  ["BAKERY", "#ddae76", "#e49d9a"],
  ["GARDEN", "#95c393", "#aaca83"],
  ["WORKSHOP", "#94b6be", "#a0a9b9"],
  ["TEAHOUSE", "#a998c4", "#d5aebd"],
  ["SUNROOM", "#c6cc82", "#edcc98"],
  ["LAKESIDE STUDIO", "#83b8ca", "#b1cbd0"],
];
const ITEM_NAMES = [
  ["Oven", "Table", "Herbs", "Pastries", "Chair", "Lamp"],
  ["Fountain", "Bench", "Flowers", "Tools", "Seat", "Lantern"],
  ["Forge", "Workbench", "Cactus", "Parts", "Stool", "Lamp"],
  ["Kettle", "Tea table", "Bonsai", "Tea jars", "Cushion", "Lantern"],
  ["Birdbath", "Table", "Fern", "Books", "Armchair", "Sun lamp"],
  ["Easel", "Desk", "Reeds", "Paints", "Stool", "Lamp"],
];
const FINISHES = [
  { name: "Honey", wood: "#dcb580", accent: "#ffdfa0", pot: "#c28c67" },
  { name: "Sea glass", wood: "#85b8bd", accent: "#bbebdf", pot: "#709ba8" },
  { name: "Berry", wood: "#ca99af", accent: "#e6bce6", pot: "#aa789c" },
];
const PAINTS = [
  null,
  ["#94b6a0", "#bed1a2", "#d5dbb5", "#bdcaa2"],
  ["#bc8d9d", "#e1b3b1", "#ecd4c7", "#dcbeb9"],
  ["#778aa9", "#a6b8cf", "#cbd5de", "#b6c6d2"],
];
function iso(x, y) {
  return { x: 210 + (x - y) * 34, y: 255 + (x + y) * 18 };
}
export class Worlds extends Game {
  constructor(seed, level, perks, saved) {
    super(seed, level, perks, saved);
    if (!saved) {
      const shape = (level - 1) % 5;
      const floor = [];
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 5; x++) {
          if (shape === 1 && x > 2 && y > 2) continue;
          if (shape === 2 && ((x === 0 && y === 4) || (x === 4 && y === 0)))
            continue;
          if (shape === 3 && x === 2 && y === 2) continue;
          if (shape === 4 && x + y > 6) continue;
          floor.push({ x, y });
        }
      const dirty = [...floor].sort(() => 0);
      for (let i = dirty.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [dirty[i], dirty[j]] = [dirty[j], dirty[i]];
      }
      Object.assign(this.s, {
        floor,
        theme: Math.floor((level - 1) / 5) % THEMES.length,
        mode: "clean",
        dirt: dirty.slice(0, 12).map((p) => ({ ...p, hp: 1 })),
        repairs: [
          floor[0],
          floor[Math.floor(floor.length / 2)],
          floor.at(-1),
        ].map((p) => ({ ...p, hp: 3 })),
        items: [],
        selected: 0,
        placed: 0,
        cleaned: 0,
        fixes: 0,
        touches: 0,
        brushTime: 0,
        palette: 0,
        styles: [0, 0, 0, 0, 0, 0],
        flips: [false, false, false, false, false, false],
      });
    }
  }
  names() {
    return ITEM_NAMES[this.s.theme ?? 0];
  }
  hasTile(x, y) {
    return this.s.floor.some((p) => p.x === x && p.y === y);
  }
  animate(dt) {
    if (this.s.done) this.s.time += dt * 0.2;
  }
  pointer(x, y, type) {
    const s = this.s;
    if (type === "up") return;
    if (s.mode === "clean") {
      for (const d of s.dirt)
        if (d.hp > 0) {
          const p = iso(d.x, d.y);
          if (Math.hypot(p.x - x, p.y - y) < 36 + (this.perks.brush || 0) * 4) {
            d.hp = 0;
            s.cleaned++;
            s.score += 8;
            this.emit(p.x, p.y, "#fff2c7", 10);
            this.audio("hit");
          }
        }
      if (s.cleaned === 12) {
        s.mode = "repair";
        this.toast("All clean! Tap the three broken mechanisms");
      }
    } else if (s.mode === "repair" && type === "down") {
      for (const r of s.repairs) {
        const p = iso(r.x, r.y);
        if (r.hp > 0 && Math.hypot(p.x - x, p.y - y) < 38) {
          r.hp--;
          s.fixes++;
          s.score += 10;
          this.burst(p.x, p.y, C.gold, 8);
          break;
        }
      }
      if (s.fixes === 9) {
        s.mode = "decorate";
        this.toast("Make it yours · choose an item, then a floor tile");
      }
    } else if (s.mode === "decorate" && type === "down") {
      if (y > 475) {
        const i = clamp(Math.floor(x / 70), 0, 5);
        s.selected = i;
        this.audio("click");
        return;
      }
      const gx = Math.round((x - 210) / 68 + (y - 255) / 36),
        gy = Math.round((y - 255) / 36 - (x - 210) / 68);
      if (!this.hasTile(gx, gy)) return;
      const occupied = s.items.find(
        (i) => i.x === gx && i.y === gy && i.type !== s.selected,
      );
      if (occupied) {
        s.selected = occupied.type;
        this.toast(
          `Selected ${this.names()[s.selected]} · tap a free tile to move it`,
        );
        return;
      }
      const item = s.items.find((i) => i.type === s.selected);
      if (item) {
        item.x = gx;
        item.y = gy;
      } else {
        s.items.push({ x: gx, y: gy, type: s.selected });
        s.placed++;
        s.score += 20;
      }
      this.burst(x, y, "#e2f9b5", 9);
      this.audio("build");
      if (s.placed < 6)
        s.selected = Array.from({ length: 6 }, (_, i) => i).find(
          (i) => !s.items.some((v) => v.type === i),
        );
    }
  }
  action(id) {
    if (id === "paint" && this.s.mode === "decorate") {
      this.s.palette = (this.s.palette + 1) % 4;
      this.audio("build");
      this.emit(210, 200, "#fff0bd", 22);
    }
    if (id === "style" && this.s.mode === "decorate") {
      const i = this.s.selected;
      this.s.styles[i] = (this.s.styles[i] + 1) % 3;
      const item = this.s.items.find((p) => p.type === i);
      if (item) {
        const p = iso(item.x, item.y);
        this.emit(p.x, p.y, "#ffe5d4", 12);
      }
      this.audio("build");
    }
    if (id === "flip" && this.s.mode === "decorate") {
      this.s.flips[this.s.selected] = !this.s.flips[this.s.selected];
      this.audio("click");
    }
    if (id === "finish" && this.s.placed === 6)
      this.end(true, "A little world brought to life!");
    if (id === "shuffle" && this.s.placed) {
      const used = new Set();
      for (const item of this.s.items) {
        let x, y, key;
        do {
          const tile =
            this.s.floor[Math.floor(this.random() * this.s.floor.length)];
          x = tile.x;
          y = tile.y;
          key = x + "," + y;
        } while (used.has(key));
        used.add(key);
        item.x = x;
        item.y = y;
      }
      this.audio("build");
    }
  }
  actions() {
    return [
      ...(this.s.mode === "decorate"
        ? [
            {
              id: "paint",
              label: "Paint the room",
              sub: [
                "Original palette",
                "Sage garden",
                "Rose clay",
                "Blue evening",
              ][this.s.palette],
            },
            {
              id: "style",
              label: FINISHES[this.s.styles[this.s.selected]].name,
              sub: `Change ${this.names()[this.s.selected].toLowerCase()} finish`,
            },
            {
              id: "flip",
              label: "Turn furniture",
              sub: this.names()[this.s.selected],
            },
          ]
        : []),
      {
        id: "shuffle",
        label: "Try a new layout",
        sub: "Keep all your furniture",
        disabled: !this.s.placed,
      },
      {
        id: "finish",
        label: "Open the doors",
        sub:
          this.s.placed === 6
            ? "Welcome your first guests"
            : `${this.s.placed}/6 furnishings`,
        disabled: this.s.placed < 6,
      },
    ];
  }
  stats() {
    return [
      ["CLEAN", `${this.s.cleaned}/12`],
      ["REPAIR", `${this.s.fixes}/9`],
      ["FURNISH", `${this.s.placed}/6`],
    ];
  }
  objective() {
    return this.s.mode === "clean"
      ? "Rub the dusty floor to reveal your little world"
      : this.s.mode === "repair"
        ? "Tap the broken mechanisms three times to repair them"
        : "Choose furniture below · tap any free tile to place it";
  }
  details() {
    return [
      ["Dust swept", this.s.cleaned],
      ["Mechanisms repaired", Math.floor(this.s.fixes / 3)],
      ["Furniture arranged", this.s.placed],
    ];
  }
  item(c, x, y, type, scale = 1) {
    c.save();
    c.translate(x, y);
    c.scale(scale, scale);
    if (this.s.flips?.[type]) c.scale(-1, 1);
    const finish = FINISHES[this.s.styles?.[type] || 0];
    shadow(c, 0, 4, 20);
    const theme = this.s.theme ?? 0;
    if (type === 0 && (theme === 0 || theme === 2)) {
      rr(c, -17, -29, 34, 35, 5, finish.pot);
      rr(c, -11, -20, 22, 20, 5, "#4c3e46");
      circle(c, 0, -9, 7, "#ffc361", null);
    }
    if (type === 0 && (theme === 1 || theme === 4)) {
      circle(c, 0, 0, 24, finish.wood, "#647d92", 4);
      circle(c, 0, -4, 18, "#87dce5", null);
      rr(c, -5, -32, 10, 32, 4, "#bfd2bf");
      circle(c, 0, -34, 11, "#d7e1c7");
      for (let i = 0; i < 5; i++) {
        const t = (this.s.time * 0.9 + i / 5) % 1;
        circle(
          c,
          Math.sin(i * 5) * 15 * t,
          -30 + 28 * t * t,
          2.5,
          "#d6ffff",
          null,
        );
      }
    }
    if (type === 0 && theme === 3) {
      circle(c, 0, -11, 20, finish.wood);
      rr(c, -11, -32, 22, 8, 3, "#cfb67b");
      line(
        c,
        [
          [14, -20],
          [27, -27],
          [31, -38],
        ],
        "#8bb6a1",
        8,
      );
      circle(c, -20, -17, 10, "#ffffff00", "#cfb67b", 5);
      for (let i = 0; i < 3; i++)
        circle(
          c,
          24 + Math.sin(this.s.time + i) * 4,
          -42 - ((this.s.time * 12 + i * 9) % 20),
          4,
          "#ffffff55",
          null,
        );
    }
    if (type === 0 && theme === 5) {
      line(
        c,
        [
          [-16, 12],
          [0, -47],
          [17, 12],
        ],
        "#906347",
        5,
      );
      rr(c, -21, -43, 42, 36, 3, "#fff0c5");
      poly(
        c,
        [
          [-17, -11],
          [-2, -34],
          [7, -21],
          [17, -29],
          [17, -11],
        ],
        "#74b997",
        null,
      );
      circle(c, 12, -34, 5, "#f7ce58", null);
      rr(c, -24, -7, 48, 5, 1, "#8b6143");
    }
    if (type === 1) {
      line(
        c,
        [
          [-13, -5],
          [-13, 13],
        ],
        "#82583f",
        5,
      );
      line(
        c,
        [
          [13, -5],
          [13, 13],
        ],
        "#82583f",
        5,
      );
      poly(
        c,
        [
          [-24, -10],
          [0, -22],
          [24, -10],
          [0, 2],
        ],
        finish.wood,
      );
    }
    if (type === 2) {
      rr(c, -10, -5, 20, 17, 3, finish.pot);
      circle(c, 0, -15, 16, "#7db978");
      circle(c, -10, -17, 10, "#a8d589");
      if (theme === 1 || theme === 3)
        for (let i = 0; i < 4; i++)
          circle(
            c,
            Math.sin(i * 3) * 12,
            -22 + Math.cos(i * 3) * 8,
            5,
            ["#ff9faf", "#ffe18c"][i % 2],
            null,
          );
    }
    if (type === 3) {
      rr(c, -20, -39, 40, 43, 3, finish.wood);
      for (let yy = -30; yy < 5; yy += 14) {
        line(
          c,
          [
            [-17, yy],
            [17, yy],
          ],
          "#745944",
          3,
        );
        for (let i = 0; i < 4; i++)
          rr(
            c,
            -14 + i * 8,
            yy - 9,
            6,
            8,
            1,
            ["#db926a", "#83b4ad", "#cbabc6"][i % 3],
            null,
          );
      }
    }
    if (type === 4) {
      line(
        c,
        [
          [-10, -17],
          [-10, 10],
        ],
        "#8c6451",
        5,
      );
      line(
        c,
        [
          [10, -17],
          [10, 10],
        ],
        "#8c6451",
        5,
      );
      rr(c, -13, -31, 26, 18, 4, finish.wood);
      rr(c, -15, -13, 30, 10, 4, finish.accent);
    }
    if (type === 5) {
      line(
        c,
        [
          [0, 5],
          [0, -28],
        ],
        "#a3855c",
        4,
      );
      poly(
        c,
        [
          [-9, -39],
          [9, -39],
          [17, -22],
          [-17, -22],
        ],
        finish.accent,
      );
      circle(c, 0, 5, 10, "#b99d70");
    }
    c.restore();
  }
  render(c) {
    const s = this.s,
      theme = THEMES[s.theme ?? 0];
    const paint = PAINTS[s.palette || 0];
    bg(c, "#96bbb7", "#577a84");
    panel(
      c,
      `TINY ${theme[0]}`,
      s.done
        ? "A little place made by you"
        : s.placed === 6
          ? "Your place is ready. Rearrange or open the doors."
          : "Clean → repair → decorate → bring it to life",
    );
    poly(
      c,
      [
        [40, 330],
        [210, 240],
        [380, 330],
        [210, 430],
      ],
      "#466370",
      null,
    );
    poly(
      c,
      [
        [40, 242],
        [210, 152],
        [210, 245],
        [40, 335],
      ],
      paint?.[1] || theme[2],
    );
    poly(
      c,
      [
        [210, 152],
        [380, 242],
        [380, 335],
        [210, 245],
      ],
      paint?.[0] || theme[1],
    );
    rr(c, 102, 208, 36, 50, 4, "#b2e3df", "#f4d6a7", 4);
    line(
      c,
      [
        [120, 208],
        [120, 258],
      ],
      "#f4d6a7",
      3,
    );
    line(
      c,
      [
        [102, 231],
        [138, 231],
      ],
      "#f4d6a7",
      3,
    );
    for (const { x, y } of s.floor) {
      const p = iso(x, y);
      poly(
        c,
        [
          [p.x, p.y - 18],
          [p.x + 34, p.y],
          [p.x, p.y + 18],
          [p.x - 34, p.y],
        ],
        (x + y) % 2 ? paint?.[3] || "#dbc394" : paint?.[2] || "#ecd6a6",
        "#bca77e",
        1,
      );
    }
    for (const d of s.dirt)
      if (d.hp) {
        const p = iso(d.x, d.y);
        for (let i = 0; i < 5; i++)
          circle(
            c,
            p.x + Math.sin(i * 7) * 15,
            p.y + Math.cos(i * 4) * 7,
            8,
            "#867f7188",
            null,
          );
      }
    for (const r of s.repairs) {
      const p = iso(r.x, r.y);
      if (r.hp > 0) {
        gear(c, p.x, p.y - 13, 17, "#8d9290", s.time * 0.2);
        text(c, "!", p.x, p.y - 42, 23, C.gold);
      } else {
        star(c, p.x, p.y - 3, 10, "#efcb69");
      }
    }
    const entities = [...s.items];
    if (s.placed === 6) {
      const free = s.floor.filter(
        (p) => !s.items.some((i) => i.x === p.x && i.y === p.y),
      );
      for (let n = 0; n < 2 && free.length; n++) {
        const a = free[Math.floor(free.length * (n ? 0.65 : 0.2))];
        const b =
          free.find((p) => Math.abs(p.x - a.x) + Math.abs(p.y - a.y) === 1) ||
          a;
        const t = (1 + Math.sin(s.time * 0.55 + n * 3)) / 2;
        entities.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          visitor: n,
        });
      }
    }
    for (const i of entities.sort((a, b) => a.x + a.y - b.x - b.y)) {
      const p = iso(i.x, i.y);
      if (i.visitor !== undefined)
        creature(c, p.x, p.y - 8, i.visitor, 12, s.time);
      else this.item(c, p.x, p.y, i.type);
    }
    if (s.mode === "decorate" && !s.done) {
      for (let i = 0; i < 6; i++) {
        rr(
          c,
          4 + i * 69,
          477,
          64,
          75,
          9,
          i === s.selected ? "#f2cf78" : "#ccbd9c",
          C.ink,
          2,
        );
        this.item(c, 36 + i * 69, 521, i, 0.7);
        text(
          c,
          this.names()[i],
          36 + i * 69,
          540,
          11,
          "#483c36",
          "center",
          false,
        );
      }
    } else if (!s.done) {
      rr(c, 55, 466, 310, 74, 17, "#fff0d1");
      text(
        c,
        s.mode === "clean" ? "Sweep away the dust" : "Make the gears turn",
        210,
        491,
        22,
        "#725344",
        "center",
        false,
      );
      text(
        c,
        s.mode === "clean"
          ? "Drag a finger across the floor"
          : "Tap each glowing repair point",
        210,
        518,
        15,
        "#725344",
        "center",
        false,
      );
    }
  }
}
