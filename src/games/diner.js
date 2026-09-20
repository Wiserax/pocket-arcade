import { Game, choice } from "../core.js";
import { dinerScenery } from "../diner-art.js";
import {
  bg,
  rr,
  text,
  circle,
  line,
  bar,
  panel,
  creature,
  coin,
  shadow,
  C,
  label,
  poly,
} from "../draw.js";
const FOODS = ["Soup", "Cake", "Roast"];
const FC = ["#70d58e", "#f19ed0", "#ef9e54"];
function food(c, x, y, t, s = 1) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  if (t === 0) {
    circle(c, 0, 0, 16, "#d8edce");
    circle(c, 0, -3, 13, "#6eb855");
    line(
      c,
      [
        [-17, 0],
        [-13, 12],
        [13, 12],
        [17, 0],
      ],
      "#eef4d1",
      5,
    );
    circle(c, -4, -5, 3, "#e7da63", null);
  } else if (t === 1) {
    poly(
      c,
      [
        [-14, 12],
        [-14, -6],
        [15, -6],
        [15, 12],
      ],
      "#e9bd7e",
    );
    rr(c, -16, -12, 32, 9, 4, "#f3a8c6");
    circle(c, 2, -14, 5, "#e96672");
  } else {
    rr(c, -17, -11, 33, 22, 11, "#bf7442");
    line(
      c,
      [
        [13, 0],
        [23, 8],
      ],
      "#f5e2b3",
      6,
    );
    for (let i = 0; i < 3; i++)
      line(
        c,
        [
          [-10 + i * 7, -6],
          [-6 + i * 7, 6],
        ],
        "#774c38",
        2,
      );
  }
  c.restore();
}
export class Diner extends Game {
  constructor(seed, level, perks, saved) {
    super(seed, level, perks, saved);
    if (!saved)
      Object.assign(this.s, {
        stations: [
          { time: 0, ready: false },
          { time: 0, ready: false },
          { time: 0, ready: false },
        ],
        customers: [],
        spawn: 1,
        served: 0,
        lost: 0,
        target: 10 + Math.min(10, level),
        held: -1,
        gold: 20,
        speed: 0,
        helper: 0,
        helpTime: 4,
        combo: 0,
        arrivals: 0,
        servedFX: [],
      });
  }
  update(dt) {
    const s = this.s;
    for (const f of s.servedFX) f.t += dt;
    s.servedFX = s.servedFX.filter((f) => f.t < 0.7);
    for (const st of s.stations)
      if (st.time > 0) {
        st.time -= dt;
        if (st.time <= 0) {
          st.ready = true;
          this.audio("coin");
        }
      }
    s.spawn -= dt;
    const kinds = this.level < 3 ? 2 : 3;
    if (s.spawn <= 0 && s.served + s.customers.length < s.target) {
      if (s.customers.length < 4) {
        const type = Math.floor(this.random() * kinds);
        const kind =
          s.served < 3 && this.level === 1
            ? 0
            : this.level >= 11 && s.arrivals % 6 === 4
              ? 3
              : Math.floor(this.random() * 3);
        s.customers.push({
          type,
          patience: 1,
          kind,
          remaining: kind === 1 || kind === 3 ? 2 : 1,
          drawX: -35,
          id: s.time,
        });
      }
      s.arrivals++;
      s.spawn =
        this.level % 5 === 0 && s.arrivals % 4 < 3
          ? 1.8
          : Math.max(3, 6 - this.level * 0.12);
    }
    for (let i = 0; i < s.customers.length; i++) {
      const q = s.customers[i];
      q.patience -=
        dt /
        ((q.kind === 1 ? 40 : q.kind === 3 ? 34 : q.kind === 2 ? 20 : 28) +
          Math.max(0, 4 - this.level) +
          (this.perks.welcome || 0));
      q.drawX += (68 + i * 96 - q.drawX) * Math.min(1, dt * 6);
    }
    const lost = s.customers.filter((q) => q.patience <= 0);
    if (lost.length) {
      s.lost += lost.length;
      s.combo = 0;
      this.audio("wrong");
      s.customers = s.customers.filter((q) => q.patience > 0);
    }
    s.helpTime -= dt;
    if (s.helpTime <= 0) {
      s.helpTime = 6;
      if (s.helper === 0) {
        const need = s.customers.find(
          (q) => !s.stations[q.type].ready && !s.stations[q.type].time,
        );
        if (need) this.cook(need.type);
      } else {
        const q = s.customers.find((q) => s.stations[q.type].ready);
        if (q) {
          s.stations[q.type].ready = false;
          this.serve(q);
        }
      }
    }
    if (s.served >= s.target) this.end(true, "A delicious service!");
    if (s.lost >= 5) this.end(false, "A rush to learn from");
  }
  cook(i) {
    const st = this.s.stations[i];
    if (st.ready || st.time > 0) return;
    st.time = (i === 0 ? 3.3 : i === 1 ? 4.6 : 5.5) / (1 + this.s.speed * 0.18);
    st.total = st.time;
    this.audio("click");
  }
  serve(q) {
    const s = this.s;
    s.servedFX.push({ x: q.drawX, y: 219, t: 0, type: q.type });
    if (q.remaining > 1) {
      q.remaining--;
      if (q.kind === 3) {
        q.type = (q.type + 1) % 3;
        this.toast("First course loved! The critic wants a second dish.");
      }
      q.patience = Math.min(1, q.patience + 0.15);
      s.score += 5;
      this.audio("coin");
      this.emit(q.drawX, 225, FC[q.type], 9);
      return;
    }
    s.customers = s.customers.filter((v) => v !== q);
    s.served++;
    s.combo++;
    const tip = Math.round(
      5 +
        q.patience * 6 +
        Math.min(5, s.combo) +
        (q.kind === 3 ? 15 : q.kind === 1 ? 5 : q.kind === 2 ? 3 : 0),
    );
    s.gold += tip;
    s.score += tip * 3;
    this.burst(210, 240, FC[q.type], 10);
    this.audio("coin");
  }
  pointer(x, y, type) {
    if (type !== "down") return;
    const s = this.s;
    if (y > 378 && y < 505) {
      const i = Math.min(2, Math.floor(x / 140));
      if (this.level < 3 && i === 2) {
        this.toast("Roast station opens at venue 3");
        return;
      }
      const st = s.stations[i];
      if (st.ready) {
        if (s.held >= 0) {
          this.toast("Serve the dish on your tray first");
          return;
        }
        s.held = i;
        st.ready = false;
        this.audio("click");
      } else this.cook(i);
      return;
    }
    if (y > 100 && y < 350) {
      const q = s.customers.find((q) => Math.abs(q.drawX - x) < 43);
      if (!q) return;
      if (s.held === q.type) {
        this.serve(q);
        s.held = -1;
      } else {
        this.toast(
          s.held < 0
            ? "Pick up a ready dish below"
            : "That guest ordered something else",
        );
        this.audio("wrong");
      }
    }
  }
  action(id) {
    const s = this.s;
    if (id === "helper") {
      s.helper = 1 - s.helper;
      this.audio("click");
    }
    if (id === "upgrade" && s.gold >= 30 + s.speed * 20) {
      s.gold -= 30 + s.speed * 20;
      s.speed++;
      this.audio("build");
    }
    if (id === "serve" && s.held >= 0) {
      const q = s.customers
        .filter((q) => q.type === s.held)
        .sort((a, b) => a.patience - b.patience)[0];
      if (q) {
        this.serve(q);
        s.held = -1;
      }
    }
  }
  actions() {
    return [
      {
        id: "helper",
        label: this.s.helper ? "Helper: serve" : "Helper: cook",
        sub: "Tap to reassign",
      },
      {
        id: "upgrade",
        label: "Faster kitchen",
        sub: `${30 + this.s.speed * 20} tips`,
        disabled: this.s.gold < 30 + this.s.speed * 20,
      },
      {
        id: "serve",
        label: "Serve tray",
        sub: this.s.held < 0 ? "Tray empty" : FOODS[this.s.held],
        disabled: this.s.held < 0,
      },
    ];
  }
  stats() {
    return [
      ["SERVED", `${this.s.served}/${this.s.target}`],
      ["PATIENCE", `${5 - this.s.lost} chances`],
      ["TIPS", this.s.gold],
    ];
  }
  objective() {
    return this.s.held < 0
      ? "Tap a stove to cook · tap again when ready"
      : "Tap the guest who ordered your dish";
  }
  details() {
    return [
      ["Happy guests", this.s.served],
      ["Tips remaining", this.s.gold],
      ["Guests missed", this.s.lost],
    ];
  }
  stars() {
    return this.s.win ? (this.s.lost === 0 ? 3 : this.s.lost < 3 ? 2 : 1) : 0;
  }
  render(c) {
    const s = this.s,
      theme = Math.floor((this.level - 1) / 5) % 6;
    const palette = [
      ["#718e75", "#344f54", "#dfc595", "#9b6848"],
      ["#797aa2", "#434b71", "#c3b8ce", "#7d5b84"],
      ["#aa775d", "#5f4051", "#e3bb84", "#a66447"],
      ["#7fbbcf", "#516f9d", "#e9d9bc", "#8b8fab"],
      ["#67aeb1", "#38657c", "#c3d8ca", "#6c8d8b"],
      ["#b18aa4", "#73516c", "#e3c4b1", "#a16876"],
    ][theme];
    bg(c, palette[0], palette[1]);
    rr(c, 12, 75, 396, 300, 14, palette[2], "#354b50", 3);
    for (let x = 20; x < 400; x += 45)
      for (let y = 85; y < 370; y += 45)
        if ((Math.floor(x / 45) + Math.floor(y / 45)) % 2 === 0)
          rr(c, x, y, 44, 44, 0, "#ccae8133", null);
    panel(
      c,
      [
        "MOSS & MUG",
        "MOONLIGHT DINER",
        "DRAGON GRILL",
        "CLOUD CAFE",
        "COVE KITCHEN",
        "GRAND BANQUET",
      ][theme],
      this.level % 5 === 0
        ? "RUSH HOUR · keep the queue moving"
        : "Fresh food · happy monsters",
    );
    for (let i = 0; i < 8; i++) {
      rr(c, 14 + i * 49, 77, 49, 25, 3, i % 2 ? palette[3] : "#f4ddac", null);
      circle(c, 38 + i * 49, 98, 24, i % 2 ? palette[3] : "#f4ddac", null);
    }
    dinerScenery(c, theme, s.time);
    for (let i = 0; i < 4; i++) {
      const x = 68 + i * 96;
      rr(c, x - 39, 260, 78, 43, 9, palette[3]);
      rr(c, x - 35, 255, 70, 33, 8, "#c89865");
      const q = s.customers[i];
      if (q) {
        creature(c, q.drawX ?? x, 219, q.kind, q.kind === 1 ? 35 : 30, s.time);
        if (q.kind === 3) {
          poly(
            c,
            [
              [x - 18, 188],
              [x - 23, 170],
              [x - 7, 179],
              [x, 163],
              [x + 7, 179],
              [x + 23, 170],
              [x + 18, 188],
            ],
            "#f7d967",
          );
          circle(c, x + 10, 215, 10, "#ffffff00", "#d7b767", 2);
        }
        if (q.kind === 2) {
          poly(
            c,
            [
              [x - 25, 205],
              [x - 43, 188],
              [x - 37, 225],
            ],
            "#f2b86f",
          );
          poly(
            c,
            [
              [x + 25, 205],
              [x + 43, 188],
              [x + 37, 225],
            ],
            "#f2b86f",
          );
        }
        rr(c, x - 29, 118, 58, 56, 14, "#fff2d2", "#4f4639", 2);
        food(c, x, 145, q.type, 0.9);
        if (q.remaining > 1) text(c, "x2", x + 22, 160, 13, C.gold);
        poly(
          c,
          [
            [x - 6, 174],
            [x + 4, 182],
            [x + 8, 174],
          ],
          "#fff2d2",
          "#4f4639",
          2,
        );
        bar(
          c,
          x - 32,
          186,
          64,
          7,
          q.patience,
          q.patience < 0.3 ? C.red : C.green,
        );
        text(
          c,
          q.kind === 3
            ? "Food critic"
            : q.kind === 1
              ? "Two plates"
              : q.kind === 2
                ? "Impatient"
                : "Hungry",
          x,
          324,
          12,
          "#534b3b",
          "center",
          false,
        );
      } else text(c, "…", x, 225, 28, "#b89b70", "center", false);
    }
    for (const f of s.servedFX) {
      c.save();
      c.globalAlpha = 1 - f.t / 0.7;
      food(c, f.x, f.y - 35 - f.t * 60, f.type, 0.7);
      text(c, "♥", f.x + 24, f.y - 30 - f.t * 60, 22, "#ed839b");
      c.restore();
    }
    creature(c, 40, 343, s.helper ? 1 : 0, 13, s.time, "#a6d5c5");
    rr(c, 29, 318, 22, 9, 4, "#fff1d2");
    circle(c, 32, 317, 5, "#fff1d2", null);
    circle(c, 40, 312, 7, "#fff1d2", null);
    circle(c, 48, 317, 5, "#fff1d2", null);
    text(
      c,
      s.helper ? "SERVING" : "COOKING",
      99,
      349,
      11,
      "#4b5649",
      "center",
      false,
    );
    if (s.combo >= 3)
      text(
        c,
        `${s.combo} HAPPY IN A ROW`,
        285,
        350,
        13,
        "#7d5a37",
        "center",
        false,
      );
    rr(c, 10, 370, 400, 142, 15, "#704837", "#302834", 4);
    for (let i = 0; i < 3; i++) {
      const x = 70 + i * 140,
        st = s.stations[i];
      rr(
        c,
        x - 55,
        386,
        110,
        105,
        12,
        this.level < 3 && i === 2 ? "#4b4d50" : "#bcb7a0",
      );
      circle(c, x, 429, 34, "#394b4b");
      circle(c, x, 429, 26, st.time > 0 ? "#ff914a" : "#66786b");
      if (st.ready) {
        food(c, x, 426, i, 1.4);
        label(c, "READY", x, 383, "#337555");
      } else if (st.time > 0) {
        food(c, x, 426, i, 1);
        bar(c, x - 37, 466, 74, 8, 1 - st.time / (st.total || 5.5), C.gold);
        for (let j = 0; j < 3; j++)
          circle(
            c,
            x - 15 + j * 15,
            403 - ((s.time * 20 + j * 7) % 28),
            3,
            "#fff4cd88",
            null,
          );
      } else if (this.level < 3 && i === 2) text(c, "VENUE 3", x, 431, 14);
      else text(c, "COOK", x, 430, 17);
      text(c, FOODS[i], x, 489, 14);
    }
    rr(c, 130, 522, 160, 32, 12, "#d2a76c");
    text(c, "YOUR TRAY", 175, 539, 12, "#473a32", "center", false);
    if (s.held >= 0) food(c, 260, 535, s.held, 0.7);
    else text(c, "—", 260, 539, 15);
  }
}
