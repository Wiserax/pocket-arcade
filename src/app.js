import { GAMES, byId } from "./catalog.js";
import { W, H, hash, clamp, uid } from "./core.js";
import { icon } from "./icons.js";
import {
  load,
  save,
  defaultGame,
  settle,
  buyPerk,
  perkCap,
  SAVE_KEY,
} from "./store.js";
import { AudioEngine } from "./audio.js";
import { masteryCards, recordMastery } from "./mastery.js";
import { restorable, upgradeRun } from "./run-state.js";
import { makePreview } from "./preview.js";
import { VERSION } from "./version.js";
import { nextTry, starGoal } from "./coaching.js";
const app = document.querySelector("#app");
const data = load();
const audio = new AudioEngine(data.settings);
const TAB_ID = uid();
const RUN_FORMAT = 4;
let screen = "home",
  selected = null,
  level = 1,
  tab = "journey",
  game = null,
  run = null,
  paused = false,
  modal = null,
  last = performance.now(),
  saveClock = 0,
  hudClock = 0,
  resultDelay = -1,
  toastTimer = null,
  canvas = null,
  ctx = null,
  transform = { s: 1, x: 0, y: 0 },
  pointerId = null;
let lastActions = "";
let pendingImport = null;
let galleryScene = null;
let galleryPage = 0;
let waitingWorker = null;
let gameMessage = null;
let modalReturnFocus = null;
const progress = (id) => (data.games[id] ??= defaultGame());
function readLatestProgress() {
  try {
    if (!localStorage.getItem(SAVE_KEY)) return;
    const latest = load();
    data.games = latest.games;
    data.awards = latest.awards;
  } catch {
    /* Memory-only play remains available when storage is blocked. */
  }
}
function persist() {
  if (!save(data))
    toast("Storage is unavailable. This run will stay in memory.");
}
function money(n) {
  return n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}
