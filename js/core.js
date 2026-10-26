/* Daily Brain Gym: the app shell.
 *
 * Every game is a separate file in js/games/ that calls BT.registerGame({...}).
 * See README.md ("Adding a game") for the full game API. This file holds:
 * storage, dates and seeded randomness, the results log, the daily workout,
 * screens (home, play, progress, settings), sound, and progress sync.
 */
window.BT = window.BT || {};
BT.version = '26.10.26b';
BT.data = BT.data || {};
BT.games = [];
BT.gameById = {};

BT.categories = {
  words:      { name: 'Word games',  colour: '#7b4fb8' },
  crosswords: { name: 'Crosswords',  colour: '#b8457b' },
  numbers:    { name: 'Numbers',     colour: '#2b6cb0' },
  tiles:      { name: 'Tiles',       colour: '#2c7a6b' },
  memory:     { name: 'Memory',      colour: '#3f8a3a' },
  speed:      { name: 'Speed and focus', colour: '#c0661f' },
};

BT.DEFAULT_WORKOUT = ['daily-word', 'groups', 'word-hive', 'crossword', 'sudoku', 'mahjong'];

BT.registerGame = function (def) {
  if (!def.id || !def.start) throw new Error('A game needs an id and a start function');
  def.better = def.better || 'higher';
  BT.games.push(def);
  BT.gameById[def.id] = def;
};

/* ---------- storage ---------- */

const STORE_KEY = 'bt.v1';
let state = null;

function freshState() {
  return {
    device: Math.random().toString(36).slice(2, 10),
    settings: { name: '', textSize: 'large', sound: true, workout: BT.DEFAULT_WORKOUT.slice(), game: {}, syncCode: '' },
    results: [],
    saves: {},
    lastSync: null,
  };
}

BT.state = function () {
  if (state) return state;
  try { state = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { state = null; }
  if (!state || !state.settings) state = freshState();
  const fresh = freshState();
  state.settings = Object.assign(fresh.settings, state.settings);
  state.results = state.results || [];
  state.saves = state.saves || {};
  state.device = state.device || fresh.device;
  return state;
};

BT.persist = function () {
  const st = BT.state();
  // Keep results another open tab saved since this one loaded.
  try {
    const disk = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (disk && disk.results) {
      const mine = new Set(st.results.map(r => r.id));
      const extra = disk.results.filter(r => !mine.has(r.id) && !(st.deleted || []).includes(r.id));
      if (extra.length) st.results = st.results.concat(extra).sort((a, b) => a.ts - b.ts);
    }
  } catch (e) { /* ignore a damaged copy */ }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(st)); }
  catch (e) { console.warn('Could not save', e); }
};

BT.settings = function () { return BT.state().settings; };

/* Per-game settings declared by a game as def.settings = [{key, label, default}] */
BT.gameSetting = function (gameId, key) {
  const g = BT.settings().game[gameId] || {};
  if (key in g) return g[key];
  const def = (BT.gameById[gameId].settings || []).find(s => s.key === key);
  return def ? def.default : undefined;
};

/* ---------- dates and randomness ---------- */

