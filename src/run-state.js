// A corrupt or obsolete unfinished run must never prevent access to a game.
export function upgradeRun(run) {
  if (!run || ![3, 4].includes(run.format) || !run.state) return run;
  const next = structuredClone(run);
  next.format = 4;
  if (next.game === "drill") {
    next.state.drillCell ??= -1;
    next.state.fullNotified ??= false;
  }
  if (next.game === "mech") next.state.chassis ??= 0;
  if (next.game === "train") next.state.captainSpawned ??= false;
  if (next.game === "worlds") {
    next.state.palette ??= 0;
    next.state.styles ??= [0, 0, 0, 0, 0, 0];
    next.state.flips ??= [false, false, false, false, false, false];
  }
  return next;
}
export function restorable(run, definition, format) {
  if (
    !run ||
    run.format !== format ||
    run.game !== definition.id ||
    typeof run.id !== "string" ||
    run.id.length > 100 ||
    !Number.isInteger(run.level) ||
    run.level < 1 ||
    run.level > 999 ||
    !Number.isInteger(run.seed) ||
    !run.state ||
    run.state.done
  )
    return false;
  let nodes = 0;
  function safe(value, depth = 0) {
    if (++nodes > 60000 || depth > 16) return false;
    if (typeof value === "number")
      return Number.isFinite(value) && Math.abs(value) <= 1e10;
    if (typeof value === "string") return value.length < 20000;
    if (value === null || typeof value === "boolean") return true;
    if (typeof value !== "object") return false;
    return Object.values(value).every((v) => safe(v, depth + 1));
  }
  function shape(value, template) {
    if (template === null) return true;
    if (Array.isArray(template)) return Array.isArray(value);
    if (typeof template !== typeof value || value === null) return false;
    if (typeof template === "object")
      return Object.entries(template).every(([k, v]) => shape(value[k], v));
    return true;
  }
  try {
    const initial = new definition.Game(run.seed, run.level, run.perks || {}).s;
    if (JSON.stringify(run.state).length > 2_000_000) return false;
    if (definition.id === "robot") {
      const { history, ...checkpoint } = initial;
      if (!Array.isArray(run.state.history) || run.state.history.length > 40)
        return false;
      for (const entry of run.state.history)
        if (!shape(JSON.parse(entry), checkpoint)) return false;
    }
    return safe(run.state) && shape(run.state, initial);
  } catch {
    return false;
  }
}