function biome(g, l) {
  return (
    g.biomes[Math.floor((l - 1) / 5) % g.biomes.length] +
    (l > 30 ? ` · Tour ${Math.ceil(l / 30)}` : "")
  );
}
function wallet(n) {
  return `<div class="wallet">${icon("coin", 29)}<b>${money(n)}</b></div>`;
}
function masteryBook(id, p) {
  const cards = masteryCards(id, p);
  return `<section class="mastery-book"><h3>Mastery book <small>${cards.filter((c) => c.complete).length}/${cards.length}</small></h3><p>Optional challenges to try at your own pace.</p>${cards.map((c) => `<article class="mastery-card ${c.complete ? "earned" : ""}"><div class="mastery-mark">${icon(c.complete ? "trophy" : "star", 31)}</div><div><strong>${c.title}</strong><p>${c.description}</p>${c.complete ? "<small>Complete ✓</small>" : `<div class="mastery-track"><i style="width:${(100 * c.value) / c.target}%"></i></div><small>${c.value}/${c.target}</small>`}</div></article>`).join("")}</section>`;
}
function roomGallery(g, p) {
  const rooms = [...p.gallery].sort((a, b) => b.level - a.level);
  const pages = Math.max(1, Math.ceil(rooms.length / 12));
  galleryPage = Math.max(0, Math.min(pages - 1, galleryPage));
  const visible = rooms.slice(galleryPage * 12, galleryPage * 12 + 12);
  const pager =
    pages > 1
      ? `<div class="journey-controls gallery-pager">${button("gallery-prev", "‹", "icon-btn", 'aria-label="Newer rooms" ' + (galleryPage === 0 ? "disabled" : ""))}<span>Page ${galleryPage + 1} / ${pages}</span>${button("gallery-next", "›", "icon-btn", 'aria-label="Older rooms" ' + (galleryPage === pages - 1 ? "disabled" : ""))}</div>`
      : "";
  return `<section id="room-gallery"><h3>Your miniature neighborhood</h3><p>${rooms.length} saved ${rooms.length === 1 ? "room" : "rooms"}. Every completed project keeps its furniture exactly where you left it.</p>${pager}<div class="gallery-grid">${visible.map((r) => `<button class="gallery-card" data-do="visit:${r.level}"><canvas data-room="${r.level}" aria-label="Project ${r.level}"></canvas><strong>Project ${r.level}</strong><small>${biome(g, r.level)} · Visit →</small></button>`).join("") || "<p>Your finished rooms will appear here.</p>"}</div>${pager}</section>`;
}
function button(action, label, cls = "btn", extra = "") {
  return `<button class="${cls}" data-do="${action}" ${extra}>${label}</button>`;
}
function topbar(g = null) {
  return `<header class="topbar">${g ? button("home", icon("back"), "icon-btn", 'aria-label="All games"') : ""}<a class="brand" href="#">${icon("star", 38)}<span><strong>${g ? "Pocket Arcade" : "POCKET ARCADE"}</strong><small>${g ? "YOUR LITTLE ADVENTURE" : "TEN WORLDS TO PLAY"}</small></span></a>${g ? wallet(progress(g.id).coins) : ""}${button("settings", icon("gear"), "icon-btn", 'aria-label="Settings"')}</header>`;
}
function preview(el, g, l = 1) {
  const c = el.getContext("2d");
  el.width = 420;
  el.height = 430;
  const p = makePreview(g, l);
  c.translate(0, -85);
  p.render(c);
}
function home() {
  snapshot();
  readLatestProgress();
  audio.setGame("worlds");
  screen = "home";
  game = null;
  run = null;
  selected = null;
  canvas = null;
  closeModal(false);
  const wins = Object.values(data.games).reduce((a, p) => a + p.wins, 0);
  app.innerHTML = `<main class="shell">${topbar()}<section class="hero"><div><div class="eyebrow">SMALL GAMES. REAL ADVENTURES.</div><h1>What will you play today?</h1><p>Build a factory. Rescue a harbor. Wreck a robot.<br>Ten little worlds, each with a journey of its own.</p></div><div class="hero-badge"><b>${wins || 10}</b><small>${wins ? "ADVENTURES WON" : "GAMES TO DISCOVER"}</small></div></section><section class="game-grid">${GAMES.map(
    (g, i) => {
      const p = progress(g.id);
      return `<button class="game-card" data-game="${g.id}" style="--card-color:${g.color}"><div class="card-art"><canvas data-preview="${g.id}" aria-hidden="true"></canvas><span class="card-number">${String(i + 1).padStart(2, "0")}</span></div><div class="card-copy"><h2>${g.name}</h2><p>${g.desc}</p><div class="card-foot"><span>${g.genre}</span><b>${p.active ? "Resume →" : p.wins ? `${g.unit} ${p.level} →` : "Play →"}</b></div></div></button>`;
    },
  ).join(
    "",
  )}</section><p class="footer-note">Touch or mouse · Progress saves on this device · No accounts, ads, or energy timers<br>Pocket Arcade · Build ${VERSION}</p></main>`;
  document
    .querySelectorAll("[data-preview]")
    .forEach((el) => preview(el, byId(el.dataset.preview)));
}
function lobby(id = selected?.id) {
  snapshot();
  readLatestProgress();
  selected = byId(id);
  if (!selected) return home();
  game = null;
  run = null;
  canvas = null;
  screen = "lobby";
  paused = false;
  closeModal(false);
  const g = selected,
    p = progress(id);
  audio.setGame(g.id);
  level = Math.min(level, p.level);
  document.title = `${g.name} • Pocket Arcade`;
  history.replaceState(null, "", `#${id}`);
  let body = "";
  if (tab === "journey") {
    const resuming = p.active && !p.active.daily && p.active.level === level;
    body = `<div class="lobby-title"><div class="eyebrow">${g.tag}</div><h1>${g.name}</h1><p>${g.desc}</p></div><div class="lobby-art"><canvas id="lobby-preview" aria-label="${g.name} game preview"></canvas><div class="stage-label">${biome(g, level)}</div></div><div class="journey-controls">${button("prev", "‹", "icon-btn", 'aria-label="Previous stage" ' + (level <= 1 ? "disabled" : ""))}<div class="journey-stage"><h2>${g.unit} ${level}</h2><small>${p.stars[level] ? "★".repeat(p.stars[level]) + " · Cleared" : "A new adventure awaits"}</small></div>${button("next", "›", "icon-btn", 'aria-label="Next stage" ' + (level >= p.level ? "disabled" : ""))}</div>${button("start", `${resuming ? "CONTINUE" : g.verb.toUpperCase()}<small>${resuming ? "Your saved adventure is waiting" : "Jump straight into the game"}</small>`, "btn play-main")}${p.active ? `<div class="resume-note">${resuming ? "Progress saved · you can take your time" : button("continue-saved", p.active.daily ? `Resume daily · ${p.active.daily}` : `Resume saved ${g.unit.toLowerCase()} ${p.active.level}`, "small-link")}</div>` : ""}<div class="sub-options">${button("daily", `${icon("calendar", 31)}<span>Daily challenge<small>Same seed all day · local best</small></span>`, "sub-option")}${button("how", `${icon("eye", 31)}<span>How to play<small>One minute to learn</small></span>`, "sub-option")}</div>`;
  } else if (tab === "workshop") {
    const u = g.upgrade,
      lv = p.perks[u.key] || 0,
      maxLevel = perkCap(u.key),
      b = p.perks.payout || 0;
    body = `<section class="content"><div class="eyebrow">BETWEEN ADVENTURES</div><h1>The workshop</h1><p>Keep what you earn. Make small improvements for the next ${g.unit.toLowerCase()}. Your choices during play still matter most.</p><article class="upgrade-card"><div class="upgrade-head">${icon(u.icon, 51)}<div><h3>${u.name}</h3><div class="pips">${Array.from({ length: maxLevel }, (_, i) => `<i class="${i < lv ? "on" : ""}"></i>`).join("")}</div></div></div><p>${u.desc}. Level ${lv}/${maxLevel}.</p>${button(`buy:${u.key}`, lv >= maxLevel ? "Fully upgraded" : `${icon("coin", 24)} ${60 + lv * 65} · Upgrade`, "btn", lv >= maxLevel || p.coins < 60 + lv * 65 ? "disabled" : "")}</article><article class="upgrade-card"><div class="upgrade-head">${icon("coin", 49)}<div><h3>Salvage bonus</h3><div class="pips">${Array.from({ length: 5 }, (_, i) => `<i class="${i < b ? "on" : ""}"></i>`).join("")}</div></div></div><p>+5% end-of-run coins per level. Current bonus: ${b * 5}%. Does not change your in-game resource balance.</p>${button("buy:payout", b >= 5 ? "Fully upgraded" : `${icon("coin", 24)} ${60 + b * 65} · Upgrade`, "btn", b >= 5 || p.coins < 60 + b * 65 ? "disabled" : "")}</article><p>Earn coins through play. There are no purchases or ads.</p></section>`;
  } else {
    body = `<section class="content"><div class="eyebrow">YOUR JOURNEY SO FAR</div><h1>Adventure book</h1><p>Every attempt teaches you something. Your records stay on this device.</p><div class="record-grid"><div><b>${p.runs}</b><small>Completed attempts</small></div><div><b>${p.wins}</b><small>Adventures won</small></div><div><b>${p.best}</b><small>Best score</small></div><div><b>${Object.values(p.stars).reduce((a, b) => a + b, 0)}</b><small>Stars collected</small></div></div>${g.id === "worlds" ? roomGallery(g, p) : ""}<details class="collection-book" ${Object.keys(p.stars).length <= 30 ? "open" : ""}><summary>${g.unit} collection · ${Object.keys(p.stars).length} cleared</summary><div class="medals">${
      Object.entries(p.stars)
        .map(
          ([l, n]) =>
            `<button class="medal" data-replay="${l}">${l}<small>${"★".repeat(n)}</small></button>`,
        )
        .join("") ||
      '<p class="footer-note">Your first completed adventure will live here.</p>'
    }</div></details><h3>Daily records</h3>${
      Object.entries(p.daily)
        .slice(-7)
        .reverse()
        .map(
          ([day, score]) =>
            `<div class="result-rows"><div><span>${day}</span><b>${score} points</b></div></div>`,
        )
        .join("") ||
      '<p class="footer-note">Try today’s challenge from Journey.</p>'
    }</section>`;
  }
  app.innerHTML = `<main class="lobby" style="--game-color:${g.color};--accent:${g.accent}">${topbar(g)}${body}<nav class="tabs">${[
    ["journey", "play", "Journey"],
    ["workshop", "gear", "Workshop"],
    ["records", "trophy", "Records"],
  ]
    .map(([t, i, label]) =>
      button(
        `tab:${t}`,
        `${icon(i, 32)}${label}`,
        `tab ${tab === t ? "active" : ""}`,
      ),
    )
    .join("")}</nav></main>`;
  if (tab === "journey")
    preview(document.querySelector("#lobby-preview"), g, level);
  if (tab === "records")
    document
      .querySelector(".content")
      .insertAdjacentHTML("beforeend", masteryBook(g.id, p));
  for (const el of document.querySelectorAll("[data-room]")) {
    const room = p.gallery.find((r) => r.level === Number(el.dataset.room));
    el.width = 420;
    el.height = 560;
    new g.Game(room.seed, room.level, {}, structuredClone(room.state)).render(
      el.getContext("2d"),
    );
  }
}
function start({
  daily = false,
  fresh = false,
  seed = null,
  dailyDate = null,
} = {}) {
  readLatestProgress();
  const p = progress(selected.id);
  let active = !daily && !fresh ? upgradeRun(p.active) : null;
  const date = dailyDate || new Date().toISOString().slice(0, 10);
  if (active && !restorable(active, selected, RUN_FORMAT)) {
    p.active = null;
    active = null;
  }
  run = active || {
    id: uid(),
    format: RUN_FORMAT,
    game: selected.id,
    level: daily ? 8 : level,
    seed: seed ?? hash(`${selected.id}:${daily ? date : level + ":" + p.runs}`),
    daily: daily ? date : null,
    perks: daily ? {} : { ...p.perks },
    state: null,
  };
  run.owner = TAB_ID;
  try {
    game = new selected.Game(
      run.seed,
      run.level,
      run.perks || p.perks,
      run.state,
    );
  } catch (e) {
    console.error(e);
    p.active = null;
    run.state = null;
    game = new selected.Game(run.seed, run.level, run.perks || p.perks);
    toast("Saved run could not load. A fresh adventure is ready.");
  }
  audio.setGame(selected.id);
  game.audio = (n) => audio.play(n);
  game.toast = toast;
  screen = "play";
  paused = false;
  resultDelay = -1;
  gameMessage = null;
  lastActions = "";
  closeModal(false);
  app.innerHTML = `<main class="play-shell"><header class="play-top">${button("pause", icon("back", 22), "icon-btn", 'aria-label="Pause and menu"')}<h1>${selected.name}</h1><span class="level-chip">${run.daily ? "DAILY" : `${selected.unit} ${run.level}`}</span>${button("pause", icon("pause", 21), "icon-btn", 'aria-label="Pause"')}</header><div class="hud" id="hud"></div><div class="objective" id="objective"></div><div class="canvas-wrap"><canvas id="game-canvas" tabindex="0" aria-label="${selected.name} game area"></canvas></div><div class="action-bar" id="actions"></div></main>`;
  canvas = document.querySelector("#game-canvas");
  ctx = canvas.getContext("2d");
  bindInput();
  refreshHUD();
  snapshot(true);
  audio.unlock();
}
function refreshHUD() {
  if (!game || screen !== "play") return;
  document.querySelector("#hud").innerHTML = game
    .stats()
    .map(([k, v]) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`)
    .join("");
  const objective = document.querySelector("#objective");
  const message = gameMessage && performance.now() < gameMessage.until;
  objective.textContent = message ? gameMessage.text : game.objective();
  objective.classList.toggle("message", !!message);
  const actions = JSON.stringify(game.actions());
  if (actions !== lastActions) {
    lastActions = actions;
    document.querySelector("#actions").innerHTML = game
      .actions()
      .map(
        (a) =>
          `<button class="game-action" data-action="${a.id}" ${a.disabled ? "disabled" : ""}>${a.label}<small>${a.sub || ""}</small></button>`,
      )
      .join("");
  }
}
function snapshot(claim = false) {
  if (game && run && !game.s.done) {
    readLatestProgress();
    const p = progress(run.game);
    if (!claim && p.active?.owner && p.active.owner !== TAB_ID) {
      if (!modal)
        openModal(
          `<h2>Open in another tab</h2><p>This adventure has continued elsewhere. Keep playing there, or bring the latest saved state here.</p>${button("takeover", "Continue here")}${button("leave", "Back to the journey", "btn secondary")}`,
        );
      paused = true;
      clearInput();
      return false;
    }
    if (data.awards.includes(run.id)) {
      openModal(
        `<h2>Already completed</h2><p>This adventure was finished in another tab. Its rewards and progress are already saved.</p>${button("leave", "Back to the journey")}`,
      );
      return false;
    }
    run.state = game.save();
    p.active = JSON.parse(JSON.stringify(run));
    persist();
  }
  return true;
}
function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left - transform.x) / transform.s,
    y: (e.clientY - r.top - transform.y) / transform.s,
  };
}
function bindInput() {
  canvas.addEventListener("pointerdown", (e) => {
    if (paused || game.s.done || pointerId !== null) return;
    e.preventDefault();
    audio.unlock();
    pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    const p = point(e);
    Object.assign(game.input, p, { down: true });
    game.pointer(p.x, p.y, "down");
    refreshHUD();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (paused || pointerId !== e.pointerId) return;
    const p = point(e);
    Object.assign(game.input, p);
    game.pointer(p.x, p.y, "move");
  });
  const end = (e) => {
    if (pointerId !== e.pointerId) return;
    const p = point(e);
    game.input.down = false;
    pointerId = null;
    if (!paused) {
      game.pointer(p.x, p.y, "up");
      refreshHUD();
    }
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", () => {
    pointerId = null;
    if (game) game.input.down = false;
  });
}
function clearInput() {
  pointerId = null;
  if (game) {
    game.input.down = false;
    game.input.keys.clear();
    if (game.s.aiming) game.s.aiming = false;
  }
}
function openModal(html) {
  closeModal(false);
  paused = true;
  clearInput();
  modalReturnFocus = document.activeElement;
  app.inert = true;
  const el = document.createElement("div");
  el.className = "modal-shade";
  el.innerHTML = `<section class="modal" role="dialog" aria-modal="true" tabindex="-1" aria-labelledby="dialog-title">${html}</section>`;
  document.body.append(el);
  modal = el;
  if (el.querySelector(".result-body"))
    el.querySelector(".modal").classList.add("result-dialog");
  const heading = el.querySelector("h2");
  if (heading) heading.id = "dialog-title";
  el.querySelector(".modal").focus({ preventScroll: true });
}
function closeModal(resume = true) {
  if (modal) {
    galleryScene = null;
    modal.remove();
    modal = null;
    app.inert = false;
    if (modalReturnFocus?.isConnected)
      modalReturnFocus.focus({ preventScroll: true });
    modalReturnFocus = null;
  }
  if (resume) paused = false;
}
function pause() {
  if (!game || game.s.done) return;
  if (!snapshot()) return;
  openModal(
    `<div class="eyebrow">TAKE YOUR TIME</div><h2>Adventure paused</h2><p>Your progress is saved. Come back whenever you’re ready.</p>${button("resume", "Keep playing")}${button("leave", "Save & leave", "btn secondary")}${button("how", "How to play", "btn secondary")}${button("settings", "Sound & settings", "btn secondary")}${button("restart-confirm", "Restart this adventure", "small-link")}`,
  );
}
function result() {
  if (!game || !run) return;
  readLatestProgress();
  const g = game,
    r = run,
    p = progress(r.game);
  if (
    !data.awards.includes(r.id) &&
    p.active &&
    (p.active.id !== r.id || p.active.owner !== TAB_ID)
  ) {
    openModal(
      `<h2>Continued in another tab</h2><p>The newer adventure is safe. Continue from its latest saved position.</p>${button("takeover", "Continue here")}${button("leave", "Back to the journey", "btn secondary")}`,
    );
    return;
  }
  if (r.edit) {
    if (!data.awards.includes(r.id)) {
      data.awards.push(r.id);
      data.awards = data.awards.slice(-200);
      p.gallery = p.gallery.filter((room) => room.level !== r.level);
      p.gallery.push({ level: r.level, seed: r.seed, state: g.save() });
      p.gallery = p.gallery.slice(-999);
      if (p.active?.id === r.id) p.active = null;
      persist();
    }
    openModal(
      `<div class="result-icon">${icon("star", 80)}</div><div class="eyebrow">YOUR PLACE, YOUR WAY</div><h2>Changes saved</h2><p>Your room keeps its new layout, colors, and furniture finishes. Revisit it whenever you like.</p>${button("back-gallery", "Back to my neighborhood")}`,
    );
    return;
  }
  const reward = Math.round(g.reward() * (1 + (p.perks.payout || 0) * 0.05));
  const result = {
    id: r.id,
    level: r.level,
    win: g.s.win,
    score: Math.round(g.s.score),
    reward,
    stars: g.stars(),
    daily: r.daily,
  };
  const previousMastery = new Set(
    masteryCards(r.game, p)
      .filter((c) => c.complete)
      .map((c) => c.key),
  );
  const awarded = settle(data, r.game, result);
  if (awarded) recordMastery(r.game, p, g);
  const newMastery = awarded
    ? masteryCards(r.game, p).filter(
        (c) => c.complete && !previousMastery.has(c.key),
      )
    : [];
  if (awarded && r.game === "worlds" && g.s.win && !r.daily) {
    p.gallery = p.gallery.filter((room) => room.level !== r.level);
    p.gallery.push({ level: r.level, seed: r.seed, state: g.save() });
    p.gallery = p.gallery.slice(-999);
  }
  persist();
  const details = g.details();
  openModal(
    `<div class="result-body"><div class="result-icon">${icon(g.s.win ? "trophy" : "shield", 64)}</div><div class="eyebrow">${g.s.win ? "ADVENTURE COMPLETE" : "EVERY RUN COUNTS"}</div><h2>${g.s.reason || "A little progress"}</h2>${g.s.win ? `<div class="stars">${"★".repeat(g.stars())}</div>` : `<p>Your earned coins are safe.</p><div class="retry-tip"><b>TRY THIS NEXT</b><p>${nextTry(r.game, g.s)}</p></div>`}<div class="reward">${icon("coin", 39)}+${reward}</div><div class="result-rows">${details.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join("")}</div></div><div class="result-actions">${button(g.s.win && !r.daily ? "continue-next" : "retry", g.s.win && !r.daily ? "Next adventure" : "Play again")}${button("leave", "Back to the journey", "btn secondary")}</div>`,
  );
  if (newMastery.length)
    modal
      .querySelector(".result-rows")
      .insertAdjacentHTML(
        "beforebegin",
        `<div class="new-mastery">${icon("trophy", 27)}<div><small>NEW MASTERY</small><strong>${newMastery.map((c) => c.title).join(" · ")}</strong></div></div>`,
      );
  if (!awarded)
    modal.querySelector(".reward").innerHTML = "Reward already collected";
}
function beginRoomEdit(l) {
  readLatestProgress();
  const p = progress("worlds"),
    room = p.gallery.find((r) => r.level === l);
  if (!room) return;
  selected = byId("worlds");
  level = l;
  const initial = new selected.Game(room.seed, l, {}).s;
  p.active = {
    id: uid(),
    owner: TAB_ID,
    format: RUN_FORMAT,
    game: "worlds",
    level: l,
    seed: room.seed,
    perks: {},
    daily: null,
    edit: true,
    state: {
      ...initial,
      ...structuredClone(room.state),
      done: false,
      win: false,
      time: 0,
      score: 0,
      reason: "",
      mode: "decorate",
    },
  };
  persist();
  start();
}
function settings() {
  const wasPlaying = screen === "play" && !paused;
  snapshot();
  openModal(
    `<h2>Make yourself at home</h2><p>Original sounds, local progress, and room to take a break.</p><label class="setting">Sound effects <input data-setting="sfx" type="range" min="0" max="1" step="0.05" value="${data.settings.sfx}"></label><label class="setting">Music <input data-setting="music" type="range" min="0" max="1" step="0.05" value="${data.settings.music}"></label><label class="setting">Extra effects & camera shake <input data-setting="motion" type="checkbox" ${data.settings.motion ? "checked" : ""}></label>${button("close-settings", "Done")}<button class="small-link" data-do="export">Export my progress</button> · <button class="small-link" data-do="import">Restore backup</button><p style="font-size:10px;margin-top:17px">Saves stay in this browser. Backups restore coins, workshops, and records; unfinished runs are excluded on import.</p><p style="font-size:12px;margin-top:14px">On your phone, use your browser menu → Add to Home Screen. The published collection works offline after its first complete download.</p>${waitingWorker ? button("update-app", "Install ready update", "btn secondary") : ""}`,
  );
  modal.dataset.resume = wasPlaying ? "1" : "0";
}
function importProgress() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 3_000_000) throw new Error("Backup too large");
      const raw = await file.text(),
        parsed = JSON.parse(raw);
      if (
        parsed.version !== 1 ||
        !parsed.games ||
        typeof parsed.games !== "object"
      )
        throw new Error("Wrong format");
      pendingImport = load({ getItem: () => raw });
      for (const p of Object.values(pendingImport.games)) p.active = null;
      const count = Object.values(pendingImport.games).filter(
        (p) => p.runs > 0,
      ).length;
      openModal(
        `<h2>Restore your adventures?</h2><p>This backup contains progress for ${count} games. It will replace this browser's coins, upgrades, and records. Unfinished runs are not restored.</p>${button("confirm-import", "Restore this backup")}${button("close-settings", "Keep current progress", "btn secondary")}`,
      );
    } catch {
      toast("That file is not a valid Pocket Arcade backup.");
    }
  });
  input.click();
}
function toast(message) {
  if (screen === "play" && !modal && game) {
    gameMessage = { text: message, until: performance.now() + 2800 };
    refreshHUD();
    return;
  }
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
}
function how() {
  const instructions = {
    robot: [
      "Tap a shell in the bottom queue to load one of three cannons.",
      "Tap a matching exposed part. Break supports to reveal the next layer.",
      "Slots full? Undo a load and choose a different order.",
    ],
    factory: [
      "Shells travel from the furnace into left and right magazines.",
      "Tap a gun to select it. Upgrade it or refit to rapid, frost, splash, or piercing.",
      "Redirect supply toward pressure. Overdrive helps recover from a shortage.",
    ],
    ricochet: [
      "Drag anywhere in the arena to aim. Release to fire.",
      "Use walls to bank around shields. Barrels damage nearby enemies.",
      "Enemies advance after each volley. Clear five rooms and choose upgrades.",
    ],
    diner: [
      "Tap a stove to cook. Tap it again when the dish is ready.",
      "Tap a guest with the matching order, or use Serve tray.",
      "Switch your helper between cooking and serving. Upgrade when tips allow.",
    ],
    drill: [
      "Drag toward the rock to steer and drill. WASD also works.",
      "Gold and crystals fill your bag. Heat slows you down.",
      "Return to the surface to bank cargo. Later expeditions also require the marked ancient core. Reach both goals before time runs out.",
    ],
    harbor: [
      "Each boat moves only in its arrow direction.",
      "Tap a boat with a clear straight path to the edge.",
      "Free blocking boats first. Later harbors have key boats that open locks. Undo brings the last departure back.",
    ],
    train: [
      "Tap a dangerous enemy to focus your guns.",
      "Switch away from marked rails before artillery strikes. Steam surge briefly makes the train invulnerable.",
      "Tap a wagon to select it, then refit. At stations choose the next route.",
    ],
    mech: [
      "Tap a socket, then tap the part you want below the mech. Prices include an 80% refund for the replaced part.",
      "Weapons use power. Batteries add capacity; armor adds health but slows you.",
      "In combat, drag to drive. Guns track nearby enemies; Dash avoids incoming hits.",
    ],
    worlds: [
      "Rub the floor to remove dust.",
      "Tap each broken gear three times to repair it.",
      "Choose furniture at the bottom, then tap a free tile. Rearrange as you like.",
    ],
    cleanup: [
      "Drag to steer the vacuum. Your bag has limited capacity.",
      "Return to the sorting station at the bottom to unload.",
      "The wide head collects heavy clutter but moves slower. Filter prevents collecting items after their quota is filled.",
    ],
  };
  openModal(
    `<div class="result-icon">${icon("eye", 75)}</div><h2>${selected.name}</h2><div class="result-rows">${instructions[selected.id].map((v, i) => `<p style="text-align:left;margin:12px 0"><b style="color:#ffdb7a">${i + 1}.</b> ${v}</p>`).join("")}</div><div class="star-goal">${icon("star", 24)}<span>${starGoal(selected.id)}</span></div>${button("close-settings", "Got it")}`,
  );
}
app.addEventListener("click", (e) => {
  const card = e.target.closest("[data-game]");
  if (card) {
    audio.unlock();
    audio.play("click");
    selected = byId(card.dataset.game);
    level = progress(selected.id).level;
    tab = "journey";
    lobby();
    return;
  }
  const a = e.target.closest("[data-action]");
  if (a && game && !paused && !game.s.done) {
    audio.unlock();
    game.action(a.dataset.action);
    refreshHUD();
    snapshot();
    return;
  }
  const rp = e.target.closest("[data-replay]");
  if (rp) {
    level = Number(rp.dataset.replay);
    tab = "journey";
    lobby();
  }
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-do]");
  if (!b || b.disabled) return;
  audio.unlock();
  audio.play("click");
  const a = b.dataset.do;
  if (a === "home") {
    history.replaceState(null, "", "#");
    home();
  } else if (a === "settings") settings();
  else if (a === "gallery-prev" || a === "gallery-next") {
    galleryPage += a === "gallery-next" ? 1 : -1;
    lobby("worlds");
    document.querySelector("#room-gallery")?.scrollIntoView({
      behavior: data.settings.motion ? "smooth" : "instant",
      block: "start",
    });
  } else if (a.startsWith("visit:")) {
    const room = progress("worlds").gallery.find(
      (r) => r.level === Number(a.split(":")[1]),
    );
    if (room) {
      openModal(
        `<div class="eyebrow">YOUR MINIATURE NEIGHBORHOOD</div><h2>Project ${room.level}</h2><canvas id="room-visit" width="420" height="560" aria-label="Your restored miniature room"></canvas>${button(`edit-room:${room.level}`, "Rearrange & redecorate")}${button("close-settings", "Back to the neighborhood", "btn secondary")}`,
      );
      galleryScene = new (byId("worlds").Game)(
        room.seed,
        room.level,
        {},
        structuredClone(room.state),
      );
    }
  } else if (a.startsWith("edit-room:")) {
    const l = Number(a.split(":")[1]);
    if (progress("worlds").active)
      openModal(
        `<h2>Revisit project ${l}?</h2><p>This replaces your unfinished Tiny Worlds adventure. Completed rooms and rewards stay saved.</p>${button(`edit-confirm:${l}`, "Open the studio")}${button("close-settings", "Keep my adventure", "btn secondary")}`,
      );
    else beginRoomEdit(l);
  } else if (a.startsWith("edit-confirm:"))
    beginRoomEdit(Number(a.split(":")[1]));
  else if (a === "back-gallery") {
    game = null;
    run = null;
    tab = "records";
    lobby("worlds");
  } else if (a === "start") {
    const active = progress(selected.id).active;
    if (active && (active.daily || active.level !== level))
      openModal(
        `<h2>Start ${selected.unit.toLowerCase()} ${level}?</h2><p>This replaces ${active.daily ? "your unfinished daily challenge" : `the unfinished adventure at ${selected.unit.toLowerCase()} ${active.level}`}. Your completed stages, coins, and workshop remain saved.</p>${button("start-selected", "Start selected adventure")}${button("close-settings", "Keep saved adventure", "btn secondary")}`,
      );
    else start();
  } else if (a === "start-selected") start({ fresh: true });
  else if (a === "continue-saved") {
    level = progress(selected.id).active.level;
    start();
  } else if (a === "daily") {
    if (progress(selected.id).active) {
      openModal(
        `<h2>Try today’s challenge?</h2><p>Your current saved adventure will be replaced by the daily run.</p>${button("daily-confirm", "Start daily")}${button("close-settings", "Keep my adventure", "btn secondary")}`,
      );
    } else start({ daily: true, fresh: true });
  } else if (a === "daily-confirm") start({ daily: true, fresh: true });
  else if (a === "prev") {
    level--;
    lobby();
  } else if (a === "next") {
    level++;
    lobby();
  } else if (a.startsWith("tab:")) {
    tab = a.split(":")[1];
    lobby();
  } else if (a.startsWith("buy:")) {
    readLatestProgress();
    const key = a.split(":")[1];
    if (buyPerk(progress(selected.id), key)) {
      persist();
      audio.play("build");
      lobby();
    }
  } else if (a === "pause") pause();
  else if (a === "resume") {
    closeModal();
  } else if (a === "takeover") {
    start();
  } else if (a === "leave") {
    const id = selected.id;
    level = progress(id).level;
    tab = "journey";
    lobby(id);
  } else if (a === "retry") {
    const oldSeed = run.seed;
    const daily = !!run.daily;
    const dailyDate = run.daily;
    closeModal();
    start({ fresh: true, seed: oldSeed, daily, dailyDate });
  } else if (a === "continue-next") {
    level = progress(selected.id).level;
    closeModal();
    start({ fresh: true });
  } else if (a === "restart-confirm") {
    openModal(
      `<h2>Start this run again?</h2><p>Only the unfinished run resets. Your workshop and completed stages stay.</p>${button("retry", "Restart")}${button("resume", "Keep playing", "btn secondary")}`,
    );
  } else if (a === "close-settings") {
    closeModal();
  } else if (a === "how") how();
  else if (a === "import") importProgress();
  else if (a === "update-app" && waitingWorker) {
    snapshot();
    waitingWorker.postMessage("ACTIVATE_UPDATE");
  } else if (a === "confirm-import" && pendingImport) {
    game = null;
    run = null;
    data.games = pendingImport.games;
    data.awards = pendingImport.awards;
    Object.assign(data.settings, pendingImport.settings);
    pendingImport = null;
    persist();
    closeModal();
    home();
    toast("Your adventures have been restored.");
  } else if (a === "export") {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
      u = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = u;
    link.download = "pocket-arcade-save.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
});
document.addEventListener("input", (e) => {
  const k = e.target.dataset.setting;
  if (!k) return;
  readLatestProgress();
  data.settings[k] = k === "motion" ? e.target.checked : Number(e.target.value);
  document.body.classList.toggle("no-motion", !data.settings.motion);
  persist();
  if (k === "sfx") audio.play("coin");
});
window.addEventListener("keydown", (e) => {
  if (modal && e.key === "Tab") {
    const fields = [
      ...modal.querySelectorAll("button:not(:disabled), input, a[href]"),
    ];
    const first = fields[0],
      last = fields.at(-1);
    if (
      e.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === modal.querySelector(".modal"))
    ) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
    return;
  }
  if (e.key === "Escape") {
    if (modal && game?.s.done) {
      const exit = modal.querySelector(
        '[data-do="leave"], [data-do="back-gallery"]',
      );
      if (exit) exit.click();
      else closeModal();
    } else if (modal) closeModal();
    else pause();
    return;
  }
  if (game && !paused) {
    game.input.keys.add(e.key);
    if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
    )
      e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => game?.input.keys.delete(e.key));
