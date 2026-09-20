import { Game, clamp, moveStick } from "../core.js";
import {
  bg,
  rr,
  text,
  circle,
  line,
  bar,
  panel,
  C,
  poly,
  arrow,
  gear,
  shadow,
} from "../draw.js";
export class Drill extends Game {
  constructor(seed, level, perks, saved) {
    super(seed, level, perks, saved);
    if (!saved) {
      const grid = [];
      for (let y = 0; y < 14; y++)
        for (let x = 0; x < 10; x++) {
          const roll = this.random();
          let type =
            y < 2
              ? 0
              : roll < 0.1 && y > 6
                ? 3
                : roll < 0.34 && y > 3
                  ? 2
                  : roll > 0.87 && y > 4
                    ? 4
                    : 1;
          if (level > 3 && y > 6 && roll > 0.97) type = 5;
          grid.push({ x, y, type });
        }
      if (level > 1) grid[122 + (level % 6)].type = 6;
      Object.assign(this.s, {
        grid,
        player: { x: 210, y: 110, angle: Math.PI / 2 },
        heat: 0,
        cargo: 0,
        bank: 0,
        capacity: 35 + (perks.capacity || 0) * 3,
        timeLeft: 130,
        target: 48 + Math.floor(this.difficulty) * 3,
        drill: 0,
        vent: 0,
        extracts: 0,
        cut: 0,
        core: false,
        coreBanked: false,
        needCore: level > 1,
        drilling: false,
      });
    }
  }
  update(dt) {
    const s = this.s;
    s.timeLeft -= dt;
    s.vent = Math.max(0, s.vent - dt);
    const p = s.player,
      old = { x: p.x, y: p.y };
    const moving = moveStick(this, p, dt, s.heat > 90 ? 32 : 105, {
      x: 22,
      y: 100,
      w: 376,
      h: 420,
    });
    s.drilling = false;
    const gx = clamp(Math.floor((p.x - 10) / 40), 0, 9),
      gy = clamp(Math.floor((p.y - 90) / 32), 0, 13),
      cell = s.grid[gy * 10 + gx];
    if (cell.type && moving) {
      s.drilling = true;
      s.drill += dt * (cell.type === 4 ? 0.4 : cell.type === 3 ? 0.65 : 1);
      p.x = old.x + (p.x - old.x) * 0.25;
      p.y = old.y + (p.y - old.y) * 0.25;
      s.heat += dt * 10;
      if (s.drill > 0.28) {
        const valuable = [2, 3, 6].includes(cell.type);
        if (s.cargo >= s.capacity && valuable) {
          this.toast("Bag full. Return to the surface depot.");
          p.x = old.x;
          p.y = old.y;
        } else {
          const value =
            cell.type === 2
              ? 3
              : cell.type === 3
                ? 7
                : cell.type === 6
                  ? 10
                  : 0;
          if (cell.type === 6) {
            s.core = true;
            this.toast("Ancient core secured. Bring it home!");
          }
          if (cell.type === 5) {
            s.timeLeft -= 7;
            this.toast("Gas pocket! Seven seconds lost.");
            this.audio("alert");
          }
          s.heat += cell.type === 4 ? 18 : cell.type >= 2 ? 12 : 7;
          s.cargo = Math.min(s.capacity, s.cargo + value);
          cell.type = 0;
          s.cut++;
          this.emit(
            30 + gx * 40,
            106 + gy * 32,
            value ? C.gold : "#caa986",
            10,
          );
          this.audio(value ? "coin" : "hit");
        }
        s.drill = 0;
      }
    } else {
      s.drill = 0;
      s.heat = Math.max(0, s.heat - dt * 8);
    }
    s.heat = Math.min(100, s.heat);
    if (p.y < 113 && (s.cargo > 0 || (s.core && !s.coreBanked))) {
      s.bank += s.cargo;
      s.score += s.cargo * 3;
      s.cargo = 0;
      s.extracts++;
      if (s.core) s.coreBanked = true;
      this.audio("coin");
      this.emit(p.x, p.y, C.gold, 20);
      if (s.bank >= s.target && (!s.needCore || s.coreBanked)) {
        this.end(true, "Treasure brought home!");
        return;
      }
    }
    if (s.timeLeft <= 0) {
      s.score += Math.floor(s.cargo * 0.5);
      s.cargo = 0;
      this.end(false, "The cave closed. Banked ore is safe.");
    }
  }
  action(id) {
    const s = this.s;
    if (id === "vent" && s.vent <= 0) {
      s.heat = Math.max(0, s.heat - 65);
      s.vent = 14;
      this.burst(s.player.x, s.player.y, "#bcf1ef");
    }
    if (id === "return") {
      this.input.down = true;
      this.input.x = s.player.x;
      this.input.y = 102;
      this.toast("Returning to surface. Touch to steer instead.");
    }
  }
  actions() {
    return [
      {
        id: "vent",
        label: "Coolant burst",
        sub: this.s.vent > 0 ? `${Math.ceil(this.s.vent)}s` : "Remove 65 heat",
        disabled: this.s.vent > 0,
      },
      { id: "return", label: "Go to surface", sub: "Bank your cargo" },
    ];
  }
  stats() {
    return [
      ["BANKED", `${this.s.bank}/${this.s.target}`],
      ["BAG", `${this.s.cargo}/${this.s.capacity}`],
      ["TIME", `${Math.ceil(this.s.timeLeft)}s`],
    ];
  }
  objective() {
    return this.s.needCore && !this.s.core
      ? "Recover the glowing core below. Bank enough ore to escape."
      : "Drag to drill. Return to the top to bank your ore.";
  }
  details() {
    return [
      ["Ore banked", this.s.bank],
      ["Safe extractions", this.s.extracts],
      [
        "Ancient core",
        this.s.coreBanked
          ? "Recovered"
          : this.s.needCore
            ? "Still below"
            : "Not required",
      ],
    ];
  }
  reward() {
    return 8 + Math.floor(this.s.bank * 0.7) + (this.s.win ? 25 : 0);
  }
  stars() {
    return this.s.win
      ? this.s.timeLeft > 65
        ? 3
        : this.s.timeLeft > 25
          ? 2
          : 1
      : 0;
  }
  render(c) {
    const s = this.s,
      zone = Math.floor((this.level - 1) / 5) % 6;
    bg(
      c,
      zone === 1 ? "#7caabb" : "#91cace",
      zone === 2 ? "#493249" : "#352938",
    );
    rr(c, 8, 86, 404, 61, 8, "#7ab685");
    rr(c, 132, 87, 157, 39, 8, "#51756b", "#2f5357", 2);
    text(c, "SURFACE DEPOT", 210, 107, 15);
    arrow(c, 36, 113, -Math.PI / 2, "#ffffcc", 0.8);
    arrow(c, 383, 113, -Math.PI / 2, "#ffffcc", 0.8);
    for (const cell of s.grid) {
      const x = 10 + cell.x * 40,
        y = 90 + cell.y * 32;
      if (!cell.type) {
        if (cell.y > 1) {
          rr(c, x, y, 40, 32, 0, "#403840", null);
          if ((cell.x * 3 + cell.y) % 7 === 0)
            circle(c, x + 15, y + 17, 2, "#7c685b", null);
        }
        continue;
      }
      const colors = [
        "",
        ["#936b50", "#a27b58", "#718c99", "#675f7e", "#8f6870", "#6c8c99"][
          zone
        ],
        "#be8a42",
        "#796783",
        "#586779",
        "#8e9963",
        "#544c80",
      ];
      rr(c, x + 1, y + 1, 38, 30, 3, colors[cell.type], "#382e38", 1);
      line(
        c,
        [
          [x + 4, y + 5],
          [x + 31, y + 5],
        ],
        "#ffffff18",
        2,
      );
      line(
        c,
        [
          [x + 3, y + 27],
          [x + 34, y + 27],
        ],
        "#00000018",
        2,
      );
      if (cell.type === 2)
        poly(
          c,
          [
            [x + 10, y + 15],
            [x + 15, y + 8],
            [x + 27, y + 13],
            [x + 24, y + 23],
            [x + 13, y + 23],
          ],
          "#ffdc61",
          "#956425",
          1,
        );
      if (cell.type === 3)
        poly(
          c,
          [
            [x + 21, y + 3],
            [x + 30, y + 17],
            [x + 21, y + 27],
            [x + 11, y + 17],
          ],
          "#bce5fa",
          "#574d74",
          2,
        );
      if (cell.type === 4)
        line(
          c,
          [
            [x + 9, y + 5],
            [x + 23, y + 21],
            [x + 34, y + 8],
          ],
          "#9ab1b9",
          3,
        );
      if (cell.type === 5) {
        circle(c, x + 20, y + 16, 10, "#a5bc5d", "#4a6445", 2);
        text(c, "!", x + 20, y + 16, 15);
      }
      if (cell.type === 6) {
        circle(
          c,
          x + 20,
          y + 16,
          11 + Math.sin(s.time * 4) * 2,
          "#e7cbff",
          "#fff2bc",
          2,
        );
        text(c, "*", x + 20, y + 16, 23, "#9a62e4", "center", false);
      }
    }
    const p = s.player;
    shadow(c, p.x, p.y + 19, 21);
    c.save();
    c.translate(p.x, p.y);
    c.rotate(p.angle);
    rr(c, -19, -17, 34, 34, 8, "#efba45");
    rr(c, -17, -21, 26, 7, 3, "#334851");
    rr(c, -17, 14, 26, 7, 3, "#334851");
    poly(
      c,
      [
        [12, -13],
        [32, 0],
        [12, 13],
      ],
      "#b9d7dc",
    );
    for (let i = 0; i < 3; i++)
      line(
        c,
        [
          [15 + i * 4, -10 + i * 3],
          [18 + i * 4, 9 - i * 2],
        ],
        "#688591",
        2,
      );
    rr(c, -12, -10, 15, 20, 4, "#4ba0b5");
    if (s.drilling) {
      for (let i = 0; i < 4; i++)
        line(
          c,
          [
            [29, -10 + i * 7],
            [35 + Math.sin(s.time * 25 + i) * 5, -12 + i * 8],
          ],
          "#fff1ad",
          2,
        );
    }
    c.restore();
    bar(c, 25, 540, 370, 11, s.heat / 100, s.heat > 75 ? C.red : "#59d5e6");
    text(
      c,
      `HEAT ${Math.round(s.heat)}%${s.heat > 90 ? " - DRILL SLOWED" : ""}`,
      210,
      526,
      13,
    );
    panel(
      c,
      [
        "SOFT EARTH",
        "COPPER BED",
        "CRYSTAL FAULT",
        "OBSIDIAN REACH",
        "DEEP RUINS",
        "STARSTONE",
      ][zone],
      s.needCore
        ? s.coreBanked
          ? "CORE BANKED"
          : s.core
            ? "CORE ON BOARD"
            : "Find the ancient core and escape"
        : "Gold is safe only after you reach the surface",
    );
  }
}