function pad(n) { return String(n).padStart(2, '0'); }
BT.dateKey = function (d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
BT.today = function () { return BT.dateKey(new Date()); };
BT.parseDate = function (key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
BT.addDays = function (key, n) { const d = BT.parseDate(key); d.setDate(d.getDate() + n); return BT.dateKey(d); };
/* Whole days since 1 Jan 2026: use it to pick "today's" item from a list. */
BT.dayNumber = function (key) { return Math.round((BT.parseDate(key || BT.today()) - new Date(2026, 0, 1)) / 86400000); };
BT.niceDate = function (key) {
  return BT.parseDate(key).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
};

function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
/* A seeded random() so a daily puzzle is the same all day, on every device. */
BT.rng = function (seed) {
  let a = hashString(String(seed));
  const r = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (n) => Math.floor(r() * n);
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.shuffle = (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
  return r;
};

BT.fmtTime = function (ms) {
  const s = Math.round(ms / 1000), m = Math.floor(s / 60);
  return m + ':' + pad(s % 60);
};

/* ---------- results ---------- */

function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

BT.results = {
  all() { return BT.state().results; },
  add(r) {
    const rec = Object.assign({ id: newId(), ts: Date.now(), device: BT.state().device, synced: false }, r);
    BT.state().results.push(rec);
    BT.persist();
    BT.sync.push();
    return rec;
  },
  forGame(gameId, opts) {
    opts = opts || {};
    return BT.results.all().filter(r => r.game === gameId
      && (opts.mode === undefined || r.mode === opts.mode)
      && (opts.practice === undefined || !!r.practice === opts.practice));
  },
  /* The scored (non-practice) result for a daily game on a date. */
  daily(gameId, date, mode) {
    return BT.results.all().find(r => r.game === gameId && r.date === date && !r.practice && (mode == null || r.mode === mode));
  },
  playedOn(gameId, date) { return BT.results.all().some(r => r.game === gameId && r.date === date); },
  best(gameId, mode, exceptId) {
    const g = BT.gameById[gameId];
    const list = BT.results.forGame(gameId, { mode }).filter(r => r.won !== false && typeof r.score === 'number' && r.id !== exceptId);
    if (!list.length) return null;
    return list.reduce((a, b) => (g.better === 'lower' ? (b.score < a.score ? b : a) : (b.score > a.score ? b : a)));
  },
};

/* Days in a row with at least one game played, ending today (or yesterday). */
BT.streak = function (results) {
  const days = new Set((results || BT.results.all()).map(r => r.date));
  let d = BT.today();
  if (!days.has(d)) d = BT.addDays(d, -1);
  let n = 0;
  while (days.has(d)) { n++; d = BT.addDays(d, -1); }
  return n;
};

/* ---------- small helpers ---------- */

BT.h = function (tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
};

BT.escape = function (s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); };

const loadedScripts = {};
BT.loadScript = function (src) {
  if (!loadedScripts[src]) {
    loadedScripts[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src + '?v=' + BT.version;
      s.onload = resolve;
      s.onerror = () => { delete loadedScripts[src]; reject(new Error('Could not load ' + src)); };
      document.head.append(s);
    });
  }
  return loadedScripts[src];
};

BT.toast = function (msg, ms) {
  const t = BT.h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms || 1800);
};

/* A simple dialog. buttons: [{label, value, primary}] -> Promise of the value. */
const openDialogs = new Set();
BT.dialog = function (title, body, buttons) {
  return new Promise(resolve => {
    const close = (v) => { wrap.remove(); openDialogs.delete(close); resolve(v); };
    openDialogs.add(close);
    const box = BT.h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' },
      title ? BT.h('h2', null, title) : null,
      typeof body === 'string' ? BT.h('div', { class: 'dialog-body', html: body }) : body,
      BT.h('div', { class: 'dialog-buttons' },
        (buttons || [{ label: 'OK', value: true, primary: true }]).map(b =>
          BT.h('button', { class: 'btn' + (b.primary ? ' primary' : ''), onclick: () => close(b.value) }, b.label))));
    const wrap = BT.h('div', { class: 'dialog-wrap', onclick: (e) => { if (e.target === wrap) close(undefined); } }, box);
    document.body.append(wrap);
  });
};
BT.confirm = function (title, body, yes) {
  return BT.dialog(title, body, [{ label: 'Cancel', value: false }, { label: yes || 'Yes', value: true, primary: true }]);
};

/* ---------- sound ---------- */

let audio = null;
BT.tone = function (freq, ms, type, vol) {
  if (!BT.settings().sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    const t = audio.currentTime, v = vol || 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
    o.connect(g); g.connect(audio.destination);
    o.start(t); o.stop(t + ms / 1000 + 0.05);
  } catch (e) { /* no audio available */ }
};
BT.sound = function (name) {
  const s = {
    tap: () => BT.tone(660, 60, 'sine', 0.06),
    good: () => { BT.tone(660, 120); setTimeout(() => BT.tone(880, 160), 110); },
    bad: () => BT.tone(200, 220, 'triangle', 0.12),
    win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => BT.tone(f, 220), i * 130)),
  }[name];
  if (s) s();
};

/* ---------- encouragement ---------- */

BT.cheer = function (won) {
  const good = ['Well done!', 'Brilliant!', 'Lovely work!', 'Splendid!', 'Superb!', 'Nicely done!', 'Great thinking!'];
  const ok = ['Good effort!', 'Nearly there!', 'Tricky one today!', 'Keep at it!', 'Tomorrow is a new puzzle!'];
  const list = won === false ? ok : good;
  return list[Math.floor(Math.random() * list.length)];
};

