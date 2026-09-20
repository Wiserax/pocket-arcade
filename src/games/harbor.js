import { Game, shuffle, choice } from "../core.js";
import {
  bg,
  rr,
  text,
  circle,
  line,
  bar,
  panel,
  creature,
  arrow,
  tree,
  C,
  poly,
  shadow,
} from "../draw.js";
const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
export function occupied(b) {
  return Array.from({ length: b.len }, (_, i) => ({
    x: b.x + DIRS[b.dir][0] * i,
    y: b.y + DIRS[b.dir][1] * i,
  }));
}
export function exitClear(boat, boats) {
  const [dx, dy] = DIRS[boat.dir];
  let x = boat.x + dx * boat.len,
    y = boat.y + dy * boat.len;
  while (x >= 0 && x < 6 && y >= 0 && y < 6) {
    if (
      boats.some(
        (b) =>
          !b.gone &&
          b.id !== boat.id &&
          occupied(b).some((c) => c.x === x && c.y === y),
      )
    )
      return false;
    x += dx;
    y += dy;
  }
  return true;
}
export function harborBoard(r, level) {
  const boats = [];
  for (
    let tries = 0;
    tries < 1000 && boats.length < Math.min(20, 6 + level);
    tries++
  ) {
    const b = {
      id: boats.length,
      x: Math.floor(r() * 6),
      y: Math.floor(r() * 6),
      dir: Math.floor(r() * 4),
      len: level > 3 && r() < 0.35 ? 2 : 1,
      gone: false,
      passengers: 1 + Math.floor(r() * 3),
    };
    const cells = occupied(b);
    if (
      cells.some(
        (c) =>
          c.x < 0 ||
          c.x > 5 ||
          c.y < 0 ||
          c.y > 5 ||
          boats.some((v) =>
            occupied(v).some((z) => z.x === c.x && z.y === c.y),
          ),
      )
    )
      continue;
    if (!exitClear(b, boats)) continue;
    boats.push(b);
  }
  if (level >= 6 && boats.length > 4) {
    boats.at(-1).key = 1;
    boats[0].requires = 1;
    if (level >= 16) {
      boats.at(-2).key = 1;
      boats[1].requires = 2;
    }
  }
  return boats;
}
export class Harbor extends Game {
  constructor(seed, level, perks, saved) {
    super(seed, level, perks, saved);
    if (!saved)
      Object.assign(this.s, {
        boats: harborBoard(this.random, level),
        mistakes: 0,
        moves: 0,
        rescued: 0,
        history: [],
        departures: [],
        blocked: -1,
        blockTime: 0,
      });
  }
  update(dt) {
    this.s.blockTime = Math.max(0, this.s.blockTime - dt);
    for (const b of this.s.departures) b.t += dt;
    this.s.departures = this.s.departures.filter((b) => b.t < 1);
  }
  keys() {
    return this.s.boats
      .filter((b) => b.gone)
      .reduce((n, b) => n + (b.key || 0), 0);
  }
  canExit(b) {
    return this.keys() >= (b.requires || 0) && exitClear(b, this.s.boats);
  }
  pointer(x, y, type) {
    if (type !== "down") return;
    const gx = Math.floor((x - 36) / 58),
      gy = Math.floor((y - 137) / 58);
    const b = this.s.boats.find(
      (b) => !b.gone && occupied(b).some((z) => z.x === gx && z.y === gy),
    );
    if (!b) return;
    const s = this.s;
    if (!this.canExit(b)) {
      s.mistakes++;
      s.blocked = b.id;
      s.blockTime = 0.6;
      this.audio("wrong");
      this.toast(
        this.keys() < (b.requires || 0)
          ? "Rescue the key boat first to open this lock"
          : "Blocked ahead · follow the arrow",
      );
      if (s.mistakes >= 6 + (this.perks.patience || 0))
        this.end(false, "Harbor jammed · try a new order");
      return;
    }
    if (b.key) {
      this.toast("Harbor key rescued · a locked boat can leave!");
      this.audio("build");
    }
    s.history.push(b.id);
    b.gone = true;
    s.moves++;
    s.rescued += b.passengers;
    s.score += 15 * b.passengers;
    s.departures.push({ ...b, t: 0 });
    this.audio("coin");
    const p = this.pos(b);
    this.emit(p.x, p.y, "#c1f6fa", 8);
    if (s.boats.every((b) => b.gone))
      this.end(true, "Everyone is safely ashore!");
  }
  action(id) {
    const s = this.s;
    if (id === "undo" && s.history.length) {
      const id = s.history.pop();
      const b = s.boats.find((b) => b.id === id);
      b.gone = false;
      s.moves--;
      s.rescued -= b.passengers;
      s.score -= 15 * b.passengers;
      s.departures = [];
      this.audio("click");
    }
    if (id === "hint" && s.mistakes < 5 + (this.perks.patience || 0)) {
      const b = s.boats.find((b) => !b.gone && this.canExit(b));
      if (b) {
        const p = this.pos(b);
        this.emit(p.x, p.y, C.gold, 20);
        s.mistakes++;
        this.toast("This boat has a clear route · one chance used");
      }
    }
  }
  pos(b) {
    return {
      x: 65 + b.x * 58 + DIRS[b.dir][0] * (b.len - 1) * 29,
      y: 166 + b.y * 58 + DIRS[b.dir][1] * (b.len - 1) * 29,
    };
  }
  actions() {
    return [
      {
        id: "undo",
        label: "Undo departure",
        sub: "Bring the last boat back",
        disabled: !this.s.history.length,
      },
      {
        id: "hint",
        label: "Lighthouse",
        sub: "Costs one chance",
        disabled: this.s.mistakes >= 5 + (this.perks.patience || 0),
      },
    ];
  }
  stats() {
    return [
      ["RESCUED", this.s.rescued],
      ["BOATS", `${this.s.moves}/${this.s.boats.length}`],
      ["CHANCES", 6 + (this.perks.patience || 0) - this.s.mistakes],
    ];
  }
  objective() {
    return this.s.boats.some((b) => !b.gone && this.keys() < (b.requires || 0))
      ? "Key boats open locks · clear their arrow route first"
      : "Tap boats with a clear path in their arrow direction";
  }
  stars() {
    return this.s.mistakes === 0 ? 3 : this.s.mistakes < 3 ? 2 : 1;
  }
  details() {
    return [
      ["Passengers rescued", this.s.rescued],
      ["Boats launched", this.s.moves],
      ["Blocked attempts", this.s.mistakes],
    ];
  }
  boat(c, b, offset = 0) {
    const p = this.pos(b),
      d = DIRS[b.dir];
    c.save();
    c.translate(p.x + d[0] * offset, p.y + d[1] * offset);
    c.rotate((b.dir * Math.PI) / 2);
    const len = 39 + (b.len - 1) * 58;
    shadow(c, 0, 6, len * 0.5, 15);
    poly(
      c,
      [
        [-len / 2, -18],
        [len / 2 - 8, -18],
        [len / 2 + 6, 0],
        [len / 2 - 8, 18],
        [-len / 2, 18],
      ],
      b.id === this.s.blocked && this.s.blockTime > 0
        ? "#ff7882"
        : ["#ffd367", "#fa9080", "#b0dafa", "#bba8f1"][b.id % 4],
    );
    rr(c, -len / 2 + 7, -12, 18, 24, 4, "#f5f4d6");
    rr(c, -len / 2 + 10, -7, 12, 14, 3, "#448bab");
    arrow(c, len / 2 - 11, 0, 0, "#263c49", 0.6);
    for (let i = 0; i < b.passengers; i++)
      circle(c, -len / 2 + 8 + i * 7, 24, 2.5, "#fff2a8", null);
    if (b.key) {
      circle(c, -4, 0, 5, "#ffffff00", C.gold, 3);
      line(
        c,
        [
          [1, 0],
          [11, 0],
          [11, 5],
        ],
        C.gold,
        3,
      );
    }
    if ((b.requires || 0) > this.keys()) {
      rr(c, -8, -10, 16, 17, 4, "#736b84");
      circle(c, 0, -11, 6, "#ffffff00", C.gold, 3);
      text(c, b.requires, 0, 0, 11, C.gold);
    }
    c.restore();
  }
  render(c) {
    const theme = Math.floor((this.level - 1) / 5) % 6;
    const palette = [
      ["#75d1d1", "#247f9f", "#227896"],
      ["#80d4bb", "#338d9b", "#31808c"],
      ["#82cfe4", "#3975ac", "#477da4"],
      ["#737fae", "#283c72", "#3b527f"],
      ["#829fad", "#384f75", "#49667d"],
      ["#9dddcf", "#438ead", "#398d9c"],
    ][theme];
    bg(c, palette[0], palette[1]);
    const s = this.s;
    for (let y = 105; y < 540; y += 38)
      for (let x = 10; x < 420; x += 64)
        line(
          c,
          [
            [x + Math.sin(s.time + y) * 3, y],
            [x + 24, y],
          ],
          "#c3f2e633",
          2,
        );
    rr(c, 23, 123, 374, 374, 17, palette[2], "#155770", 4);
    for (let x = 0; x <= 6; x++)
      line(
        c,
        [
          [36 + x * 58, 137],
          [36 + x * 58, 485],
        ],
        "#88d4d333",
        1,
      );
    for (let y = 0; y <= 6; y++)
      line(
        c,
        [
          [36, 137 + y * 58],
          [384, 137 + y * 58],
        ],
        "#88d4d333",
        1,
      );
    panel(
      c,
      [
        "SUNNY INLET",
        "TURTLE COVE",
        "CORAL CROSSING",
        "MOONLIGHT BAY",
        "STORM CHANNEL",
        "PEARL ISLAND",
      ][theme],
      this.level >= 6
        ? `KEYS ${this.keys()} · rescue key boats to open locks`
        : "Follow the arrows · free the trapped boats",
    );
    for (const b of s.boats) if (!b.gone) this.boat(c, b);
    for (const b of s.departures) {
      c.globalAlpha = 1 - b.t;
      this.boat(c, b, b.t * 360);
      c.globalAlpha = 1;
    }
    rr(c, 48, 513, 324, 40, 10, "#d7bb81", "#8c835e", 2);
    for (let i = 0; i < Math.min(12, s.rescued); i++)
      creature(c, 68 + i * 25, 530, i % 3, 7, s.time);
    text(c, s.rescued ? "WELCOME HOME" : "THE RESCUE DOCK", 210, 108, 16);
  }
}
