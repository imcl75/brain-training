/* Crosswords: a daily freeform (criss-cross) crossword, quick or cryptic.
 * The grid is built in the browser from a clue bank (js/data/crossword-*.js),
 * seeded by the date so everyone gets the same puzzle all day.
 * The generator (BT.crossword.generate) has no DOM code so it can be tested in node. */
(function () {
  const MAX = 13;  // largest grid, in cells, either way

  /* ---------- generator ---------- */

  function generate(pool, rng, opts) {
    const size = opts.size || MAX, min = opts.min, max = opts.max;
    let best = null;
    for (let t = 0; t < (opts.attempts || 40); t++) {
      const layout = attempt(pool, rng, size, max);
      if (!layout) continue;
      const s = layoutScore(layout, min, max);
      if (!best || s > best.score) best = { layout, score: s };
      if (best.layout.words.length >= max && t >= 12) break;
    }
    if (!best || best.layout.words.length < min) return null;
    return finalise(best.layout);
  }

  function layoutScore(L, min, max) {
    const n = L.words.length, w = L.maxC - L.minC + 1, h = L.maxR - L.minR + 1;
    let cross = 0;
    L.cells.forEach(cell => { if (cell.a && cell.d) cross++; });
    return Math.min(n, max) * 12 + cross * 5 - (w * h) / 6 - Math.abs(w - h) * 2 + (n >= min ? 40 : 0);
  }

  function attempt(pool, rng, size, max) {
    const cells = new Map();
    const key = (r, c) => r * 1000 + c;
    const get = (r, c) => cells.get(key(r, c));
    const L = { cells, words: [], minR: 0, maxR: 0, minC: 0, maxC: 0 };
    const order = rng.shuffle(pool);
    const firstIdx = order.findIndex(x => x.a.length >= 7 && x.a.length <= 10);
    const first = order.splice(firstIdx < 0 ? 0 : firstIdx, 1)[0];
    place(first, 0, 0, 'A');
    L.minC = 0; L.maxC = first.a.length - 1;
    const used = new Set([first.a]);

    function place(entry, r, c, dir) {
      const dr = dir === 'D' ? 1 : 0, dc = dir === 'A' ? 1 : 0;
      for (let i = 0; i < entry.a.length; i++) {
        const rr = r + dr * i, cc = c + dc * i, k = key(rr, cc);
        const cell = cells.get(k) || { ch: entry.a[i], a: false, d: false, r: rr, c: cc };
        if (dir === 'A') cell.a = true; else cell.d = true;
        cells.set(k, cell);
      }
      L.words.push({ entry, r, c, dir });
      if (L.words.length > 1) {
        L.minR = Math.min(L.minR, r); L.minC = Math.min(L.minC, c);
        L.maxR = Math.max(L.maxR, r + dr * (entry.a.length - 1));
        L.maxC = Math.max(L.maxC, c + dc * (entry.a.length - 1));
      }
    }

    // How many crossings a placement makes, or -1 if it is not allowed.
    function check(word, r, c, dir) {
      const dr = dir === 'D' ? 1 : 0, dc = dir === 'A' ? 1 : 0, n = word.length;
      if (get(r - dr, c - dc) || get(r + dr * n, c + dc * n)) return -1;   // no touching ends
      const nMinR = Math.min(L.minR, r), nMaxR = Math.max(L.maxR, r + dr * (n - 1));
      const nMinC = Math.min(L.minC, c), nMaxC = Math.max(L.maxC, c + dc * (n - 1));
      if (nMaxR - nMinR + 1 > size || nMaxC - nMinC + 1 > size) return -1;
      let cross = 0;
      for (let i = 0; i < n; i++) {
        const rr = r + dr * i, cc = c + dc * i, cell = get(rr, cc);
        if (cell) {
          if (cell.ch !== word[i]) return -1;
          if (dir === 'A' ? cell.a : cell.d) return -1;
          cross++;
        } else if (get(rr + dc, cc + dr) || get(rr - dc, cc - dr)) return -1;   // no side-by-side letters
      }
      return cross > 0 && cross < n ? cross : -1;
    }

    while (L.words.length < max) {
      let pick = null;
      const curW = L.maxC - L.minC + 1, curH = L.maxR - L.minR + 1;
      for (const entry of order) {
        if (used.has(entry.a)) continue;
        const w = entry.a;
        // Never put NOTE and NOTES (or similar) in the same grid.
        if (L.words.some(x => x.entry.a.includes(w) || w.includes(x.entry.a))) continue;
        for (const cell of cells.values()) {
          if (cell.a && cell.d) continue;
          const dir = cell.a ? 'D' : 'A';
          for (let i = 0; i < w.length; i++) {
            if (w[i] !== cell.ch) continue;
            const r = dir === 'D' ? cell.r - i : cell.r, c = dir === 'A' ? cell.c - i : cell.c;
            const cross = check(w, r, c, dir);
            if (cross < 0) continue;
            const n = w.length;
            const nW = Math.max(L.maxC, c + (dir === 'A' ? n - 1 : 0)) - Math.min(L.minC, c) + 1;
            const nH = Math.max(L.maxR, r + (dir === 'D' ? n - 1 : 0)) - Math.min(L.minR, r) + 1;
            const s = cross * 14 - (Math.max(nW, nH) - Math.max(curW, curH)) * 5 - (nW * nH - curW * curH) * 0.25
              - Math.abs(nW - nH) * 1.5 + (n >= 4 && n <= 8 ? 3 : 0) + rng() * 8;
            if (!pick || s > pick.s) pick = { entry, r, c, dir, s };
          }
        }
      }
      if (!pick) break;
      place(pick.entry, pick.r, pick.c, pick.dir);
      used.add(pick.entry.a);
    }
    return L;
  }

  // Shift to 0-based coordinates and number the clues in the usual order.
  function finalise(L) {
    const w = L.maxC - L.minC + 1, h = L.maxR - L.minR + 1;
    const grid = Array.from({ length: h }, () => Array(w).fill(null));
    L.cells.forEach(cell => { grid[cell.r - L.minR][cell.c - L.minC] = cell.ch; });
    const words = L.words.map(x => ({ a: x.entry.a, c: x.entry.c, e: x.entry.e || null, row: x.r - L.minR, col: x.c - L.minC, dir: x.dir }));
    const starts = {};
    words.forEach(x => { starts[x.row * 100 + x.col] = true; });
    let num = 0;
    const nums = {};
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (starts[r * 100 + c]) nums[r * 100 + c] = ++num;
    words.forEach(x => { x.num = nums[x.row * 100 + x.col]; });
    words.sort((p, q) => (p.dir === q.dir ? p.num - q.num : p.dir === 'A' ? -1 : 1));
    return { w, h, grid, words };
  }

  /* Today's share of the bank: a fixed shuffle cut into blocks, one block a day,
   * so an answer comes round again only after the whole cycle of blocks. */
  function poolFor(bank, mode, dayNum, practiceRng, block, extra) {
    if (practiceRng) return practiceRng.shuffle(bank).slice(0, block * (2 + (extra || 0)));
    const order = BT.rng('crossword-order-' + mode).shuffle(bank);
    const blocks = Math.max(1, Math.floor(order.length / block));
    const k = ((dayNum % blocks) + blocks) % blocks;
    const pool = order.slice(k * block, (k + 1) * block);
    // Only if a block will not make a grid: borrow the next block(s).
    for (let i = 1; i <= (extra || 0); i++) pool.push(...order.slice(((k + i) % blocks) * block, ((k + i) % blocks + 1) * block));
    return pool;
  }

  BT.crossword = { generate, poolFor, MAX };
})();