/* ---------- screens ---------- */

const app = () => document.getElementById('app');
let exitHandlers = [];
function runExit() { exitHandlers.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); exitHandlers = []; }

function greeting() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const name = BT.settings().name.trim();
  return part + (name ? ', ' + name : '');
}

function statusFor(g, date) {
  if (g.daily) {
    const modes = g.modes || [null];
    const done = modes.map(m => BT.results.daily(g.id, date, m && m.id)).filter(Boolean);
    if (!done.length) return null;
    return done[done.length - 1];
  }
  const today = BT.results.all().filter(r => r.game === g.id && r.date === date);
  return today.length ? today[today.length - 1] : null;
}

function gameCard(g, date, big) {
  const cat = BT.categories[g.category] || { colour: '#555' };
  const done = statusFor(g, date);
  return BT.h('a', { class: 'card' + (big ? ' big' : '') + (done ? ' done' : ''), href: '#/play/' + g.id, style: '--cat:' + cat.colour },
    BT.h('span', { class: 'card-icon', 'aria-hidden': 'true' }, g.icon || '★'),
    BT.h('span', { class: 'card-text' },
      BT.h('span', { class: 'card-name' }, g.name),
      BT.h('span', { class: 'card-blurb' }, done ? '✓ ' + (done.display || 'Done') : g.blurb || '')),
    done ? BT.h('span', { class: 'card-tick', 'aria-label': 'Done today' }, '✓') : null);
}

function footer() {
  return BT.h('footer', { class: 'foot' },
    BT.h('a', { href: '#/progress', class: 'btn' }, '📈 My progress'),
    BT.h('a', { href: '#/settings', class: 'btn' }, '⚙️ Settings'),
    BT.h('div', { class: 'version' }, 'Version ' + BT.version));
}

function showHome() {
  const date = BT.today();
  const s = BT.settings();
  const workout = s.workout.map(id => BT.gameById[id]).filter(Boolean);
  const doneCount = workout.filter(g => statusFor(g, date)).length;
  const streak = BT.streak();
  const others = BT.games.filter(g => !s.workout.includes(g.id));

  const root = BT.h('main', { class: 'home' },
    BT.h('header', { class: 'home-head' },
      BT.h('h1', null, greeting()),
      BT.h('p', { class: 'date' }, BT.niceDate(date))),
    BT.h('section', { class: 'summary' },
      BT.h('div', { class: 'pill' }, streak ? '🔥 ' + streak + (streak === 1 ? ' day' : ' days') + ' in a row' : '👋 Start your streak today'),
      workout.length ? BT.h('div', { class: 'pill' }, doneCount === workout.length ? '🎉 All of today\'s games done!' : doneCount + ' of ' + workout.length + ' done today') : null),
    BT.h('h2', null, "Today's games"),
    BT.h('div', { class: 'grid' }, workout.map(g => gameCard(g, date, true))),
    others.length ? BT.h('h2', null, 'More games') : null,
    others.length ? BT.h('div', { class: 'grid small' }, others.map(g => gameCard(g, date, false))) : null,
    footer());
  app().replaceChildren(root);
}

function playHeader(g, onHelp) {
  const status = BT.h('div', { class: 'play-status', 'aria-live': 'polite' });
  const head = BT.h('header', { class: 'play-head', style: '--cat:' + (BT.categories[g.category] || {}).colour },
    BT.h('a', { href: '#/', class: 'btn back' }, '← Home'),
    BT.h('h1', null, g.name),
    status,
    g.howTo ? BT.h('button', { class: 'btn help', 'aria-label': 'How to play', onclick: onHelp }, '?') : null);
  return { head, status };
}

function howTo(g) { return BT.dialog('How to play ' + g.name, g.howTo, [{ label: 'Got it', value: true, primary: true }]); }

