export const SAVE_KEY = "wiserax-pocket-arcade-v1";
const GAME_IDS = new Set([
  "robot",
  "factory",
  "ricochet",
  "diner",
  "drill",
  "harbor",
  "train",
  "mech",
  "worlds",
  "cleanup",
]);
const PERKS = new Set([
  "insight",
  "supplies",
  "recovery",
  "welcome",
  "capacity",
  "patience",
  "spares",
  "brush",
  "payout",
]);
export const perkCap = (key) => (key === "recovery" ? 3 : 5);
export const defaultGame = () => ({
  level: 1,
  coins: 0,
  stars: {},
  runs: 0,
  wins: 0,
  best: 0,
  perks: {},
  daily: {},
  active: null,
  collection: [],
  gallery: [],
  mastery: { effort: 0, a: 0, b: 0, themes: [] },
});
export function cleanGame(v) {
  const d = defaultGame();
  if (!v || typeof v !== "object") return d;
  for (const k of ["level", "coins", "runs", "wins", "best"])
    if (Number.isFinite(v[k]))
      d[k] = Math.max(
        k === "level" ? 1 : 0,
        Math.min(k === "level" ? 999 : 1e8, Math.floor(v[k])),
      );
  for (const [key, value] of Object.entries(v.stars || {}))
    if (/^\d{1,3}$/.test(key) && Number.isFinite(value))
      d.stars[key] = Math.max(0, Math.min(3, Math.floor(value)));
  for (const [key, value] of Object.entries(v.perks || {}))
    if (PERKS.has(key) && Number.isFinite(value))
      d.perks[key] = Math.max(0, Math.min(perkCap(key), Math.floor(value)));
  // Recovery above three could not restore any additional hearts. Refund those legacy ranks once.
  if (Number.isFinite(v.perks?.recovery)) {
    const oldRank = Math.max(0, Math.min(5, Math.floor(v.perks.recovery)));
    for (let rank = 3; rank < oldRank; rank++)
      d.coins = Math.min(1e8, d.coins + 60 + rank * 65);
  }
  for (const [key, value] of Object.entries(v.daily || {}))
    if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isFinite(value))
      d.daily[key] = Math.max(0, Math.floor(value));
  if (v.active && typeof v.active === "object") d.active = v.active;
  if (v.mastery && typeof v.mastery === "object") {
    for (const key of ["effort", "a", "b"])
      if (Number.isFinite(v.mastery[key]))
        d.mastery[key] = Math.max(
          0,
          Math.min(key === "effort" ? 1e8 : 1, Math.floor(v.mastery[key])),
        );
    if (Array.isArray(v.mastery.themes))
      d.mastery.themes = [
        ...new Set(
          v.mastery.themes.filter(
            (n) => Number.isInteger(n) && n >= 0 && n < 6,
          ),
        ),
      ];
  }
  if (Array.isArray(v.collection))
    d.collection = v.collection
      .filter((n) => Number.isInteger(n) && n > 0 && n < 1000)
      .slice(-999);
  if (Array.isArray(v.gallery))
    d.gallery = v.gallery
      .slice(-999)
      .filter(
        (r) =>
          r &&
          Number.isInteger(r.level) &&
          r.level > 0 &&
          r.level < 1000 &&
          r.state?.done &&
          r.state?.win &&
          Array.isArray(r.state.floor) &&
          Array.isArray(r.state.items),
      )
      .map((r) => {
        const tile = (p) =>
          p &&
          Number.isInteger(p.x) &&
          Number.isInteger(p.y) &&
          p.x >= 0 &&
          p.x < 5 &&
          p.y >= 0 &&
          p.y < 5;
        return {
          level: r.level,
          seed: Number(r.seed) || 1,
          state: {
            time: 0,
            score: 300,
            done: true,
            win: true,
            _rng: Number(r.seed) || 1,
            mode: "decorate",
            theme: Math.max(0, Math.min(5, Math.floor(r.state.theme) || 0)),
            palette: Math.max(0, Math.min(3, Math.floor(r.state.palette) || 0)),
            styles: Array.from({ length: 6 }, (_, i) =>
              Math.max(0, Math.min(2, Math.floor(r.state.styles?.[i]) || 0)),
            ),
            flips: Array.from(
              { length: 6 },
              (_, i) => r.state.flips?.[i] === true,
            ),
            floor: r.state.floor.filter(tile).slice(0, 25),
            items: r.state.items
              .filter(
                (p) =>
                  tile(p) &&
                  Number.isInteger(p.type) &&
                  p.type >= 0 &&
                  p.type < 6,
              )
              .slice(0, 6),
            dirt: [],
            repairs: [],
            selected: 0,
            placed: 6,
            cleaned: 12,
            fixes: 9,
          },
        };
      });
  return d;
}
export function load(storage = localStorage) {
  try {
    const v = JSON.parse(storage.getItem(SAVE_KEY) || "null");
    const d = {
      version: 1,
      games: {},
      settings: { sfx: 0.7, music: 0.35, motion: true },
      awards: [],
    };
    if (!v) return d;
    if (v.games && typeof v.games === "object")
      for (const [id, g] of Object.entries(v.games))
        if (GAME_IDS.has(id)) d.games[id] = cleanGame(g);
    if (v.settings) {
      for (const k of ["sfx", "music"])
        if (Number.isFinite(v.settings[k]))
          d.settings[k] = Math.max(0, Math.min(1, v.settings[k]));
      d.settings.motion = v.settings.motion !== false;
    }
    if (Array.isArray(v.awards))
      d.awards = v.awards
        .filter((v) => typeof v === "string" && v.length < 100)
        .slice(-200);
    return d;
  } catch {
    return {
      version: 1,
      games: {},
      settings: { sfx: 0.7, music: 0.35, motion: true },
      awards: [],
    };
  }
}
export function save(data, storage = localStorage) {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
export function settle(data, id, result) {
  const p = (data.games[id] ??= defaultGame());
  if (data.awards.includes(result.id)) return false;
  data.awards.push(result.id);
  data.awards = data.awards.slice(-200);
  p.runs++;
  p.wins += Number(result.win);
  p.coins += Math.max(0, Math.min(10000, Math.floor(result.reward)));
  p.best = Math.max(p.best, result.score || 0);
  if (result.win && !result.daily) {
    p.stars[result.level] = Math.max(
      p.stars[result.level] || 0,
      result.stars || 1,
    );
    p.level = Math.min(999, Math.max(p.level, result.level + 1));
  }
  if (result.daily) {
    p.daily[result.daily] = Math.max(
      p.daily[result.daily] || 0,
      result.score || 0,
    );
  }
  if (result.win && !p.collection.includes(result.level))
    p.collection.push(result.level);
  if (!p.active || p.active.id === result.id) p.active = null;
  return true;
}
export function buyPerk(p, key) {
  if (!PERKS.has(key)) return false;
  const lv = Number(p.perks[key]) || 0,
    cost = 60 + lv * 65;
  if (lv >= perkCap(key) || p.coins < cost) return false;
  p.coins -= cost;
  p.perks[key] = lv + 1;
  return true;
}
