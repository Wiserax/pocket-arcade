import { W, H, clamp } from "./core.js";
export const C = {
  ink: "#152331",
  cream: "#fff3c9",
  gold: "#ffd748",
  blue: "#54c9ed",
  red: "#ff6470",
  green: "#91d950",
  purple: "#be80f8",
  wood: "#865736",
};
export function rr(c, x, y, w, h, r = 12, fill, stroke = C.ink, line = 3) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = line;
    c.stroke();
  }
}
export function text(
  c,
  s,
  x,
  y,
  size = 20,
  color = C.cream,
  align = "center",
  stroke = true,
) {
  c.font = `${size}px "Lilita One",sans-serif`;
  c.textAlign = align;
  c.textBaseline = "middle";
  if (stroke) {
    c.strokeStyle = C.ink;
    c.lineWidth = Math.max(2, size * 0.14);
    c.lineJoin = "round";
    c.strokeText(String(s), x, y);
  }
  c.fillStyle = color;
  c.fillText(String(s), x, y);
}
export function circle(c, x, y, r, fill, stroke = C.ink, l = 3) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = l;
    c.stroke();
  }
}
export function line(c, pts, color, width = 4) {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
  c.strokeStyle = color;
  c.lineWidth = width;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.stroke();
}
export function poly(c, pts, fill, stroke = C.ink, l = 3) {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p)));
  c.closePath();
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.lineWidth = l;
    c.strokeStyle = stroke;
    c.stroke();
  }
}
export function shadow(c, x, y, rx, ry = rx * 0.32) {
  c.fillStyle = "#10203535";
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, 7);
  c.fill();
}
export function bar(c, x, y, w, h, value, color = C.green) {
  rr(c, x, y, w, h, h / 2, "#172332", "#172332", 2);
  if (value > 0)
    rr(
      c,
      x + 2,
      y + 2,
      (w - 4) * clamp(value, 0, 1),
      h - 4,
      Math.max(2, h / 2 - 2),
      color,
      null,
    );
}
export function panel(c, title, sub) {
  rr(c, 22, 17, 376, 48, 12, "#18394dcc", "#5a839d", 2);
  text(c, title, 210, 34, 19);
  if (sub) text(c, sub, 210, 53, 11, "#b4d9d8", "center", false);
}
export function bg(c, top = "#30758a", bottom = "#163746", grid = false) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  if (grid) {
    c.strokeStyle = "#ffffff07";
    c.lineWidth = 1;
    for (let x = 0; x < W; x += 35)
      line(
        c,
        [
          [x, 0],
          [x, H],
        ],
        "#ffffff09",
        1,
      );
    for (let y = 0; y < H; y += 35)
      line(
        c,
        [
          [0, y],
          [W, y],
        ],
        "#ffffff09",
        1,
      );
  }
}
export function gear(c, x, y, r, color = C.gold, t = 0) {
  c.save();
  c.translate(x, y);
  c.rotate(t);
  const p = [];
  for (let i = 0; i < 32; i++) {
    const a = (i * Math.PI) / 16,
      d = i % 4 < 2 ? r : r * 0.78;
    p.push([Math.cos(a) * d, Math.sin(a) * d]);
  }
  poly(c, p, color);
  circle(c, 0, 0, r * 0.42, "#324858");
  circle(c, 0, 0, r * 0.17, "#bdd4dd", null);
  c.restore();
}
export function coin(c, x, y, r = 10) {
  circle(c, x, y + 2, r, "#a96620", null);
  circle(c, x, y, r, C.gold, "#986026", 2);
  circle(c, x, y, r * 0.66, "#ffc43a", "#ffef97", 1.5);
  text(c, "✦", x, y, r * 1.25, "#fff0a3", "center", false);
}
export function star(c, x, y, r, color = C.gold) {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2,
      d = i % 2 ? r * 0.46 : r;
    p.push([x + Math.cos(a) * d, y + Math.sin(a) * d]);
  }
  poly(c, p, color);
}
export function bolt(c, x, y, r, color = C.gold) {
  poly(
    c,
    [
      [x + r * 0.1, y - r],
      [x - r * 0.6, y + r * 0.1],
      [x - r * 0.05, y + r * 0.1],
      [x - r * 0.25, y + r],
      [x + r * 0.7, y - r * 0.2],
      [x + r * 0.12, y - r * 0.2],
    ],
    color,
  );
}
export function creature(c, x, y, type = 0, size = 23, t = 0, color) {
  c.save();
  c.translate(x, y);
  shadow(c, 0, size * 0.8, size);
  c.translate(0, Math.sin(t * 6) * 1.3);
  const cols = ["#9bdd69", "#b6a1ec", "#ffad60", "#78d6e3", "#ef6e76"];
  const col = color || cols[type % cols.length];
  rr(c, -size * 0.67, size * 0.4, size * 0.5, size * 0.42, 5, "#263e49");
  rr(c, size * 0.14, size * 0.4, size * 0.5, size * 0.42, 5, "#263e49");
  rr(c, -size * 0.8, -size * 0.3, size * 1.6, size * 1.1, size * 0.48, col);
  if (type % 3 === 1) {
    poly(
      c,
      [
        [-size * 0.65, -size * 0.2],
        [-size * 0.8, -size * 0.9],
        [-size * 0.2, -size * 0.33],
      ],
      "#fff0cf",
    );
    poly(
      c,
      [
        [size * 0.65, -size * 0.2],
        [size * 0.8, -size * 0.9],
        [size * 0.2, -size * 0.33],
      ],
      "#fff0cf",
    );
  } else if (type % 3 === 2) {
    poly(
      c,
      [
        [-size * 0.65, 0],
        [-size * 1.05, -size * 0.25],
        [-size * 0.72, size * 0.35],
      ],
      col,
    );
    poly(
      c,
      [
        [size * 0.65, 0],
        [size * 1.05, -size * 0.25],
        [size * 0.72, size * 0.35],
      ],
      col,
    );
  }
  circle(c, -size * 0.29, size * 0.04, size * 0.16, "#fff8d6", null);
  circle(c, size * 0.29, size * 0.04, size * 0.16, "#fff8d6", null);
  circle(c, -size * 0.25, size * 0.04, size * 0.075, C.ink, null);
  circle(c, size * 0.25, size * 0.04, size * 0.075, C.ink, null);
  line(
    c,
    [
      [-size * 0.19, size * 0.43],
      [0, size * 0.48],
      [size * 0.2, size * 0.39],
    ],
    C.ink,
    2,
  );
  c.restore();
}
export function tree(c, x, y, s = 1, type = 0) {
  c.save();
  c.translate(x, y);
  c.scale(s, s);
  shadow(c, 0, 11, 23);
  rr(c, -5, -12, 10, 30, 3, "#977047");
  circle(c, 0, -30, 25, type ? "#edab48" : "#40966c");
  circle(c, -16, -23, 18, type ? "#f5bc52" : "#61b579");
  circle(c, 17, -25, 19, type ? "#ffc961" : "#86ca7b");
  circle(c, 0, -42, 18, type ? "#ffd56d" : "#7ac582");
  c.restore();
}
export function rock(c, x, y, s = 1, color = "#79909c") {
  poly(
    c,
    [
      [x - 13 * s, y + 6 * s],
      [x - 16 * s, y - 4 * s],
      [x - 6 * s, y - 14 * s],
      [x + 10 * s, y - 11 * s],
      [x + 17 * s, y + 2 * s],
      [x + 6 * s, y + 10 * s],
    ],
    color,
  );
  line(
    c,
    [
      [x - 6 * s, y - 14 * s],
      [x - 2 * s, y],
      [x + 17 * s, y + 2 * s],
    ],
    "#ffffff33",
    2,
  );
}
export function label(c, s, x, y, color = "#254356") {
  const w = s.length * 6 + 22;
  rr(c, x - w / 2, y - 11, w, 23, 7, color, "#ffffff25", 1);
  text(c, s, x, y + 1, 12);
}
export function cannon(
  c,
  x,
  y,
  color = C.blue,
  angle = -Math.PI / 2,
  scale = 1,
) {
  c.save();
  c.translate(x, y);
  c.scale(scale, scale);
  shadow(c, 0, 19, 27);
  rr(c, -23, -11, 46, 35, 10, "#526c7b");
  circle(c, 0, 2, 18, color);
  c.rotate(angle);
  rr(c, 0, -9, 34, 18, 4, color);
  rr(c, 25, -11, 10, 22, 3, "#bccfd3");
  c.restore();
}
export function arrow(c, x, y, a, color = C.cream, s = 1) {
  c.save();
  c.translate(x, y);
  c.rotate(a);
  line(
    c,
    [
      [-12 * s, 0],
      [12 * s, 0],
    ],
    color,
    4 * s,
  );
  line(
    c,
    [
      [5 * s, -7 * s],
      [12 * s, 0],
      [5 * s, 7 * s],
    ],
    color,
    4 * s,
  );
  c.restore();
}
