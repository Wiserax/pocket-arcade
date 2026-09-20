import { Game, choice, shuffle } from "../core.js";
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
  shadow,
  C,
  poly,
} from "../draw.js";
export const COLORS = ["#ff7271", "#5bc8ef", "#e8bd4f", "#b387ef"];
const SIGNS = ["●", "▲", "✦", "◆"];
export function makeRobot(seed, level, r) {
  const cols = level < 3 ? 3 : 4,
    rows = level < 2 ? 3 : Math.min(5, 3 + Math.floor(level / 4));
  const nodes = [];
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const id = nodes.length;
      nodes.push({
        id,
        row,
        col,
        color: Math.floor(r() * Math.min(4, 2 + Math.floor(level / 3))),
        gone: false,
        hp: level >= 6 && row > 0 && r() < 0.3 ? 2 : 1,
        deps: row
          ? [
              (row - 1) * cols + col,
              ...(level > 2 && col > 0 && r() < 0.5
                ? [(row - 1) * cols + col - 1]
                : []),
            ]
          : [],
        kind: row === 0 ? "latch" : row === rows - 1 ? "core" : "panel",
      });
    }
  const remaining = new Set(nodes.map((n) => n.id)),
    done = new Set(),
    order = [];
  while (remaining.size) {
    const options = nodes.filter(
      (n) => remaining.has(n.id) && n.deps.every((d) => done.has(d)),
    );
    const n = choice(options, r);
    for (let hit = 0; hit < n.hp; hit++) order.push(n.id);
    remaining.delete(n.id);
    done.add(n.id);
  }
  const queues = [[], [], [], []];
  for (const id of order)
    queues[Math.floor(r() * 4)].push({ color: nodes[id].color, origin: id });
  return {
    nodes,
    queues,
    slots: [null, null, null],
    selected: -1,
    moves: 0,
    undos: 0,
    hintsUsed: 0,
    totalShots: order.length,
    history: [],
    combo: 0,
    lastHit: -9,
    inspections: 2,
    solution: order,
  };
}
export class Robot extends Game {
  constructor(seed, level, perks, saved) {
    super(seed, level, perks, saved);
    if (!saved) {
      Object.assign(this.s, makeRobot(seed, level, this.random), {
        time: 0,
        score: 0,
        done: false,
        win: false,
      });
      this.s.inspections += perks.insight || 0;
    }
    this.shots = [];
    this.slabs = [];
  }
  animate(dt) {
    for (const b of this.shots) {
      b.t += dt * 5;
      if (b.t >= 1 && !b.hit) {
        b.hit = true;
        this.burst(b.tx, b.ty, COLORS[b.node.color], b.destroyed ? 18 : 8);
        if (b.destroyed) {
          this.slabs.push({
            x: b.tx,
            y: b.ty,
            vy: -25,
            vx: (b.tx - 210) * 0.3,
            a: 0,
            life: 0.7,
            color: COLORS[b.node.color],
          });
          this.audio(b.node.kind === "latch" ? "break" : "hit");
        }
      }
    }
    this.shots = this.shots.filter((b) => b.t < 1);
    for (const p of this.slabs) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 240 * dt;
      p.a += dt * 3;
    }
    this.slabs = this.slabs.filter((p) => p.life > 0);
  }
  pos(n) {
    const cols = Math.max(...this.s.nodes.map((n) => n.col)) + 1;
    return { x: 210 + (n.col - (cols - 1) / 2) * 76, y: 345 - n.row * 57 };
  }
  open(n) {
    return !n.gone && n.deps.every((id) => this.s.nodes[id].gone);
  }
  checkpoint() {
    const { history, ...rest } = this.s;
    history.push(JSON.stringify(rest));
    if (history.length > 40) history.shift();
  }
  pointer(x, y, type) {
    if (type !== "down" || this.s.done) return;
    const s = this.s;
    for (let i = 0; i < 4; i++) {
      if (x > 23 + i * 97 && x < 106 + i * 97 && y > 465) {
        if (!s.queues[i].length) return;
        const slot = s.slots.findIndex((v) => !v);
        if (slot < 0) {
          this.toast("Three cannons loaded · fire or undo");
          this.audio("wrong");
          return;
        }
        this.checkpoint();
        s.slots[slot] = s.queues[i].shift();
        s.selected = slot;
        s.moves++;
        this.audio("click");
        return;
      }
    }
    for (let i = 0; i < 3; i++)
      if (Math.hypot(x - (115 + i * 95), y - 420) < 36 && s.slots[i]) {
        s.selected = i;
        this.audio("click");
        return;
      }
    const n = s.nodes.find((n) => {
      const p = this.pos(n);
      return !n.gone && Math.abs(x - p.x) < 33 && Math.abs(y - p.y) < 23;
    });
    if (!n) return;
    if (!this.open(n)) {
      this.toast("Break the connected supports below");
      this.audio("wrong");
      return;
    }
    let slot = s.selected;
    if (!s.slots[slot] || s.slots[slot].color !== n.color) {
      slot = s.slots.findIndex((v) => v && v.color === n.color);
      if (slot < 0) {
        this.toast(`Load the ${SIGNS[n.color]} matching shell`);
        this.audio("wrong");
        return;
      }
    }
    this.checkpoint();
    const original = { ...n };
    n.hp--;
    n.gone = n.hp <= 0;
    s.slots[slot] = null;
    s.selected = s.slots.findIndex(Boolean);
    s.moves++;
    s.combo = s.time - s.lastHit < 3 ? s.combo + 1 : 1;
    s.lastHit = s.time;
    s.score += 10 + Math.min(5, s.combo) * 2;
    const p = this.pos(n);
    this.shots.push({
      x: 115 + slot * 95,
      y: 420,
      tx: p.x,
      ty: p.y,
      t: 0,
      node: original,
      destroyed: n.gone,
    });
    this.audio("shot");
    if (s.nodes.every((n) => n.gone)) {
      s.score += Math.max(0, 60 - Math.floor(s.time / 4));
      this.end(true, "Machine dismantled!");
    }
  }
  action(id) {
    if (id === "undo" && this.s.history.length) {
      const charges = this.s.inspections;
      const undos = (this.s.undos || 0) + 1;
      const hintsUsed = this.s.hintsUsed || 0;
      const time = this.s.time;
      const h = this.s.history,
        prev = JSON.parse(h.pop());
      this.s = {
        ...prev,
        history: h,
        undos,
        hintsUsed,
        time,
        inspections: Math.min(prev.inspections, charges),
      };
      this.shots = [];
      this.slabs = [];
      this.audio("click");
    }
    if (id === "hint" && this.s.inspections > 0) {
      this.s.inspections--;
      this.s.hintsUsed = (this.s.hintsUsed || 0) + 1;
      const n = this.s.nodes.find(
        (n) => this.open(n) && this.s.slots.some((v) => v?.color === n.color),
      );
      if (n) {
        const p = this.pos(n);
        this.emit(p.x, p.y, "#ffffff", 15);
        this.toast(`Break the glowing ${SIGNS[n.color]} part`);
      } else {
        const lane = this.s.queues.findIndex(
          (q) =>
            q[0] &&
            this.s.nodes.some((n) => this.open(n) && n.color === q[0].color),
        );
        if (lane >= 0 && this.s.slots.some((v) => !v)) {
          this.emit(64 + lane * 97, 500, "#fff2a2", 24);
          this.toast("This shell matches an exposed part");
        } else this.toast("Undo a load to make space for a useful shell");
      }
    }
  }
  actions() {
    return [
      {
        id: "undo",
        label: "Undo",
        sub: `${this.s.history.length ? "Take back a move" : "No moves yet"}`,
        disabled: !this.s.history.length,
      },
      {
        id: "hint",
        label: "Inspect",
        sub: `${this.s.inspections} charges`,
        disabled: this.s.inspections <= 0,
      },
    ];
  }
  stats() {
    return [
      [
        "PARTS",
        `${this.s.nodes.filter((n) => n.gone).length}/${this.s.nodes.length}`,
      ],
      ["MOVES", this.s.moves],
    ];
  }
  objective() {
    if (
      this.s.slots.every(Boolean) &&
      !this.s.nodes.some(
        (n) => this.open(n) && this.s.slots.some((v) => v?.color === n.color),
      )
    )
      return "Cannons blocked · Undo frees a slot for another color";
    return this.s.slots.some(Boolean)
      ? "Tap a matching exposed machine part"
      : "Tap a shell below to load a cannon";
  }
  stars() {
    const help = (this.s.undos || 0) + (this.s.hintsUsed || 0);
    return help === 0 ? 3 : help <= 3 ? 2 : 1;
  }
  details() {
    return [
      ["Parts recovered", this.s.nodes.filter((n) => n.gone).length],
      ["Moves", this.s.moves],
      ["Time taken", `${Math.floor(this.s.time)}s`],
    ];
  }
  render(c) {
    const s = this.s,
      cols = Math.max(...s.nodes.map((n) => n.col)) + 1,
      rows = Math.max(...s.nodes.map((n) => n.row)) + 1;
    const bodyTop = 345 - (rows - 1) * 57 - 35,
      bodyW = cols * 76 + 36,
      bodyX = 210 - bodyW / 2,
      kind = (this.level - 1) % 4;
    const region = Math.floor((this.level - 1) / 5) % 6;
    const steels = [
      "#6e9faf",
      "#bf987a",
      "#9e92bc",
      "#80aa92",
      "#7fabca",
      "#b1a26c",
    ];
    const palette = [
      ["#368b9b", "#153b4d"],
      ["#719292", "#354a51"],
      ["#97765e", "#493b38"],
      ["#726396", "#2e2c51"],
      ["#5a92af", "#304969"],
      ["#978962", "#474039"],
    ][region];
    bg(c, palette[0], palette[1], true);
    for (let i = 0; i < 7; i++)
      line(
        c,
        [
          [0, 365 + i * 9],
          [420, 365 + i * 9],
        ],
        "#0c24352c",
        1,
      );
    shadow(c, 210, 383, 155, 14);
    for (const x of [139, 281]) {
      rr(c, x - 24, 353, 48, 35, 9, "#39525f");
      rr(c, x - 31, 375, 62, 17, 6, "#a6b8b8");
      line(
        c,
        [
          [x - 20, 378],
          [x + 20, 378],
        ],
        "#e0e6cd",
        2,
      );
    }
    const armY = bodyTop + 48;
    for (const side of [-1, 1]) {
      const x = 210 + side * (bodyW / 2 + 9);
      line(
        c,
        [
          [x, armY],
          [x + side * 22, armY + 18],
          [x + side * 22, armY + 74],
        ],
        "#172e3e",
        20,
      );
      line(
        c,
        [
          [x, armY],
          [x + side * 22, armY + 18],
          [x + side * 22, armY + 74],
        ],
        "#9bafb3",
        13,
      );
      gear(
        c,
        x + side * 22,
        armY + 18,
        17,
        steels[region],
        side * s.time * 0.35,
      );
      rr(c, x + side * 22 - 13, armY + 69, 26, 32, 5, "#d2b879");
    }
    rr(
      c,
      bodyX - 5,
      bodyTop - 5,
      bodyW + 10,
      380 - bodyTop,
      22,
      "#243f50",
      "#102936",
      5,
    );
    rr(
      c,
      bodyX,
      bodyTop,
      bodyW,
      370 - bodyTop,
      19,
      steels[region],
      "#bdd3cd",
      2,
    );
    rr(
      c,
      bodyX + 12,
      bodyTop + 12,
      bodyW - 24,
      346 - bodyTop,
      12,
      "#365363",
      "#263e4b",
      3,
    );
    if (rows <= 4) {
      const hy = bodyTop - 65;
      rr(c, 141, hy, 138, 62, 16, steels[region], "#173143", 4);
      rr(c, 154, hy + 12, 112, 28, 9, "#163747");
      for (const x of [178, 242]) {
        circle(c, x, hy + 26, 11, "#f3d876", null);
        circle(c, x + Math.sin(s.time * 0.9) * 2, hy + 26, 4, "#284a57", null);
      }
      for (let i = 0; i < 5; i++)
        rr(c, 184 + i * 11, hy + 47, 7, 4, 1, "#2b4958", null);
      if (kind === 0) {
        line(
          c,
          [
            [210, hy],
            [210, hy - 20],
          ],
          "#b6cace",
          4,
        );
        circle(c, 210, hy - 23, 6, "#ffe291");
      }
      if (kind === 1) {
        poly(
          c,
          [
            [142, hy + 10],
            [118, hy - 10],
            [125, hy + 30],
          ],
          "#eac382",
        );
        poly(
          c,
          [
            [278, hy + 10],
            [302, hy - 10],
            [295, hy + 30],
          ],
          "#eac382",
        );
      }
      if (kind === 2) {
        gear(c, 147, hy + 5, 19, "#d5b87d", s.time * 0.25);
        gear(c, 273, hy + 5, 19, "#d5b87d", -s.time * 0.25);
      }
    }
    for (const n of s.nodes)
      if (!n.gone) {
        const p = this.pos(n);
        for (const id of n.deps) {
          const d = s.nodes[id],
            q = this.pos(d);
          if (!d.gone) {
            line(
              c,
              [
                [p.x, p.y + 19],
                [q.x, q.y - 20],
              ],
              "#162d3c",
              9,
            );
            line(
              c,
              [
                [p.x, p.y + 19],
                [q.x, q.y - 20],
              ],
              "#b9c7c4",
              4,
            );
          }
        }
      }
    for (const n of s.nodes) {
      const p = this.pos(n);
      const flying = this.shots.find((b) => b.node.id === n.id);
      if (n.gone && !flying) {
        rr(c, p.x - 30, p.y - 21, 60, 42, 8, "#162f4280", null);
        gear(c, p.x, p.y, 11, "#426676", s.time * (n.col % 2 ? 1 : -1));
        continue;
      }
      const open = !!flying || this.open(n);
      shadow(c, p.x, p.y + 21, 30, 6);
      rr(
        c,
        p.x - 31,
        p.y - 23,
        62,
        46,
        9,
        open ? COLORS[n.color] : "#697f8a",
        open ? "#fff2bd" : "#263e4f",
        open ? 3 : 2,
      );
      rr(
        c,
        p.x - 26,
        p.y - 19,
        52,
        8,
        4,
        open ? "#ffffff66" : "#ffffff20",
        null,
      );
      if (open) {
        text(c, SIGNS[n.color], p.x, p.y, 27, "#fffbe7");
        if (n.kind === "latch")
          line(
            c,
            [
              [p.x - 20, p.y + 15],
              [p.x + 20, p.y + 15],
            ],
            "#152331",
            3,
          );
      } else {
        gear(c, p.x, p.y, 12, "#a4b9bb");
        circle(c, p.x + 19, p.y - 10, 6, COLORS[n.color], "#d1ded6", 1);
        text(
          c,
          SIGNS[n.color],
          p.x + 19,
          p.y - 10,
          8,
          "#fffce6",
          "center",
          false,
        );
      }
      if (n.hp > 1) {
        circle(c, p.x - 5, p.y + 16, 3, "#fff1b2", null);
        circle(c, p.x + 5, p.y + 16, 3, "#fff1b2", null);
      }
      for (const dx of [-23, 23])
        circle(c, p.x + dx, p.y + 15, 2, "#233a46", null);
    }
    rr(c, 55, 397, 310, 58, 19, "#142b3b", "#5a91a1", 2);
    for (let i = 0; i < 3; i++) {
      cannon(
        c,
        115 + i * 95,
        426,
        s.slots[i] ? COLORS[s.slots[i].color] : "#355567",
        -Math.PI / 2,
        0.75,
      );
      if (s.selected === i)
        circle(c, 115 + i * 95, 431, 23, "#ffffff00", "#ffed7a", 2);
      if (s.slots[i]) text(c, SIGNS[s.slots[i].color], 115 + i * 95, 431, 20);
    }
    for (let i = 0; i < 4; i++) {
      rr(c, 22 + i * 97, 465, 85, 88, 13, "#152d3e", "#4a7183", 2);
      const q = s.queues[i];
      for (let j = Math.min(q.length, 3) - 1; j >= 0; j--) {
        rr(c, 32 + i * 97, 480 + j * 12, 65, 38, 10, COLORS[q[j].color]);
        if (j === 0) text(c, SIGNS[q[j].color], 64 + i * 97, 499, 23);
      }
      if (!q.length) text(c, "✓", 64 + i * 97, 501, 25, "#507988");
      text(c, q.length, 64 + i * 97, 538, 12, "#b8dbe4");
    }
    for (const b of this.shots) {
      const x = b.x + (b.tx - b.x) * b.t,
        y = b.y + (b.ty - b.y) * b.t;
      line(
        c,
        [
          [x, y + 12],
          [x, y],
        ],
        "#fff2b4",
        5,
      );
      circle(c, x, y, 5, COLORS[b.node.color], null);
    }
    for (const p of this.slabs) {
      c.save();
      c.globalAlpha = Math.min(1, p.life * 2);
      c.translate(p.x, p.y);
      c.rotate(p.a);
      rr(c, -24, -15, 48, 30, 5, p.color);
      c.restore();
    }
    panel(
      c,
      ["TIN TITAN", "CLOCKWORK CRAB", "IRON OWL", "STEEL GOLEM"][kind],
      "Break the supports · reveal the core",
    );
  }
}
