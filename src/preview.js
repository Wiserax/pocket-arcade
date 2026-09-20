import { hash } from "./core.js";
// Isolated instances of the real games: previews never read or award player progress.
export function makePreview(def, level = 1) {
  const g = new def.Game(hash(def.id + "preview"), level, {}),
    s = g.s;
  let seconds = 0;
  if (def.id === "factory") {
    g.action("fit:2");
    seconds = 9;
  }
  if (def.id === "diner") {
    for (let i = 0; i < (level < 3 ? 2 : 3); i++)
      g.pointer(70 + i * 140, 430, "down");
    seconds = 8;
  }
  if (def.id === "train") {
    g.action("fit:4");
    g.action("safe");
    seconds = 12;
  }
  if (def.id === "mech") {
    g.action("fit:2");
    g.action("launch");
    Object.assign(g.input, { x: 245, y: 315, down: true });
    seconds = 7;
  }
  if (def.id === "cleanup") {
    g.action("head");
    Object.assign(g.input, { x: 210, y: 250, down: true });
    seconds = 3.5;
  }
  if (def.id === "drill") {
    Object.assign(g.input, { x: 190, y: 330, down: true });
    seconds = 4;
  }
  if (def.id === "worlds") {
    const point = (p) => [210 + (p.x - p.y) * 34, 255 + (p.x + p.y) * 18];
    for (const d of s.dirt) g.pointer(...point(d), "down");
    for (const r of s.repairs)
      for (let i = 0; i < 3; i++) g.pointer(...point(r), "down");
    // A different furnished layout per project, drawn from valid floor cells.
    for (const i of [0, 3, 2, 1, 4, 5]) {
      g.pointer(35 + i * 69, 512, "down");
      const tile = s.floor.filter(
        (p) => !s.items.some((v) => v.x === p.x && v.y === p.y),
      );
      const p = tile[Math.floor(g.random() * tile.length)];
      g.pointer(...point(p), "down");
    }
    g.action("finish");
  }
  for (let i = 0; i < seconds * 30 && !s.done; i++) g.tick(1 / 30);
  return g;
}