async function showPlay(gameId, query) {
  const g = BT.gameById[gameId];
  if (!g) { location.hash = '#/'; return; }
  const token = routeToken;
  const stale = () => token !== routeToken;
  const date = BT.today();
  const { head, status } = playHeader(g, () => howTo(g));
  const body = BT.h('div', { class: 'play-body' });
  app().replaceChildren(BT.h('main', { class: 'play cat-' + g.category }, head, body));
  window.scrollTo(0, 0);

  const firstTime = !BT.results.forGame(g.id).length && !localStorage.getItem('bt.seen.' + g.id);
  if (firstTime && g.howTo) { localStorage.setItem('bt.seen.' + g.id, '1'); await howTo(g); if (stale()) return; }

  // Choose a mode (difficulty, puzzle type) when the game has several.
  let mode = query.mode ? (g.modes || []).find(m => m.id === query.mode) : null;
  if (g.modes && !mode) {
    body.replaceChildren(
      BT.h('p', { class: 'lead' }, g.modesPrompt || 'Choose one:'),
      BT.h('div', { class: 'mode-list' }, g.modes.map(m => {
        const done = g.daily && BT.results.daily(g.id, date, m.id);
        return BT.h('a', { class: 'btn big mode' + (done ? ' done' : ''), href: '#/play/' + g.id + '?mode=' + m.id },
          BT.h('span', null, m.name), BT.h('small', null, done ? '✓ ' + done.display : (m.blurb || '')));
      })));
    return;
  }

  const practice = query.practice === '1' || !g.daily;
  const already = g.daily && !practice && BT.results.daily(g.id, date, mode && mode.id);
  if (already) { showResult(g, already, mode, true); return; }

  if (g.scripts) {
    body.replaceChildren(BT.h('p', { class: 'lead' }, 'Loading…'));
    try { await Promise.all(g.scripts.map(BT.loadScript)); }
    catch (e) { body.replaceChildren(BT.h('p', { class: 'lead' }, 'Sorry, this game could not load. Check the internet connection and try again.')); return; }
    if (stale()) return;
  }

  const seed = practice ? g.id + '-' + Date.now() + '-' + Math.random() : g.id + '|' + date + '|' + (mode ? mode.id : '');
  const saveKey = g.id + '|' + (mode ? mode.id : '') + '|' + (practice ? 'practice' : date);
  let finished = false;
  const started = Date.now();
  body.replaceChildren();
  const ctx = {
    el: body, game: g, date, mode: mode ? mode.id : null, practice, seed,
    rng: BT.rng(seed),
    setting: (key) => BT.gameSetting(g.id, key),
    setStatus: (text) => { status.textContent = text || ''; },
    save: (data) => { BT.state().saves[saveKey] = { seed, data, ts: Date.now() }; BT.persist(); },
    load: () => { const s = BT.state().saves[saveKey]; return s ? s.data : null; },
    savedSeed: () => { const s = BT.state().saves[saveKey]; return s ? s.seed : null; },
    clearSave: () => { delete BT.state().saves[saveKey]; BT.persist(); },
    onExit: (fn) => exitHandlers.push(fn),
    sound: BT.sound, tone: BT.tone, toast: BT.toast,
    finish: (res) => {
      if (finished) return;
      finished = true;
      delete BT.state().saves[saveKey];
      const rec = BT.results.add({
        game: g.id, mode: mode ? mode.id : null, date, practice: practice && !!g.daily,
        score: res.score, won: res.won, display: res.display, detail: res.detail || null,
        ms: res.ms != null ? res.ms : Date.now() - started,
      });
      runExit();
      setTimeout(() => showResult(g, rec, mode, false, res), res.delay != null ? res.delay : 900);
    },
  };
  // A practice game in progress keeps its own seed so it resumes the same puzzle.
  if (practice && g.daily && ctx.savedSeed()) { ctx.seed = ctx.savedSeed(); ctx.rng = BT.rng(ctx.seed); }
  try { g.start(ctx); }
  catch (e) { console.error(e); body.replaceChildren(BT.h('p', { class: 'lead' }, 'Sorry, something went wrong starting this game.')); }
}

