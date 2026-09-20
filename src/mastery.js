// Optional, permanent goals. These recognize play; they never sell combat power.
const SPECS = {
  robot: [
    "Salvage crew",
    "Recover 250 robot parts",
    250,
    "Careful hands",
    "Clear an armored robot (stage 6+) without Undo or Inspect",
    "Four-color expert",
    "Clear stage 15 or later without Undo",
  ],
  factory: [
    "Hold the line",
    "Stop 1,000 attackers",
    1000,
    "Crossfire",
    "Win stage 5+ with two different gun types",
    "Cold steel",
    "Win stage 10+ with Frost and Rail guns",
  ],
  ricochet: [
    "Raider roundup",
    "Clear 400 raiders",
    400,
    "Untouchable",
    "Clear all five rooms with all 4 hearts",
    "Small volley",
    "Win without taking the extra-ball upgrade",
  ],
  diner: [
    "Neighborhood favorite",
    "Serve 200 happy guests",
    200,
    "Five-star service",
    "Finish a stage 5+ service without losing a guest",
    "Critics welcome",
    "Finish stage 11+ with no missed guests",
  ],
  drill: [
    "Deep pockets",
    "Bank 1,000 ore",
    1000,
    "Core courier",
    "Return an ancient core with 65 seconds to spare",
    "Deep expedition",
    "Complete stage 15+ with the ancient core",
  ],
  harbor: [
    "Safe passage",
    "Rescue 500 passengers",
    500,
    "Locksmith",
    "Clear a key harbor (stage 6+) with no mistakes or hints",
    "Harbor master",
    "Clear stage 16+ with no mistakes or hints",
  ],
  train: [
    "Rail guardian",
    "Stop 800 bandits",
    800,
    "Precious cargo",
    "Finish with at least two Cargo wagons fitted",
    "Rolling fortress",
    "Finish stage 10+ with at least 75 hull",
  ],
  mech: [
    "Scrap veteran",
    "Scrap 600 enemies",
    600,
    "Mixed arsenal",
    "Win with two different weapon types fitted",
    "Light chassis",
    "Win stage 5+ without armor fitted",
  ],
  worlds: [
    "A little neighborhood",
    "Restore 15 rooms",
    15,
    "New horizons",
    "Restore a room in the second theme (project 6+)",
    "World traveler",
    "Restore a room in all six themes",
  ],
  cleanup: [
    "Nothing to waste",
    "Recycle 1,000 items",
    1000,
    "Ahead of schedule",
    "Finish stage 5+ with 80 seconds left",
    "Expert sorter",
    "Finish stage 15+ with no more than 6 bags unloaded",
  ],
};
export function masteryCards(id, p) {
  const a = SPECS[id],
    m = p.mastery || {};
  if (!a) return [];
  const cleared = Object.keys(p.stars).length;
  const perfect = Object.values(p.stars).filter((n) => n === 3).length;
  const rows = [
    [
      "first",
      "First adventure",
      "Win your first adventure",
      Number(p.wins > 0),
      1,
    ],
    [
      "perfect",
      "Star collector",
      "Earn three stars on 10 different stages",
      perfect,
      10,
    ],
    ["effort", a[0], a[1], m.effort || 0, a[2]],
    ["a", a[3], a[4], m.a || 0, 1],
    ["b", a[5], a[6], m.b || 0, 1],
    ["tour", "Full tour", "Clear 30 different stages", cleared, 30],
  ];
  return rows.map(([key, title, description, value, target]) => ({
    key,
    title,
    description,
    value: Math.min(target, value),
    target,
    complete: value >= target,
  }));
}
export function recordMastery(id, p, game) {
  const before = new Set(
    masteryCards(id, p)
      .filter((c) => c.complete)
      .map((c) => c.key),
  );
  const s = game.s,
    win = !!s.win,
    level = game.level;
  const m = (p.mastery ??= { effort: 0, a: 0, b: 0, themes: [] });
  m.themes ??= [];
  let effort = 0,
    a = false,
    b = false;
  switch (id) {
    case "robot":
      effort = s.nodes.filter((n) => n.gone).length;
      a = win && level >= 6 && !s.undos && !s.hintsUsed;
      b = win && level >= 15 && !s.undos;
      break;
    case "factory":
      effort = s.kills;
      a = win && level >= 5 && s.guns[0].type !== s.guns[1].type;
      b =
        win &&
        level >= 10 &&
        s.guns.some((g) => g.type === 2) &&
        s.guns.some((g) => g.type === 3);
      break;
    case "ricochet":
      effort = s.kills;
      a = win && s.hp === 4;
      b = win && s.volley === 7;
      break;
    case "diner":
      effort = s.served;
      a = win && level >= 5 && s.lost === 0;
      b = win && level >= 11 && s.lost === 0;
      break;
    case "drill":
      effort = s.bank;
      a = win && s.coreBanked && s.timeLeft >= 65;
      b = win && level >= 15 && s.coreBanked;
      break;
    case "harbor":
      effort = s.rescued;
      a = win && level >= 6 && s.mistakes === 0;
      b = win && level >= 16 && s.mistakes === 0;
      break;
    case "train":
      effort = s.kills;
      a = win && s.wagons.filter((v) => v === 2).length >= 2;
      b = win && level >= 10 && s.hp >= 75;
      break;
    case "mech":
      effort = s.kills;
      a = win && new Set(s.parts.filter((v) => v >= 1 && v <= 3)).size >= 2;
      b = win && level >= 5 && !s.parts.includes(4);
      break;
    case "worlds":
      effort = Number(win);
      a = win && level >= 6;
      if (win && !m.themes.includes(s.theme)) m.themes.push(s.theme);
      b = m.themes.length >= 6;
      break;
    case "cleanup":
      effort = s.bank.reduce((x, y) => x + y, 0);
      a = win && level >= 5 && s.timeLeft >= 80;
      b = win && level >= 15 && s.unloads <= 6;
      break;
  }
  m.effort = Math.min(1e8, (m.effort || 0) + Math.max(0, Number(effort) || 0));
  m.a = Number(!!m.a || a);
  m.b = Number(!!m.b || b);
  return masteryCards(id, p).filter((c) => c.complete && !before.has(c.key));
}