/* ---------- the game ---------- */
(function () {
  if (typeof document === 'undefined') return;   // node tests load the generator only
  const CW = BT.crossword;
  const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm-'];
  const MODES = {
    quick: { name: 'Quick crossword', block: 24, min: 12, max: 16 },
    cryptic: { name: 'Cryptic crossword', block: 13, min: 10, max: 14 },
  };

  function bankFor(mode) {
    if (mode === 'cryptic') return BT.data.cwCryptic.map(x => ({ a: x.a, c: x.c, e: x.e }));
    return BT.data.cwQuick.split('\n').filter(line => line.includes('|')).map(line => {
      const [a, c] = line.split('|');
      return { a: a.trim(), c: c.trim() + ' (' + a.trim().length + ')' };
    });
  }

  function makePuzzle(ctx, modeId) {
    const M = MODES[modeId], bank = bankFor(modeId), day = BT.dayNumber(ctx.date);
    for (let extra = 0; extra < 4; extra++) {
      const pool = CW.poolFor(bank, modeId, day, ctx.practice ? ctx.rng : null, M.block, extra);
      const p = CW.generate(pool, ctx.rng, { min: M.min, max: M.max, attempts: 40 });
      if (p) return p;
    }
    return CW.generate(bank, ctx.rng, { min: 6, max: M.max, attempts: 60 });
  }

  const HOWTO = `<p>Fill the white squares by solving the clues. Today's crossword is the same all day; you can leave and come back to it.</p>
    <ul><li><b>Tap a square</b> to choose it. Its word is shaded and its clue appears above the grid.</li>
    <li><b>Tap the same square again</b> to switch between Across and Down.</li>
    <li>Type with the letters below (or a keyboard). <b>Delete</b> goes back. ◀ and ▶ move to the previous or next clue, or tap any clue in the lists.</li>
    <li><b>Check</b> marks wrong letters in red. <b>Reveal</b> shows a letter or a whole word. <b>Give up</b> shows every answer.</li></ul>
    <p>The clock counts up and stops while the app is closed. Your time is your score: lower is better.</p>
    <h3>Cryptic clues: a beginner's guide</h3>
    <p>Every cryptic clue has two parts: a plain <b>definition</b> at the start or the end, and some <b>wordplay</b> that builds the same answer. The number in brackets is the length.</p>
    <ul><li><b>Anagram</b>: letters jumbled, flagged by words such as <i>broken, wildly, cooked, sort</i>. <i>Study, upset, is covered in dust (5)</i> = DUSTY.</li>
    <li><b>Hidden word</b>: the answer sits inside the clue, flagged by <i>in, some, found in, held by</i>. <i>Insect found in a plant (3)</i> = ANT.</li>
    <li><b>Charade</b>: small pieces joined in order. <i>Dad with rent is a mother or father (6)</i> = PA + RENT.</li>
    <li><b>Container</b>: one piece put inside another, flagged by <i>holding, takes in, inside</i>. <i>Path: small nail holding river (5)</i> = T(R)ACK.</li>
    <li><b>Reversal</b>: a word written backwards, flagged by <i>back, returned, turned round</i>. <i>Wicked to live back (4)</i> = EVIL.</li>
    <li><b>Sounds like</b>: flagged by <i>we hear, it's said, by the sound of it</i>. <i>Boy\'s star, by the sound of it (3)</i> = SON (sounds like sun).</li>
    <li><b>Deletion</b>: a letter taken off, flagged by <i>headless, beheaded, unfinished, without end</i>. <i>Shopping centre, headless, is everything (3)</i> = ALL (mALL).</li>
    <li><b>Double definition</b>: two meanings side by side. <i>Cricket club and flying mammal (3)</i> = BAT.</li></ul>
    <p>Handy short forms: R = right or river, S = son, H = hospital, L = learner or lake, T = time, E = English, U = university, I = one, RE = about, ET = alien, OR = gold.</p>
    <p>After you solve or reveal a cryptic answer, tap <b>How it works</b> to see the clue explained.</p>`;

  BT.registerGame({
    id: 'crossword',
    name: 'Crosswords',
    category: 'crosswords',
    icon: '✏️',
    blurb: 'A new quick and cryptic crossword every day',
    daily: true,
    better: 'lower',
    modes: [{ id: 'quick', name: 'Quick crossword', blurb: 'General knowledge' }, { id: 'cryptic', name: 'Cryptic crossword', blurb: 'Wordplay clues' }],
    modesPrompt: 'Which crossword would you like?',
    scripts: ['js/data/crossword-quick.js', 'js/data/crossword-cryptic.js'],
    howTo: HOWTO,
    start,
  });

  function start(ctx) {
    const modeId = ctx.mode === 'cryptic' ? 'cryptic' : 'quick';
    const M = MODES[modeId], cryptic = modeId === 'cryptic';
    const P = makePuzzle(ctx, modeId);
    if (!P) { ctx.el.append(BT.h('p', { class: 'lead' }, 'Sorry, today\'s crossword could not be made. Please try a practice puzzle.')); return; }
    const sig = P.words.map(w => w.a).join(',');

    // Cells, keyed r*100+c
    const cells = {};
    const K = (r, c) => r * 100 + c;
    P.words.forEach((w, wi) => {
      for (let i = 0; i < w.a.length; i++) {
        const r = w.row + (w.dir === 'D' ? i : 0), c = w.col + (w.dir === 'A' ? i : 0);
        const cell = cells[K(r, c)] || (cells[K(r, c)] = { r, c, ans: w.a[i], A: null, D: null, num: null });
        cell[w.dir] = wi;
      }
      cells[K(w.row, w.col)].num = w.num;
    });
    const cellOf = (w, i) => cells[K(w.row + (w.dir === 'D' ? i : 0), w.col + (w.dir === 'A' ? i : 0))];
    const wordCells = (wi) => Array.from({ length: P.words[wi].a.length }, (_, i) => cellOf(P.words[wi], i));

    // State (restored if this puzzle was half done)
    const saved = ctx.load();
    const st = saved && saved.sig === sig ? saved : { fill: {}, wrong: [], revealed: [], checks: 0, elapsed: 0, cur: null };
    const fill = st.fill;                         // key -> letter
    const wrong = new Set(st.wrong), revealed = new Set(st.revealed);
    let checks = st.checks || 0, elapsed = st.elapsed || 0;
    let cur = st.cur && cells[K(st.cur.r, st.cur.c)] ? st.cur : { r: P.words[0].row, c: P.words[0].col, dir: P.words[0].dir };
    if (cells[K(cur.r, cur.c)][cur.dir] == null) cur.dir = cur.dir === 'A' ? 'D' : 'A';
    let over = false;

    function save() {
      if (over) return;
      ctx.save({ sig, fill, wrong: [...wrong], revealed: [...revealed], checks, elapsed, cur });
    }

    // ----- DOM -----
    const h = BT.h;
    const clueNum = h('span', { class: 'cw-cbnum' });
    const clueText = h('span', { class: 'cw-cbtext' });
    const howBtn = h('button', { class: 'btn cw-how', onclick: (e) => { e.stopPropagation(); explain(curWord()); } }, 'How it works');
    const clueBar = h('div', { class: 'cw-cluebar' },
      h('button', { class: 'btn cw-nav', 'aria-label': 'Previous clue', onclick: () => moveClue(-1) }, '◀'),
      h('div', { class: 'cw-cbmain', onclick: toggleDir }, clueNum, clueText, cryptic ? howBtn : null),
      h('button', { class: 'btn cw-nav', 'aria-label': 'Next clue', onclick: () => moveClue(1) }, '▶'));

    const gridEl = h('div', { class: 'cw-grid', style: 'grid-template-columns: repeat(' + P.w + ', var(--cw-s)); grid-template-rows: repeat(' + P.h + ', var(--cw-s));' });
    for (let r = 0; r < P.h; r++) for (let c = 0; c < P.w; c++) {
      const cell = cells[K(r, c)];
      if (!cell) { gridEl.append(h('div', { class: 'cw-gap' })); continue; }
      cell.let = h('span', { class: 'cw-let' });
      cell.el = h('div', { class: 'cw-cell', onclick: () => tapCell(cell) },
        cell.num ? h('span', { class: 'cw-num' }, String(cell.num)) : null, cell.let);
      gridEl.append(cell.el);
    }

    const keyboard = h('div', { class: 'keyboard cw-keys' }, KEYS.map(row => h('div', { class: 'row' }, [...row].map(k =>
      h('button', { class: 'key' + (k === '-' ? ' wide' : ''), onclick: () => (k === '-' ? backspace() : type(k.toUpperCase())) }, k === '-' ? '⌫ Delete' : k)))));

    const buttons = h('div', { class: 'cw-buttons' },
      h('div', { class: 'cw-bgroup' }, h('span', { class: 'cw-blabel' }, 'Check'),
        h('button', { class: 'btn', onclick: () => check(false) }, 'Word'),
        h('button', { class: 'btn', onclick: () => check(true) }, 'Grid')),
      h('div', { class: 'cw-bgroup' }, h('span', { class: 'cw-blabel' }, 'Reveal'),
        h('button', { class: 'btn', onclick: () => reveal(false) }, 'Letter'),
        h('button', { class: 'btn', onclick: () => reveal(true) }, 'Word')),
      h('button', { class: 'btn cw-giveup', onclick: giveUp }, 'Give up'));

    const listEls = [];
    const lists = h('div', { class: 'cw-lists' }, ['A', 'D'].map(dir => h('section', { class: 'cw-list' },
      h('h3', null, dir === 'A' ? 'Across' : 'Down'),
      h('ol', null, P.words.map((w, wi) => {
        if (w.dir !== dir) return null;
        const li = h('li', { class: 'cw-clue', onclick: () => selectWord(wi) }, h('b', null, String(w.num)), h('span', null, w.c));
        listEls[wi] = li;
        return li;
      })))));

    const side = h('div', { class: 'cw-side' }, clueBar, keyboard, buttons, lists);
    const wrap = h('div', { class: 'cw-wrap' }, h('div', { class: 'cw-main' }, gridEl), side);
    ctx.el.append(wrap);

    // ----- selection and movement -----
    function curWord() { return cells[K(cur.r, cur.c)][cur.dir]; }
    function select(cell, dir) {
      if (cell[dir] == null) dir = dir === 'A' ? 'D' : 'A';
      cur = { r: cell.r, c: cell.c, dir };
      paint();
    }
    function tapCell(cell) {
      ctx.sound('tap');
      if (cell.r === cur.r && cell.c === cur.c && cell.A != null && cell.D != null) select(cell, cur.dir === 'A' ? 'D' : 'A');
      else select(cell, cur.dir);
    }
    function toggleDir() {
      const cell = cells[K(cur.r, cur.c)];
      if (cell.A != null && cell.D != null) select(cell, cur.dir === 'A' ? 'D' : 'A');
    }
    function selectWord(wi) {
      const cs = wordCells(wi);
      const target = cs.find(x => !fill[K(x.r, x.c)]) || cs[0];
      cur = { r: target.r, c: target.c, dir: P.words[wi].dir };
      paint();
    }
    function moveClue(step) {
      const n = P.words.length;
      selectWord((curWord() + step + n) % n);
    }
    function stepInWord(step) {
      const w = P.words[curWord()];
      const i = cur.dir === 'A' ? cur.c - w.col : cur.r - w.row;
      const j = i + step;
      if (j < 0 || j >= w.a.length) return false;
      const cell = cellOf(w, j);
      cur = { r: cell.r, c: cell.c, dir: cur.dir };
      return true;
    }
    function arrow(dr, dc) {
      const dir = dr ? 'D' : 'A';
      const here = cells[K(cur.r, cur.c)];
      if (cur.dir !== dir && here[dir] != null) { select(here, dir); return; }
      let r = cur.r + dr, c = cur.c + dc;
      while (r >= 0 && c >= 0 && r < P.h && c < P.w) {
        if (cells[K(r, c)]) { select(cells[K(r, c)], dir); return; }
        r += dr; c += dc;
      }
    }

    // ----- typing -----
    function type(ch) {
      if (over) return;
      const k = K(cur.r, cur.c);
      if (!revealed.has(k)) { fill[k] = ch; wrong.delete(k); }
      stepInWord(1);
      changed();
    }
    function backspace() {
      if (over) return;
      const k = K(cur.r, cur.c);
      if (fill[k] && !revealed.has(k)) { delete fill[k]; wrong.delete(k); }
      else if (stepInWord(-1)) {
        const k2 = K(cur.r, cur.c);
        if (!revealed.has(k2)) { delete fill[k2]; wrong.delete(k2); }
      }
      changed();
    }

    // ----- check, reveal, give up -----
    function check(all) {
      if (over) return;
      checks++;
      const list = all ? Object.values(cells) : wordCells(curWord());
      let bad = 0, empty = 0;
      list.forEach(cell => {
        const k = K(cell.r, cell.c);
        if (!fill[k]) empty++;
        else if (fill[k] !== cell.ans) { wrong.add(k); bad++; }
      });
      if (bad) { ctx.sound('bad'); ctx.toast(bad === 1 ? '1 letter is wrong (shown in red)' : bad + ' letters are wrong (shown in red)', 2400); }
      else ctx.toast(empty ? 'All correct so far' : (all ? 'All correct!' : 'That word is right'), 2000);
      changed();
    }
    async function reveal(word) {
      if (over) return;
      const wi = curWord(), w = P.words[wi];
      const ok = await BT.confirm(word ? 'Reveal this word?' : 'Reveal this letter?',
        word ? '<p>Show the answer to ' + w.num + (w.dir === 'A' ? ' Across' : ' Down') + '.</p>' : '<p>Show the letter in the highlighted square.</p>', 'Reveal');
      if (!ok || over) return;
      (word ? wordCells(wi) : [cells[K(cur.r, cur.c)]]).forEach(cell => {
        const k = K(cell.r, cell.c);
        if (fill[k] !== cell.ans) { fill[k] = cell.ans; revealed.add(k); }
        wrong.delete(k);
      });
      if (!word) stepInWord(1);
      changed();
    }
    async function giveUp() {
      if (over) return;
      const ok = await BT.confirm('Give up?', '<p>This shows all the answers and ends today\'s crossword.</p>', 'Show answers');
      if (!ok || over) return;
      tick();
      Object.values(cells).forEach(cell => { fill[K(cell.r, cell.c)] = cell.ans; });
      wrong.clear();
      over = true;
      clearInterval(timer);
      paint();
      const secs = Math.round(elapsed / 1000);
      ctx.finish({ score: secs, won: false, display: M.name + ': answers shown after ' + BT.fmtTime(elapsed), ms: elapsed,
        detail: { mode: modeId, seconds: secs, revealed: -1, checks, gaveUp: true }, delay: 2500, extra: extraInfo() });
    }

    function explain(wi) {
      const w = P.words[wi];
      if (!w.e) return;
      BT.dialog(w.num + (w.dir === 'A' ? ' Across' : ' Down') + ': ' + w.a,
        '<p class="cw-exclue">' + BT.escape(w.c) + '</p><p>' + BT.escape(w.e) + '</p>', [{ label: 'Close', value: true, primary: true }]);
    }
    function wordDone(wi) { return wordCells(wi).every(cell => fill[K(cell.r, cell.c)] === cell.ans); }
    function wordFull(wi) { return wordCells(wi).every(cell => fill[K(cell.r, cell.c)]); }

    function extraInfo() {
      if (!cryptic) return null;
      return h('details', { class: 'cw-explain' }, h('summary', null, 'How every clue works'),
        h('ul', null, P.words.map(w => h('li', null, h('b', null, w.num + (w.dir === 'A' ? 'A ' : 'D ') + w.a), ': ', w.e))));
    }

    // ----- drawing -----
    function paint() {
      const wi = curWord(), w = P.words[wi];
      const inWord = new Set(wordCells(wi).map(cell => K(cell.r, cell.c)));
      Object.values(cells).forEach(cell => {
        const k = K(cell.r, cell.c);
        cell.let.textContent = fill[k] || '';
        cell.el.className = 'cw-cell' + (inWord.has(k) ? ' cw-word' : '') + (cell.r === cur.r && cell.c === cur.c ? ' cw-sel' : '')
          + (wrong.has(k) ? ' cw-wrong' : '') + (revealed.has(k) ? ' cw-rev' : '');
      });
      clueNum.textContent = w.num + (w.dir === 'A' ? ' Across' : ' Down');
      clueText.textContent = w.c;
      if (cryptic) howBtn.hidden = !(w.e && wordDone(wi));
      listEls.forEach((li, i) => {
        if (!li) return;
        li.className = 'cw-clue' + (i === wi ? ' cw-on' : '') + (wordFull(i) ? ' cw-full' : '');
      });
      if (wrap.classList.contains('cw-wide')) {
        const li = listEls[wi], box = lists;
        if (li.offsetTop < box.scrollTop || li.offsetTop + li.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = li.offsetTop - box.clientHeight / 3;
      }
    }

    function changed() {
      paint();
      save();
      if (!over && Object.values(cells).every(cell => fill[K(cell.r, cell.c)] === cell.ans)) win();
    }

    function win() {
      tick();
      over = true;
      clearInterval(timer);
      ctx.sound('good');
      const secs = Math.round(elapsed / 1000), n = revealed.size;
      // Mostly revealed is not a real solve, so it should not set a personal best.
      const won = n * 4 <= Object.keys(cells).length;
      ctx.finish({ score: secs, won, ms: elapsed,
        display: M.name + ' done in ' + BT.fmtTime(elapsed) + (n ? ', ' + n + (n === 1 ? ' letter' : ' letters') + ' revealed' : ''),
        detail: { mode: modeId, seconds: secs, revealed: n, checks }, delay: 1600, extra: extraInfo() });
    }

    // ----- timer (paused while the app is hidden) -----
    let last = Date.now();
    function tick() {
      const now = Date.now();
      if (!document.hidden && !over) elapsed += Math.min(now - last, 5000);
      last = now;
      ctx.setStatus('⏱ ' + BT.fmtTime(elapsed));
    }
    const timer = setInterval(() => { tick(); if (Math.round(elapsed / 1000) % 10 === 0) save(); }, 1000);
    const onVis = () => { if (document.hidden) { tick(); save(); } else last = Date.now(); };
    document.addEventListener('visibilitychange', onVis);

    // ----- sizing -----
    function layout() {
      const vw = window.innerWidth, vh = window.innerHeight;
      const wide = vw >= 900 && vw > vh;
      wrap.classList.toggle('cw-wide', wide);
      const head = document.querySelector('.play-head');
      const headH = head ? head.offsetHeight : 70;
      let s;
      if (wide) {
        const colW = wrap.clientWidth * 0.55 - 12;
        s = Math.min(colW / P.w, (vh - headH - 36) / P.h);
        lists.style.maxHeight = Math.max(180, vh - headH - clueBar.offsetHeight - keyboard.offsetHeight - buttons.offsetHeight - 64) + 'px';
      } else {
        const availH = vh - headH - clueBar.offsetHeight - keyboard.offsetHeight - 56;
        s = Math.min((wrap.clientWidth - 4) / P.w, Math.max(availH, 300) / P.h);
        lists.style.maxHeight = '';
      }
      s = Math.max(22, Math.min(64, Math.floor(s)));
      wrap.style.setProperty('--cw-s', s + 'px');
      paint();
    }
    window.addEventListener('resize', layout);

    // ----- physical keyboard -----
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || over || document.querySelector('.dialog-wrap')) return;
      if (/^[a-z]$/i.test(e.key)) type(e.key.toUpperCase());
      else if (e.key === 'Backspace' || e.key === 'Delete') backspace();
      else if (e.key === 'Tab') moveClue(e.shiftKey ? -1 : 1);
      else if (e.key === 'ArrowLeft') arrow(0, -1);
      else if (e.key === 'ArrowRight') arrow(0, 1);
      else if (e.key === 'ArrowUp') arrow(-1, 0);
      else if (e.key === 'ArrowDown') arrow(1, 0);
      else if (e.key === 'Enter' || e.key === ' ') toggleDir();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);

    ctx.onExit(() => {
      tick(); save();
      clearInterval(timer);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', layout);
    });

    tick();
    layout();
    requestAnimationFrame(layout);
  }

  document.head.append(BT.h('style', null, `
    .cw-wrap { --cw-s: 40px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
    .cw-main { display: flex; justify-content: center; max-width: 100%; }
    .cw-side { width: 100%; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .cw-wrap .cw-side { order: 0; }
    .cw-wrap:not(.cw-wide) .cw-main { order: 1; }
    .cw-wrap:not(.cw-wide) .cw-side { display: contents; }
    .cw-wrap:not(.cw-wide) .cw-cluebar { order: 0; width: 100%; }
    .cw-wrap:not(.cw-wide) .cw-keys { order: 2; width: 100%; }
    .cw-wrap:not(.cw-wide) .cw-buttons { order: 3; }
    .cw-wrap:not(.cw-wide) .cw-lists { order: 4; width: 100%; }
    .cw-wrap.cw-wide { flex-direction: row; align-items: flex-start; }
    .cw-wrap.cw-wide .cw-main { flex: 0 0 55%; }
    .cw-wrap.cw-wide .cw-side { flex: 1 1 0; }
    .cw-wrap .cw-keys { width: 100%; margin: 0 auto; }
    .cw-keys .key.wide { white-space: nowrap; }

    .cw-grid { display: grid; gap: 0; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
    .cw-gap { background: transparent; }
    .cw-cell { position: relative; background: #fff; border: 1.5px solid #4a4f5c; margin: 0 -1.5px -1.5px 0; cursor: pointer;
      display: grid; place-items: center; touch-action: manipulation; }
    .cw-num { position: absolute; top: 1px; left: 2px; font-size: max(9px, calc(var(--cw-s) * 0.27)); line-height: 1; font-weight: 600; color: #333; }
    .cw-let { font-size: calc(var(--cw-s) * 0.6); font-weight: 700; line-height: 1; padding-top: calc(var(--cw-s) * 0.1); color: var(--ink); }
    .cw-cell.cw-word { background: #cde6f2; }
    .cw-cell.cw-sel { background: #ffd862; }
    .cw-cell.cw-rev .cw-let { color: #1f6f8b; }
    .cw-cell.cw-rev::after { content: ''; position: absolute; right: 0; top: 0; border: calc(var(--cw-s) * 0.14) solid transparent;
      border-top-color: #1f6f8b; border-right-color: #1f6f8b; }
    .cw-cell.cw-wrong .cw-let { color: var(--bad); }
    .cw-cell.cw-wrong { background-image: linear-gradient(to top right, transparent 46%, rgba(179, 65, 47, 0.55) 48%, rgba(179, 65, 47, 0.55) 52%, transparent 54%); }

    .cw-cluebar { display: flex; align-items: stretch; gap: 8px; background: var(--panel); border: 2px solid var(--line); border-left: 8px solid var(--cat);
      border-radius: 14px; padding: 6px; min-height: 76px; }
    .cw-nav { width: 52px; padding: 0; flex: none; font-size: 1.2rem; }
    .cw-cbmain { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding: 4px 6px; cursor: pointer; }
    .cw-cbnum { font-weight: 800; color: var(--cat); white-space: nowrap; }
    .cw-cbtext { font-size: 1.15rem; font-weight: 600; line-height: 1.3; }
    .cw-how { min-height: 40px; padding: 0.2em 0.8em; font-size: 0.9rem; border-color: var(--cat); color: var(--cat); }
    .cw-how[hidden] { display: none; }

    .cw-buttons { display: flex; flex-wrap: wrap; gap: 8px 14px; justify-content: center; align-items: center; }
    .cw-bgroup { display: flex; align-items: center; gap: 6px; }
    .cw-blabel { font-weight: 700; color: var(--muted); margin-right: 2px; }
    .cw-buttons .btn { padding: 0.4em 0.9em; }
    .cw-giveup { color: var(--muted); }

    .cw-lists { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; overflow: auto; -webkit-overflow-scrolling: touch; position: relative; }
    .cw-wide .cw-lists { grid-template-columns: 1fr; }
    .cw-list h3 { margin: 6px 0 4px; font-size: 1.1rem; }
    .cw-list ol { list-style: none; margin: 0; padding: 0; }
    .cw-clue { display: flex; gap: 8px; padding: 8px 10px; border-radius: 10px; cursor: pointer; line-height: 1.35; }
    .cw-clue b { flex: none; min-width: 1.5em; }
    .cw-clue.cw-full { color: #9097a3; }
    .cw-clue.cw-on { background: #cde6f2; color: var(--ink); }
    .cw-exclue { font-style: italic; }
    .cw-explain { text-align: left; max-width: 640px; margin: 18px auto 0; background: var(--panel); border: 2px solid var(--line); border-radius: 14px; padding: 12px 16px; }
    .cw-explain summary { font-weight: 700; cursor: pointer; min-height: 40px; display: flex; align-items: center; }
    .cw-explain li { margin-bottom: 6px; }
    @media (max-width: 600px) {
      .cw-lists { grid-template-columns: 1fr; }
      .cw-cbtext { font-size: 1.05rem; }
      .cw-nav { width: 44px; }
    }
  `));
})();
