// Small, bounded navigation grid for pointer steering around furniture.
// The same segment test prevents the vacuum from collecting through a bench.
export function segmentHitsBox(a, b, o, pad = 0) {
  let lo = 0,
    hi = 1;
  for (const [key, start, end] of [
    ["x", o.x - pad, o.x + o.w + pad],
    ["y", o.y - pad, o.y + o.h + pad],
  ]) {
    const d = b[key] - a[key];
    if (Math.abs(d) < 1e-9) {
      if (a[key] < start || a[key] > end) return false;
    } else {
      let u = (start - a[key]) / d,
        v = (end - a[key]) / d;
      if (u > v) [u, v] = [v, u];
      lo = Math.max(lo, u);
      hi = Math.min(hi, v);
      if (lo > hi) return false;
    }
  }
  return true;
}
export const clearPath = (a, b, obstacles, pad = 16) =>
  !obstacles.some((o) => segmentHitsBox(a, b, o, pad));
export function navigate(
  start,
  target,
  obstacles,
  bounds = { x: 24, y: 132, w: 372, h: 386 },
) {
  const destination = {
    x: Math.max(bounds.x, Math.min(bounds.x + bounds.w, target.x)),
    y: Math.max(bounds.y, Math.min(bounds.y + bounds.h, target.y)),
  };
  if (clearPath(start, destination, obstacles)) return [destination];
  const step = 18,
    nx = Math.floor(bounds.w / step) + 1,
    ny = Math.floor(bounds.h / step) + 1;
  const nodes = Array.from({ length: nx * ny }, (_, i) => ({
    x: bounds.x + (i % nx) * step,
    y: bounds.y + Math.floor(i / nx) * step,
  }));
  const free = nodes.map((p) => clearPath(p, p, obstacles));
  let first = -1,
    goal = -1,
    ds = Infinity,
    dg = Infinity;
  nodes.forEach((p, i) => {
    if (!free[i]) return;
    const a = Math.hypot(p.x - start.x, p.y - start.y),
      b = Math.hypot(p.x - destination.x, p.y - destination.y);
    if (a < ds && clearPath(start, p, obstacles)) {
      first = i;
      ds = a;
    }
    if (b < dg) {
      goal = i;
      dg = b;
    }
  });
  if (first < 0 || goal < 0) return [];
  const queue = [first],
    previous = new Int16Array(nodes.length).fill(-1);
  previous[first] = first;
  for (let at = 0; at < queue.length && previous[goal] < 0; at++) {
    const id = queue[at],
      x = id % nx,
      y = Math.floor(id / nx);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const xx = x + dx,
        yy = y + dy,
        j = yy * nx + xx;
      if (
        xx < 0 ||
        yy < 0 ||
        xx >= nx ||
        yy >= ny ||
        !free[j] ||
        previous[j] >= 0
      )
        continue;
      if (!clearPath(nodes[id], nodes[j], obstacles)) continue;
      previous[j] = id;
      queue.push(j);
    }
  }
  if (previous[goal] < 0) return [];
  const raw = [];
  for (let p = goal; p !== first; p = previous[p]) raw.push(nodes[p]);
  raw.push(nodes[first]);
  raw.reverse();
  if (clearPath(raw.at(-1), destination, obstacles)) raw.push(destination);
  const path = [];
  let current = start,
    index = 0;
  while (index < raw.length) {
    let far = index;
    for (let i = index; i < raw.length; i++)
      if (clearPath(current, raw[i], obstacles)) far = i;
    path.push(raw[far]);
    current = raw[far];
    index = far + 1;
  }
  return path;
}