window.addEventListener("blur", () => {
  audio.tick(false);
  clearInput();
  if (game && !game.s.done && !paused) pause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    audio.tick(false);
    snapshot();
    clearInput();
    if (game && !game.s.done && !paused) pause();
  }
});
window.addEventListener("pagehide", () => snapshot());
window.addEventListener("popstate", () => {
  tab = "journey";
  const g = byId(location.hash.slice(1));
  if (g) {
    selected = g;
    level = progress(g.id).level;
    lobby(g.id);
  } else home();
});
function frame(now) {
  const dt = Math.min(0.04, (now - last) / 1000);
  last = now;
  audio.tick(!document.hidden && (screen === "play" ? !paused : !modal));
  if (game && canvas) {
    if (!paused) {
      game.tick(dt);
      saveClock += dt;
      hudClock += dt;
      if (saveClock > 3) {
        snapshot();
        saveClock = 0;
      }
      if (hudClock > 0.12) {
        refreshHUD();
        hudClock = 0;
      }
      if (game.s.done) {
        if (resultDelay < 0) resultDelay = 0.8;
        else {
          resultDelay -= dt;
          if (resultDelay <= 0) {
            resultDelay = -1;
            result();
          }
        }
      }
    }
    const rect = canvas.getBoundingClientRect(),
      dpr = Math.min(2, devicePixelRatio || 1),
      width = Math.round(rect.width * dpr),
      height = Math.round(rect.height * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const s = Math.min(rect.width / W, rect.height / H),
      x = (rect.width - W * s) / 2,
      y = (rect.height - H * s) / 2;
    transform = { s, x, y };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#162e40";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.save();
    if (data.settings.motion && game.shake > 0)
      ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    game.render(ctx);
    if (data.settings.motion) game.drawFX(ctx);
    ctx.restore();
  }
  if (galleryScene && modal) {
    const el = document.querySelector("#room-visit");
    if (el) {
      if (data.settings.motion) galleryScene.tick(dt);
      galleryScene.render(el.getContext("2d"));
    }
  }
  requestAnimationFrame(frame);
}
document.body.classList.toggle("no-motion", !data.settings.motion);
const initial = byId(location.hash.slice(1));
if (initial) {
  selected = initial;
  level = progress(initial.id).level;
  lobby(initial.id);
} else home();
requestAnimationFrame(frame);
// Local QA access exposes the same game object the player uses, not a separate simulation.
window.__arcade = {
  get game() {
    return game;
  },
  get run() {
    return run;
  },
  get data() {
    return data;
  },
  get selected() {
    return selected;
  },
  get paused() {
    return paused;
  },
  GAMES,
  audio,
  start,
  home,
  lobby,
  refreshHUD,
  snapshot,
  settle,
  version: VERSION,
};

document.fonts.ready.then(() => {
  document
    .querySelectorAll("[data-preview]")
    .forEach((el) => preview(el, byId(el.dataset.preview)));
  const el = document.querySelector("#lobby-preview");
  if (el && selected) preview(el, selected, level);
});

if (
  "serviceWorker" in navigator &&
  document.querySelector('meta[name="arcade-build"]')?.content !== "development"
) {
  navigator.serviceWorker
    .register("./sw.js")
    .then((registration) => {
      const ready = () => {
        waitingWorker = registration.waiting;
        if (waitingWorker && navigator.serviceWorker.controller)
          toast(
            "A new version is ready. Install it from Settings when you finish playing.",
          );
      };
      ready();
      registration.addEventListener("updatefound", () =>
        registration.installing?.addEventListener("statechange", ready),
      );
    })
    .catch(() =>
      toast("Offline download is unavailable; online play still works."),
    );
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (controlled) {
      snapshot();
      location.reload();
    }
    controlled = true;
  });
}