function showResult(g, rec, mode, revisit, res) {
  const best = BT.results.best(g.id, rec.mode, rec.id);
  let pb = false;
  if (rec.won !== false && typeof rec.score === 'number' && best) {
    pb = g.better === 'lower' ? rec.score < best.score : rec.score > best.score;
  }
  const { head } = playHeader(g, () => howTo(g));
  const modeQ = mode ? 'mode=' + mode.id + '&' : '';
  const bodyEl = BT.h('div', { class: 'play-body result' },
    BT.h('div', { class: 'result-icon', 'aria-hidden': 'true' }, rec.won === false ? '💪' : (pb ? '🏆' : '🌟')),
    BT.h('h2', null, revisit ? "You've done today's puzzle" : BT.cheer(rec.won)),
    BT.h('p', { class: 'result-line' }, rec.display || ''),
    pb && !revisit ? BT.h('p', { class: 'pb' }, 'New personal best!') : null,
    best && !pb && !revisit && best.display ? BT.h('p', { class: 'muted' }, 'Your best: ' + best.display) : null,
    res && res.extra ? res.extra : null,
    g.daily && !rec.practice ? BT.h('p', { class: 'muted' }, 'A new puzzle is ready tomorrow.') : null,
    BT.h('div', { class: 'result-buttons' },
      BT.h('a', { class: 'btn big primary', href: '#/' }, 'Back to today'),
      g.daily
        ? BT.h('a', { class: 'btn big', href: '#/play/' + g.id + '?' + modeQ + 'practice=1&t=' + Date.now() }, 'Play a practice puzzle')
        : BT.h('a', { class: 'btn big', href: '#/play/' + g.id + '?' + modeQ + 't=' + Date.now() }, 'Play again'),
      g.modes ? BT.h('a', { class: 'btn big', href: '#/play/' + g.id + '?t=' + Date.now() }, 'Choose another') : null));
  app().replaceChildren(BT.h('main', { class: 'play cat-' + g.category }, head, bodyEl));
  if (!revisit && rec.won !== false) BT.sound('win');
}

function showProgress() {
  const root = BT.h('main', { class: 'page' },
    BT.h('header', { class: 'play-head' }, BT.h('a', { href: '#/', class: 'btn back' }, '← Home'), BT.h('h1', null, 'My progress')));
  const body = BT.h('div', { class: 'page-body' });
  root.append(body, footer());
  app().replaceChildren(root);
  BT.stats.render(body, BT.results.all(), { name: BT.settings().name });
}

function showSettings() {
  const s = BT.settings();
  const save = () => { BT.persist(); applyTextSize(); };
  const field = (label, input, help) => BT.h('label', { class: 'field' }, BT.h('span', { class: 'field-label' }, label), input, help ? BT.h('small', null, help) : null);
  const name = BT.h('input', { type: 'text', value: s.name, placeholder: 'Your name', autocomplete: 'off', oninput: (e) => { s.name = e.target.value; save(); } });
  const sizes = [['normal', 'Normal'], ['large', 'Large'], ['xlarge', 'Extra large']];
  const size = BT.h('div', { class: 'seg' }, sizes.map(([v, l]) =>
    BT.h('button', { class: 'btn' + (s.textSize === v ? ' primary' : ''), onclick: () => { s.textSize = v; save(); showSettings(); } }, l)));
  const sound = BT.h('button', { class: 'btn' + (s.sound ? ' primary' : ''), onclick: () => { s.sound = !s.sound; save(); showSettings(); } }, s.sound ? '🔊 Sounds on' : '🔇 Sounds off');

  const workout = BT.h('div', { class: 'check-list' }, BT.games.map(g => {
    const on = s.workout.includes(g.id);
    return BT.h('button', { class: 'check' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on),
      onclick: () => {
        if (on) s.workout = s.workout.filter(id => id !== g.id);
        else s.workout = BT.games.map(x => x.id).filter(id => id === g.id || s.workout.includes(id));
        save(); showSettings();
      } }, BT.h('span', { class: 'box' }, on ? '✓' : ''), (g.icon || '') + ' ' + g.name);
  }));

  const gameOpts = BT.games.filter(g => g.settings && g.settings.length).map(g =>
    BT.h('div', { class: 'field' }, BT.h('span', { class: 'field-label' }, g.name),
      g.settings.map(opt => {
        const on = !!BT.gameSetting(g.id, opt.key);
        return BT.h('button', { class: 'check' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on),
          onclick: () => { s.game[g.id] = s.game[g.id] || {}; s.game[g.id][opt.key] = !on; save(); showSettings(); } },
          BT.h('span', { class: 'box' }, on ? '✓' : ''), opt.label);
      })));

  const syncInfo = BT.sync.enabled()
    ? (BT.state().lastSync ? 'Last shared ' + new Date(BT.state().lastSync).toLocaleString('en-GB') : 'Not shared yet')
    : (BT.config.syncUrl ? 'Enter the family code to share progress.' : 'Progress sharing is not switched on for this site yet.');
  const code = BT.h('input', { type: 'text', value: s.syncCode, placeholder: 'Family code', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    onchange: (e) => { s.syncCode = e.target.value.trim(); save(); BT.sync.push(true).then(showSettings); } });

  const root = BT.h('main', { class: 'page' },
    BT.h('header', { class: 'play-head' }, BT.h('a', { href: '#/', class: 'btn back' }, '← Home'), BT.h('h1', null, 'Settings')),
    BT.h('div', { class: 'page-body settings' },
      field('Your name', name, 'Used in the greeting on the home screen.'),
      field('Text size', size),
      field('Sound', sound),
      BT.h('div', { class: 'field' }, BT.h('span', { class: 'field-label' }, "Today's games"), BT.h('small', null, 'Tick the games you want on your home screen every day.'), workout),
      gameOpts,
      field('Share progress with family', code, syncInfo),
      BT.h('div', { class: 'field' }, BT.h('span', { class: 'field-label' }, 'Install'),
        BT.h('small', null, 'On an iPad: tap the Share button in Safari, then "Add to Home Screen". The games then open like an app and work without the internet.'))),
    footer());
  app().replaceChildren(root);
}

