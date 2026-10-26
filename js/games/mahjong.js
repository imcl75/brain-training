/* Mahjong Tiles: classic mahjong solitaire. Match pairs of free tiles.
 *
 * Positions are in half-tile units (x, y) plus a layer z, so layouts can use
 * half-tile offsets. Every deal is built by "reverse play": pairs are placed
 * onto positions that would be free given what is already placed, so the
 * puzzle can always be cleared. Shuffle uses the same builder on the tiles
 * that are left. Tile faces are drawn as inline SVG. */
(function () {
  const RATIO = 1.28;   // tile height / width
  const DEPTH = 0.13;   // tile thickness (and layer offset) / width

  /* ---------- layouts (tile units; converted to half units) ---------- */

  function row(out, z, y, x0, x1) { for (let x = x0; x <= x1; x++) out.push([x, y, z]); }
  function block(out, z, x0, x1, y0, y1) { for (let y = y0; y <= y1; y++) row(out, z, y, x0, x1); }

  const LAYOUT_DEFS = {
    gentle() {           // 72 tiles, 3 layers: a low pyramid with two end caps
      const t = [];
      row(t, 0, 0, 2, 9); block(t, 0, 1, 10, 1, 3); row(t, 0, 4, 2, 9);
      t.push([0, 2, 0], [11, 2, 0]);
      block(t, 1, 3, 8, 1, 3);
      for (const y of [1.5, 2.5]) for (const x of [4.5, 5.5, 6.5]) t.push([x, y, 2]);
      return t;
    },
    steady() {           // 114 tiles, 4 layers
      const t = [];
      row(t, 0, 0, 0, 11); row(t, 0, 1, 1, 10); row(t, 0, 2, 0, 11);
      row(t, 0, 3, 0, 11); row(t, 0, 4, 1, 10); row(t, 0, 5, 0, 11);
      block(t, 1, 2, 9, 1, 4);
      block(t, 2, 3, 8, 2, 3);
      t.push([5, 2.5, 3], [6, 2.5, 3]);
      return t;
    },
    classic() {          // the traditional 144-tile turtle
      const t = [];
      row(t, 0, 0, 1, 12); row(t, 0, 1, 3, 10); row(t, 0, 2, 2, 11); row(t, 0, 3, 1, 12);
      row(t, 0, 4, 1, 12); row(t, 0, 5, 2, 11); row(t, 0, 6, 3, 10); row(t, 0, 7, 1, 12);
      t.push([0, 3.5, 0], [13, 3.5, 0], [14, 3.5, 0]);
      block(t, 1, 4, 9, 1, 6);
      block(t, 2, 5, 8, 2, 5);
      block(t, 3, 6, 7, 3, 4);
      t.push([6.5, 3.5, 4]);
      return t;
    },
  };

  /* Positions with neighbour lists: above/below (any overlap on another
   * layer), left/right (touching on the same layer). */
  function buildGeo(tiles) {
    const g = tiles.map(([x, y, z]) => ({ x: Math.round(x * 2), y: Math.round(y * 2), z, above: [], below: [], left: [], right: [] }));
    for (let i = 0; i < g.length; i++) for (let j = 0; j < g.length; j++) {
      if (i === j) continue;
      const a = g[i], b = g[j], dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dy) >= 2) continue;
      if (b.z > a.z && Math.abs(dx) < 2) a.above.push(j);
      else if (b.z < a.z && Math.abs(dx) < 2) a.below.push(j);
      else if (b.z === a.z && dx === -2) a.left.push(j);
      else if (b.z === a.z && dx === 2) a.right.push(j);
    }
    return g;
  }
  const GEO = {};
  for (const k in LAYOUT_DEFS) GEO[k] = buildGeo(LAYOUT_DEFS[k]());

  /* ---------- tiles ----------
   * 0-8 dots 1-9, 9-17 bamboo 1-9, 18-26 characters 1-9, 27-30 winds E S W N,
   * 31-33 dragons red/green/white, 34-37 flowers, 38-41 seasons. */
  function matchKey(f) { return f < 34 ? f : f < 38 ? 34 : 38; }

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function isFree(geo, present, i) {
    const p = geo[i];
    if (p.above.some(j => present[j])) return false;
    return !p.left.some(j => present[j]) || !p.right.some(j => present[j]);
  }

  /* Reverse play: an order of position pairs such that removing the pairs in
   * reverse order is always legal. subset = positions to fill. */
  function placementOrder(geo, subset, rng, tries) {
    const n = geo.length;
    const inSub = new Uint8Array(n);
    subset.forEach(i => { inSub[i] = 1; });
    // Positions of each layer, left to right, for the boxed-in check.
    const layers = {};
    subset.forEach(i => { (layers[geo[i].z] = layers[geo[i].z] || []).push(i); });
    for (const z in layers) layers[z].sort((a, b) => geo[a].x - geo[b].x);
    const reachL = new Uint8Array(n), reachR = new Uint8Array(n);
    for (let t = 0; t < tries; t++) {
      const placed = new Uint8Array(n);
      const any = (list) => { for (const j of list) if (placed[j]) return true; return false; };
      const freeNow = (i) => !any(geo[i].above) && (!any(geo[i].left) || !any(geo[i].right));
      // An empty position with placed tiles reachable along empty positions on
      // both its left and its right can never be filled while free: the last
      // tile of that run would be boxed in. Never allow that to happen.
      const noBoxedRun = (z) => {
        const list = layers[z];
        for (let k = 0; k < list.length; k++) {
          const q = list[k];
          if (placed[q]) continue;
          let r = 0;
          for (const l of geo[q].left) if (inSub[l] && (placed[l] || reachL[l])) { r = 1; break; }
          reachL[q] = r;
        }
        for (let k = list.length - 1; k >= 0; k--) {
          const q = list[k];
          if (placed[q]) continue;
          let r = 0;
          for (const l of geo[q].right) if (inSub[l] && (placed[l] || reachR[l])) { r = 1; break; }
          reachR[q] = r;
          if (r && reachL[q]) return false;
        }
        return true;
      };
      const ok = (i) => {
        if (placed[i]) return false;
        for (const j of geo[i].below) if (inSub[j] && !placed[j]) return false;
        if (any(geo[i].above)) return false;
        placed[i] = 1;
        const r = freeNow(i) && noBoxedRun(geo[i].z);
        placed[i] = 0;
        return r;
      };
      const order = [];
      let left = subset.length;
      while (left > 0) {
        const cands = shuffle(subset.filter(ok), rng);
        let found = null;
        outer: for (let a = 0; a < cands.length; a++) {
          placed[cands[a]] = 1;
          for (let b = a + 1; b < cands.length; b++) {
            const B = cands[b];
            if (!ok(B)) continue;
            placed[B] = 1;
            if (freeNow(cands[a])) { found = [cands[a], B]; break outer; }
            placed[B] = 0;
          }
          placed[cands[a]] = 0;
        }
        if (!found) break;
        order.push(found);
        left -= 2;
      }
      if (left === 0) return order;
    }
    return null;
  }

  /* Face pairs for a fresh deal of n tiles: a random choice of the 72 pairs in
   * a full set (every kind appears 2 or 4 times). */
  function dealPairs(n, rng) {
    const units = [];
    for (let f = 0; f < 34; f++) units.push([f, f], [f, f]);
    units.push([34, 35], [36, 37], [38, 39], [40, 41]);
    return shuffle(units, rng).slice(0, n / 2);
  }

  /* Pair up the faces of the given positions by match key. */
  function pairFaces(faces, positions) {
    const list = positions.map(i => faces[i]).sort((a, b) => matchKey(a) - matchKey(b) || a - b);
    const out = [];
    for (let i = 0; i < list.length; i += 2) out.push([list[i], list[i + 1]]);
    return out;
  }

  function assign(faces, order, pairs, rng) {
    pairs = shuffle(pairs, rng);
    order.forEach(([a, b], k) => {
      const s = rng() < 0.5;
      faces[a] = pairs[k][s ? 1 : 0];
      faces[b] = pairs[k][s ? 0 : 1];
    });
  }

  function dealWithOrder(geo, rng) {
    const all = geo.map((_, i) => i);
    const faces = new Array(geo.length);
    const order = placementOrder(geo, all, rng, 400);
    const pairs = dealPairs(geo.length, rng);
    if (order) assign(faces, order, pairs, rng);
    else shuffle(pairs.flat(), rng).forEach((f, i) => { faces[i] = f; });   // never expected
    return { faces, order };
  }
  function makeDeal(geo, rng) { return dealWithOrder(geo, rng).faces; }

  /* Rearrange the faces on the given positions; returns true if the new
   * arrangement is known to be solvable. */
  function reshuffle(geo, faces, positions, rng) {
    const pairs = pairFaces(faces, positions);
    const order = placementOrder(geo, positions, rng, 300);
    if (order) { assign(faces, order, pairs, rng); return order; }
    shuffle(pairs.flat(), rng).forEach((f, k) => { faces[positions[k]] = f; });
    return null;
  }

  function findPairs(geo, faces, present) {
    const byKey = {}, pairs = [];
    geo.forEach((_, i) => {
      if (!present[i] || !isFree(geo, present, i)) return;
      const k = matchKey(faces[i]);
      (byKey[k] = byKey[k] || []).forEach(j => pairs.push([j, i]));
      byKey[k].push(i);
    });
    return pairs;
  }

  BT.mahjongLogic = { GEO, LAYOUT_DEFS, buildGeo, isFree, placementOrder, makeDeal, dealWithOrder, reshuffle, findPairs, matchKey, pairFaces };

  /* ---------- tile faces (SVG, viewBox 60 x 78) ---------- */

  const C = { B: '#1f5fae', G: '#2b8a3e', R: '#c8372d', K: '#1d2433' };
  const SANS = "-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif";
  const CJK = "'PingFang SC','Hiragino Sans GB','Heiti SC','Noto Sans CJK SC','Noto Sans SC','Microsoft YaHei',sans-serif";
  const corner = (n, c) => `<text x="5.5" y="15" font-size="13" font-weight="800" fill="${c}" font-family="${SANS}">${n}</text>`;

  function dot(x, y, r, c) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${r * 0.56}" fill="#fff"/><circle cx="${x}" cy="${y}" r="${r * 0.3}" fill="${c}"/>`;
  }
  const DOTS = {
    2: [[30, 28, 10, 'G'], [30, 60, 10, 'B']],
    3: [[17, 24, 9, 'B'], [30, 44, 9, 'R'], [43, 64, 9, 'G']],
    4: [[20, 28, 9, 'B'], [40, 28, 9, 'G'], [20, 60, 9, 'G'], [40, 60, 9, 'B']],
    5: [[19, 25, 8, 'B'], [41, 25, 8, 'G'], [30, 44, 8, 'R'], [19, 63, 8, 'G'], [41, 63, 8, 'B']],
    6: [[20, 24, 8, 'G'], [40, 24, 8, 'G'], [20, 44, 8, 'R'], [40, 44, 8, 'R'], [20, 64, 8, 'R'], [40, 64, 8, 'R']],
    7: [[18, 21, 6.5, 'G'], [30, 29, 6.5, 'G'], [42, 37, 6.5, 'G'], [20, 52, 6.5, 'R'], [40, 52, 6.5, 'R'], [20, 67, 6.5, 'R'], [40, 67, 6.5, 'R']],
    8: [20, 40].flatMap(x => [21, 36, 51, 66].map(y => [x, y, 6.5, 'B'])),
    9: [[24, 'B'], [44, 'R'], [64, 'G']].flatMap(([y, c]) => [17, 30, 43].map(x => [x, y, 7, c])),
  };

  function stick(x, y, h, c, w) {
    w = w || 7;
    const t = y - h / 2;
    return `<rect x="${x - w / 2}" y="${t}" width="${w}" height="${h}" rx="${w / 2}" fill="${c}"/>` +
      `<rect x="${x - 0.8}" y="${t + 2.5}" width="1.6" height="${h - 5}" rx=".8" fill="#fff" opacity=".45"/>` +
      `<rect x="${x - w / 2}" y="${y - 0.9}" width="${w}" height="1.8" fill="#fff" opacity=".85"/>`;
  }
  const STICKS = {
    2: [[30, 30, 24, 'G'], [30, 62, 24, 'B']],
    3: [[30, 30, 24, 'G'], [20, 62, 24, 'B'], [40, 62, 24, 'B']],
    4: [[20, 30, 24, 'G'], [40, 30, 24, 'B'], [20, 62, 24, 'B'], [40, 62, 24, 'G']],
    5: [[18, 30, 24, 'G'], [42, 30, 24, 'B'], [30, 46, 24, 'R'], [18, 62, 24, 'B'], [42, 62, 24, 'G']],
    6: [17, 30, 43].flatMap(x => [[x, 32, 24, 'G'], [x, 62, 24, 'B']]),
    7: [[30, 24, 17, 'R']].concat([17, 30, 43].flatMap(x => [[x, 46, 17, 'G'], [x, 66, 17, 'G']])),
    8: [13, 24.5, 35.5, 47].flatMap((x, i) => [[x, 32, 24, i % 3 ? 'B' : 'G'], [x, 62, 24, i % 3 ? 'G' : 'B']]),
    9: [[17, 'G'], [30, 'R'], [43, 'B']].flatMap(([x, c]) => [27, 47, 67].map(y => [x, y, 16, c])),
  };

  const WINDS = [['東', 'E', 'East'], ['南', 'S', 'South'], ['西', 'W', 'West'], ['北', 'N', 'North']];
  const FLOWERS = [['🌸', 'Blossom'], ['🌷', 'Tulip'], ['🌻', 'Sunflower'], ['🌹', 'Rose']];
  const SEASONS = [['🌱', 'Spring'], ['☀️', 'Summer'], ['🍂', 'Autumn'], ['❄️', 'Winter']];

  function faceInner(f) {
    if (f < 9) {
      const n = f + 1;
      if (n === 1) return `<circle cx="30" cy="44" r="20" fill="${C.B}"/><circle cx="30" cy="44" r="14.5" fill="#fff"/><circle cx="30" cy="44" r="11" fill="${C.R}"/><circle cx="30" cy="44" r="4.5" fill="#fff"/>` + corner(1, C.B);
      return DOTS[n].map(([x, y, r, c]) => dot(x, y, r, C[c])).join('') + corner(n, C.B);
    }
    if (f < 18) {
      const n = f - 8;
      if (n === 1) {
        return `<ellipse cx="41" cy="30" rx="10" ry="3.6" transform="rotate(-35 41 30)" fill="${C.G}"/>` +
          `<ellipse cx="19" cy="50" rx="10" ry="3.6" transform="rotate(35 19 50)" fill="${C.G}"/>` +
          stick(30, 45, 54, C.G, 11) + `<rect x="24.5" y="30" width="11" height="2.4" fill="${C.R}"/><rect x="24.5" y="58" width="11" height="2.4" fill="${C.R}"/>` + corner(1, C.G);
      }
      return STICKS[n].map(([x, y, h, c]) => stick(x, y, h, C[c], n === 8 ? 6 : 7)).join('') + corner(n, C.G);
    }
    if (f < 27) {
      return `<text x="30" y="43" font-size="38" font-weight="800" text-anchor="middle" fill="${C.K}" font-family="${SANS}">${f - 17}</text>` +
        `<text x="30" y="72" font-size="25" font-weight="700" text-anchor="middle" fill="${C.R}" font-family="${CJK}">萬</text>`;
    }
    if (f < 31) {
      const [g, l] = WINDS[f - 27];
      return `<text x="31" y="60" font-size="38" font-weight="700" text-anchor="middle" fill="${C.K}" font-family="${CJK}">${g}</text>` +
        `<text x="5.5" y="16" font-size="14" font-weight="800" fill="${C.B}" font-family="${SANS}">${l}</text>`;
    }
    if (f === 31) return `<text x="30" y="61" font-size="44" font-weight="700" text-anchor="middle" fill="${C.R}" font-family="${CJK}">中</text>`;
    if (f === 32) return `<text x="30" y="60" font-size="40" font-weight="700" text-anchor="middle" fill="${C.G}" font-family="${CJK}">發</text>`;
    if (f === 33) return `<rect x="12" y="13" width="36" height="52" rx="4" fill="none" stroke="${C.B}" stroke-width="4"/><rect x="18.5" y="19.5" width="23" height="39" rx="2" fill="none" stroke="${C.B}" stroke-width="2"/>`;
    if (f < 38) return `<circle cx="30" cy="40" r="23" fill="#fbd9e6"/><text x="30" y="52" font-size="31" text-anchor="middle">${FLOWERS[f - 34][0]}</text>` +
      `<text x="30" y="74" font-size="9.5" font-weight="800" text-anchor="middle" fill="#b0306a" font-family="${SANS}">FLOWER</text>`;
    return `<rect x="8" y="17" width="44" height="46" rx="10" fill="#d4ecf6"/><text x="30" y="52" font-size="30" text-anchor="middle">${SEASONS[f - 38][0]}</text>` +
      `<text x="30" y="74" font-size="9.5" font-weight="800" text-anchor="middle" fill="#1d6b8c" font-family="${SANS}">SEASON</text>`;
  }
  const faceCache = {};
  function faceSVG(f) {
    return faceCache[f] || (faceCache[f] = `<svg viewBox="0 0 60 78" aria-hidden="true" focusable="false">${faceInner(f)}</svg>`);
  }
  function faceName(f) {
    if (f < 9) return (f + 1) + ' of dots';
    if (f < 18) return (f - 8) + ' of bamboo';
    if (f < 27) return (f - 17) + ' of characters';
    if (f < 31) return WINDS[f - 27][2] + ' wind';
    if (f < 34) return ['Red', 'Green', 'White'][f - 31] + ' dragon';
    if (f < 38) return FLOWERS[f - 34][1] + ' flower';
    return SEASONS[f - 38][1] + ' season';
  }

  /* ---------- the game ---------- */

  const MODES = [
    { id: 'gentle', name: 'Gentle', blurb: '72 tiles on three low layers' },
    { id: 'steady', name: 'Steady', blurb: '114 tiles on four layers' },
    { id: 'classic', name: 'Classic', blurb: 'The traditional 144-tile turtle' },
  ];

  BT.registerGame({
    id: 'mahjong',
    name: 'Mahjong Tiles',
    category: 'tiles',
    icon: '🀄',
    blurb: 'Clear the board by matching pairs of free tiles',
    daily: true,
    better: 'lower',
    modes: MODES,
    modesPrompt: 'Choose a layout:',
    settings: [{ key: 'dimBlocked', label: 'Dim tiles that can\'t be moved', default: true }],
    howTo: `<p>Clear the board by matching pairs of identical tiles.</p>
      <p><b>Free tiles:</b> you can only use a tile that is <b>free</b>: nothing is lying on top of it, and its left side or its right side is open. Tiles that can't be moved yet are slightly dimmed.</p>
      <p>Tap a free tile to pick it, then tap its twin to clear both. Tap a picked tile again to put it back.</p>
      <p><b>Flowers and seasons:</b> any flower matches any other flower, and any season matches any other season.</p>
      <ul><li><b>Hint</b> shows you a pair you can clear.</li>
      <li><b>Undo</b> puts back the last pair.</li>
      <li><b>Shuffle</b> mixes up the tiles that are left, in a way that can still be finished. Handy if you get stuck.</li>
      <li><b>Give up</b> ends today's puzzle.</li></ul>
      <p>Every puzzle can be cleared. Your time is your score: there is no rush!</p>`,

    start(ctx) {
      const modeId = GEO[ctx.mode] ? ctx.mode : 'gentle';
      const modeName = (MODES.find(m => m.id === modeId) || MODES[0]).name;
      const geo = GEO[modeId];
      const N = geo.length;
      const zMax = Math.max(...geo.map(p => p.z));
      const spanX = Math.max(...geo.map(p => p.x)) / 2 + 1;   // tiles across
      const spanY = Math.max(...geo.map(p => p.y)) / 2 + 1;   // tiles down

      let faces, hist = [], hints = 0, shuffles = 0, undos = 0, ms = 0;
      const saved = ctx.load();
      if (saved && saved.v === 1 && saved.mode === modeId && Array.isArray(saved.faces) && saved.faces.length === N) {
        faces = saved.faces.slice();
        hist = saved.hist || [];
        hints = saved.hints || 0; shuffles = saved.shuffles || 0; undos = saved.undos || 0; ms = saved.ms || 0;
      } else {
        faces = makeDeal(geo, ctx.rng);
      }
      const present = new Uint8Array(N).fill(1);
      hist.forEach(([a, b]) => { present[a] = 0; present[b] = 0; });

      let sel = -1, over = false, hintTimer = null, stuckShown = false;
      let runFrom = null;
      const elapsed = () => ms + (runFrom != null ? performance.now() - runFrom : 0);
      const pause = () => { if (runFrom != null) { ms += performance.now() - runFrom; runFrom = null; } };
      const resume = () => { if (runFrom == null && !over && !document.hidden) runFrom = performance.now(); };
      const left = () => { let n = 0; for (let i = 0; i < N; i++) n += present[i]; return n; };

      /* --- DOM --- */
      const stage = BT.h('div', { class: 'mj-stage' });
      const felt = BT.h('div', { class: 'mj-felt' + (ctx.setting('dimBlocked') ? ' mj-dim' : '') }, stage);
      const msg = BT.h('div', { class: 'message mj-msg', 'aria-live': 'polite' });
      const btn = (label, fn) => BT.h('button', { class: 'btn', onclick: fn }, label);
      const hintBtn = btn('💡 Hint', () => hint());
      const undoBtn = btn('↩️ Undo', () => undo());
      const shuffleBtn = btn('🔀 Shuffle', () => doShuffle());
      const giveBtn = btn('Give up', () => giveUp());
      const buttons = BT.h('div', { class: 'game-buttons mj-buttons' }, hintBtn, undoBtn, shuffleBtn, giveBtn);
      ctx.el.append(BT.h('div', { class: 'mj-wrap' }, felt, msg, buttons));

      // Draw order: lower layers first, then left to right, top to bottom,
      // so each tile's edge tucks under its right and lower neighbours.
      const drawOrder = geo.map((_, i) => i).sort((a, b) => geo[a].z - geo[b].z || geo[a].x - geo[b].x || geo[a].y - geo[b].y);
      const tileEls = new Array(N), shown = new Array(N);
      drawOrder.forEach((i, rank) => {
        const el = BT.h('div', { class: 'mj-tile', 'data-i': i, role: 'button', style: 'z-index:' + (rank + 1) }, BT.h('div', { class: 'mj-face' }));
        tileEls[i] = el;
        stage.append(el);
      });

      function paint() {
        for (let i = 0; i < N; i++) {
          const el = tileEls[i];
          if (!present[i]) {
            if (!el.classList.contains('mj-going')) el.classList.add('mj-out');
            continue;
          }
          el.classList.remove('mj-out', 'mj-going');
          if (shown[i] !== faces[i]) {
            el.firstChild.innerHTML = faceSVG(faces[i]);
            el.setAttribute('aria-label', faceName(faces[i]));
            shown[i] = faces[i];
          }
          el.classList.toggle('mj-blocked', !isFree(geo, present, i));
          el.classList.toggle('mj-sel', i === sel);
        }
        undoBtn.disabled = !hist.length;
        status();
      }
      function status() {
        const n = left();
        ctx.setStatus(n + (n === 1 ? ' tile' : ' tiles') + ' left · ' + BT.fmtTime(elapsed()));
      }

      function fit() {
        const pad = 2 * (parseFloat(getComputedStyle(felt).paddingLeft) || 0);
        const availW = Math.max(200, felt.clientWidth - pad);
        const top = felt.getBoundingClientRect().top + window.scrollY;
        const below = msg.offsetHeight + buttons.offsetHeight + 48;
        const availH = Math.max(220, window.innerHeight - top - below - pad);
        const depthUnits = DEPTH * (zMax + 1);
        let w = Math.min(availW / (spanX + depthUnits), availH / (spanY * RATIO + depthUnits), 92);
        w = Math.max(16, Math.floor(w));
        const h = Math.round(w * RATIO), d = Math.max(3, Math.round(w * DEPTH));
        stage.style.width = Math.ceil(w * spanX + d * (zMax + 1)) + 'px';
        stage.style.height = Math.ceil(h * spanY + d * (zMax + 1)) + 'px';
        stage.style.setProperty('--w', w + 'px');
        stage.style.setProperty('--h', h + 'px');
        stage.style.setProperty('--d', d + 'px');
        stage.style.setProperty('--r', Math.round(w * 0.12) + 'px');
        geo.forEach((p, i) => {
          tileEls[i].style.left = (zMax * d + p.x / 2 * w - p.z * d) + 'px';
          tileEls[i].style.top = (zMax * d + p.y / 2 * h - p.z * d) + 'px';
        });
      }

      function save() {
        if (over) return;
        ctx.save({ v: 1, mode: modeId, faces, hist, hints, shuffles, undos, ms: Math.round(elapsed()) });
      }

      function say(text) { msg.textContent = text || ''; }
      function clearHint() {
        clearTimeout(hintTimer);
        tileEls.forEach(el => el.classList.remove('mj-hint'));
      }
      function shake(i) {
        const el = tileEls[i];
        el.classList.remove('mj-shake'); void el.offsetWidth; el.classList.add('mj-shake');
        say('That tile is not free yet. Try one with an open side.');
      }

      function tap(i) {
        if (over || !present[i]) return;
        resume();
        if (!isFree(geo, present, i)) { shake(i); return; }
        clearHint();
        if (sel === i) { sel = -1; say(''); paint(); return; }
        if (sel >= 0 && matchKey(faces[sel]) === matchKey(faces[i])) { removePair(sel, i); return; }
        sel = i;
        ctx.sound('tap');
        say('');
        paint();
      }

      function removePair(a, b) {
        hist.push([a, b, faces[a], faces[b]]);
        present[a] = 0; present[b] = 0;
        sel = -1;
        stuckShown = false;
        [a, b].forEach(i => {
          const el = tileEls[i];
          el.classList.remove('mj-sel', 'mj-hint');
          el.classList.add('mj-going');
          setTimeout(() => { if (!present[i]) { el.classList.remove('mj-going'); el.classList.add('mj-out'); } }, 320);
        });
        ctx.tone(784, 150, 'sine', 0.07);
        setTimeout(() => ctx.tone(1047, 200, 'sine', 0.05), 90);
        shuffleBtn.classList.remove('primary');
        undoBtn.classList.remove('primary');
        say('');
        paint();
        if (!left()) { win(); return; }
        save();
        checkStuck();
      }

      const presentList = () => { const a = []; for (let i = 0; i < N; i++) if (present[i]) a.push(i); return a; };
      const newRng = () => BT.rng('mj-shuffle-' + Date.now() + '-' + Math.random());
      // Can the tiles that are left be cleared in some arrangement? (Not when,
      // say, the last two are stacked on top of each other.)
      const canBeCleared = () => !!placementOrder(geo, presentList(), newRng(), 300);

      function checkStuck() {
        if (over || findPairs(geo, faces, present).length) return false;
        if (!canBeCleared()) {
          undoBtn.classList.add('primary');
          say('The tiles left are stacked on each other, so they can\'t be cleared. Tap Undo to step back.');
          if (!stuckShown) {
            stuckShown = true;
            BT.dialog('No more moves',
              '<p>The tiles that are left are stacked on top of each other, so even a shuffle can\'t free them.</p><p>Undo a few moves and try pairing the tiles a different way.</p>',
              [{ label: 'Not now', value: false }, { label: '↩️ Undo a move', value: true, primary: true }])
              .then(v => { if (v && !over) undo(); });
          }
          return true;
        }
        shuffleBtn.classList.add('primary');
        say('No more pairs can be matched. Tap Shuffle to mix up the tiles.');
        if (!stuckShown) {
          stuckShown = true;
          BT.dialog('No more moves',
            '<p>None of the free tiles match at the moment. That happens sometimes!</p><p>Shall I shuffle the tiles that are left? Or you can undo a few moves and try another way.</p>',
            [{ label: 'Not now', value: false }, { label: '🔀 Shuffle the tiles', value: true, primary: true }])
            .then(v => { if (v && !over) doShuffle(); });
        }
        return true;
      }

      function hint() {
        if (over) return;
        resume();
        clearHint();
        const pairs = findPairs(geo, faces, present);
        if (!pairs.length) { stuckShown = false; checkStuck(); return; }
        const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
        hints++;
        sel = -1;
        paint();
        tileEls[a].classList.add('mj-hint');
        tileEls[b].classList.add('mj-hint');
        say('These two can be matched.');
        hintTimer = setTimeout(() => { clearHint(); say(''); }, 3500);
        save();
      }

      function undo() {
        if (over || !hist.length) return;
        resume();
        clearHint();
        const [a, b, fa, fb] = hist.pop();
        faces[a] = fa; faces[b] = fb;
        present[a] = 1; present[b] = 1;
        undos++;
        sel = -1;
        stuckShown = false;
        shuffleBtn.classList.remove('primary');
        undoBtn.classList.remove('primary');
        say('Pair put back.');
        paint();
        save();
      }

      function doShuffle() {
        if (over) return;
        resume();
        clearHint();
        const positions = presentList();
        const copy = faces.slice();
        if (!reshuffle(geo, copy, positions, newRng())) {
          stuckShown = false;
          if (!checkStuck()) say('These tiles can\'t be arranged so they all clear. Try Undo instead.');
          return;
        }
        faces = copy;
        shuffles++;
        sel = -1;
        stuckShown = false;
        shuffleBtn.classList.remove('primary');
        stage.classList.remove('mj-mixing'); void stage.offsetWidth; stage.classList.add('mj-mixing');
        ctx.sound('tap');
        paint();
        save();
        say('Tiles shuffled. They can all be cleared from here.');
      }

      function win() {
        over = true;
        pause();
        const secs = Math.round(ms / 1000);
        say('All cleared! Lovely work.');
        ctx.sound('good');
        status();
        ctx.finish({
          score: secs, won: true, ms: Math.round(ms),
          display: 'Cleared ' + modeName + ' in ' + BT.fmtTime(ms),
          detail: { mode: modeId, seconds: secs, hints, shuffles, undos },
          delay: 1300,
        });
      }

      function giveUp() {
        if (over) return;
        BT.confirm('Give up this puzzle?', '<p>This ends the puzzle and counts it as not finished. You can still play a practice puzzle afterwards.</p>', 'Yes, give up').then(yes => {
          if (!yes || over) return;
          over = true;
          pause();
          const secs = Math.round(ms / 1000), n = left();
          ctx.finish({
            score: secs, won: false, ms: Math.round(ms),
            display: 'Stopped with ' + n + ' tiles left',
            detail: { mode: modeId, seconds: secs, hints, shuffles, undos, tilesLeft: n },
            delay: 300,
          });
        });
      }

      /* --- events --- */
      stage.addEventListener('click', (e) => {
        const el = e.target.closest('.mj-tile');
        if (el) tap(Number(el.dataset.i));
      });
      const onResize = () => fit();
      const onVis = () => { if (document.hidden) { pause(); save(); } else resume(); };
      const onHide = () => { pause(); save(); };
      window.addEventListener('resize', onResize);
      let lastW = 0;
      const ro = window.ResizeObserver ? new ResizeObserver(() => { if (felt.clientWidth !== lastW) { lastW = felt.clientWidth; fit(); } }) : null;
      if (ro) ro.observe(felt);
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('pagehide', onHide);
      let ticks = 0;
      const timer = setInterval(() => {
        if (over) return;
        status();
        if (runFrom != null && ++ticks % 10 === 0) save();
      }, 1000);
      ctx.onExit(() => {
        clearInterval(timer);
        clearTimeout(hintTimer);
        window.removeEventListener('resize', onResize);
        if (ro) ro.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('pagehide', onHide);
        pause();
        save();
      });

      fit();
      paint();
      requestAnimationFrame(fit);
      say(hist.length ? 'Welcome back. Carry on where you left off.' : 'Tap two matching free tiles to clear them.');
      resume();
      if (!checkStuck()) save();
    },
  });

  document.head.append(BT.h('style', null, `
    .mj-wrap { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    .mj-felt { background: radial-gradient(ellipse at 50% 40%, #3f8d79, #2a6a5b); border-radius: 18px; padding: 12px;
      box-shadow: inset 0 2px 10px rgba(0,0,0,0.25); overflow: hidden; }
    .mj-stage { position: relative; margin: 0 auto; touch-action: manipulation; }
    .mj-stage.mj-mixing .mj-tile:not(.mj-out) { animation: mj-mix 0.45s ease; }
    @keyframes mj-mix { 0% { opacity: 0.2; transform: scale(0.9); } 100% { opacity: 1; transform: none; } }
    .mj-tile { position: absolute; width: var(--w); height: var(--h); cursor: pointer; isolation: isolate;
      transition: opacity 0.3s, transform 0.3s; }
    .mj-tile::before, .mj-tile::after { content: ''; position: absolute; inset: 0; border-radius: var(--r); pointer-events: none; }
    .mj-tile::before { transform: translate(var(--d), var(--d)); background: linear-gradient(135deg, #d5aa5c, #9c6f2a); z-index: -2;
      box-shadow: calc(var(--d) * 0.6) calc(var(--d) * 0.8) calc(var(--d) * 1.6) rgba(20,30,20,0.5); }
    .mj-tile::after { transform: translate(calc(var(--d) * 0.5), calc(var(--d) * 0.5)); background: #eadcb8; z-index: -1; }
    .mj-face { position: absolute; inset: 0; border-radius: var(--r); background: linear-gradient(160deg, #fffdf7 0%, #f6eedb 100%);
      border: 1px solid #b9a273; overflow: hidden; }
    .mj-face svg { display: block; width: 100%; height: 100%; }
    .mj-dim .mj-blocked .mj-face::after { content: ''; position: absolute; inset: 0; background: rgba(70, 52, 22, 0.24); }
    .mj-tile.mj-sel { transform: translate(-2px, -3px); }
    .mj-tile.mj-sel .mj-face { background: linear-gradient(160deg, #fff6c2, #ffe17d); border: 2px solid #d48a00; box-shadow: 0 0 0 3px #ffc93c; }
    .mj-tile.mj-hint .mj-face { background: linear-gradient(160deg, #e9fbe9, #c8efcf); border: 2px solid #2f9e57; animation: mj-pulse 0.8s ease-in-out infinite alternate; }
    @keyframes mj-pulse { from { box-shadow: 0 0 0 2px rgba(47,158,87,0.5); } to { box-shadow: 0 0 0 5px rgba(47,158,87,0.9); } }
    .mj-tile.mj-going { opacity: 0; transform: translateY(-12%) scale(0.85); pointer-events: none; }
    .mj-tile.mj-out { display: none; }
    .mj-tile.mj-shake { animation: mj-shake 0.38s; }
    @keyframes mj-shake { 20%, 60% { transform: translateX(-4px); } 40%, 80% { transform: translateX(4px); } }
    .mj-msg { min-height: 1.6em; margin: 10px 0 0; }
    .mj-buttons { margin: 8px 0 4px; }
    .mj-buttons .btn { min-width: 7.5em; }
    @media (max-width: 900px) {
      .mj-felt { padding: 7px; margin: 0 -10px; }
    }
    @media (max-width: 600px) {
      .mj-felt { padding: 5px; border-radius: 12px; margin: 0 -12px; }
      .mj-buttons .btn { min-width: 0; flex: 1 1 40%; }
    }
  `));
})();