function applyTextSize() { document.documentElement.dataset.text = BT.settings().textSize; }

let routeToken = 0;
function route() {
  routeToken++;
  [...openDialogs].forEach(close => close(undefined));
  runExit();
  const hash = location.hash.replace(/^#\/?/, '');
  const [path, qs] = hash.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs || ''));
  const parts = path.split('/');
  if (parts[0] === 'play' && parts[1]) showPlay(parts[1], query);
  else if (parts[0] === 'progress') showProgress();
  else if (parts[0] === 'settings') showSettings();
  else showHome();
}

/* ---------- progress sync ----------
 * Results are pushed to the sync Worker (BT.config.syncUrl) with the family
 * code as the key. The device keeps everything locally either way; the
 * Worker merges by result id, so pushing twice is harmless. */
BT.sync = {
  enabled() { return !!(BT.config && BT.config.syncUrl && BT.settings().syncCode); },
  async push(all) {
    if (!BT.sync.enabled() || !navigator.onLine) return false;
    const st = BT.state();
    const pending = st.results.filter(r => all || !r.synced);
    if (!pending.length && !all) return true;
    try {
      const res = await fetch(BT.config.syncUrl.replace(/\/$/, '') + '/v1/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sync-Code': st.settings.syncCode },
        body: JSON.stringify({ device: st.device, name: st.settings.name, version: BT.version, results: pending.map(r => Object.assign({}, r, { synced: undefined })) }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const ids = new Set(pending.map(r => r.id));
      st.results.forEach(r => { if (ids.has(r.id)) r.synced = true; });
      st.lastSync = Date.now();
      BT.persist();
      return true;
    } catch (e) { console.warn('Sync failed', e); return false; }
  },
  async fetchAll(code) {
    const res = await fetch(BT.config.syncUrl.replace(/\/$/, '') + '/v1/results', { headers: { 'X-Sync-Code': code } });
    if (!res.ok) throw new Error(res.status === 404 ? 'No progress found for that code yet.' : 'Could not load progress (HTTP ' + res.status + ').');
    return res.json();
  },
};

/* Load every game in js/games-list.js, keeping that order. */
BT.loadGames = function () {
  return Promise.all(BT_GAMES.map(id => BT.loadScript('js/games/' + id + '.js').catch(e => console.error(e))))
    .then(() => { BT.games.sort((a, b) => BT_GAMES.indexOf(a.id) - BT_GAMES.indexOf(b.id)); });
};

BT.start = function () {
  const st = BT.state();
  const week = Date.now() - 7 * 86400000;
  Object.keys(st.saves).forEach(k => { if (st.saves[k].ts < week) delete st.saves[k]; });
  applyTextSize();
  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => BT.sync.push());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !location.hash.startsWith('#/play')) route(); });
  route();
  BT.sync.push();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
};
