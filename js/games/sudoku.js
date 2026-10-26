/* Sudoku: a new seeded puzzle every day for each difficulty.
 * The generator fills a grid by seeded backtracking, then removes clues in
 * symmetric pairs while the solution stays unique. Easy and Medium must also
 * be solvable with "singles" only; Expert must need more than singles. */
(function () {
  /* ---------- generator ---------- */

  const R = [], C = [], B = [], PEERS = [], UNITS = [];
  for (let i = 0; i < 81; i++) { R[i] = Math.floor(i / 9); C[i] = i % 9; B[i] = Math.floor(R[i] / 3) * 3 + Math.floor(C[i] / 3); }
  for (let u = 0; u < 9; u++) {
    UNITS.push([...Array(81).keys()].filter(i => R[i] === u));
    UNITS.push([...Array(81).keys()].filter(i => C[i] === u));
    UNITS.push([...Array(81).keys()].filter(i => B[i] === u));
  }
  for (let i = 0; i < 81; i++) {
    PEERS[i] = [...Array(81).keys()].filter(k => k !== i && (R[k] === R[i] || C[k] === C[i] || B[k] === B[i]));
  }
  function pop(m) { let n = 0; while (m) { m &= m - 1; n++; } return n; }

  /* Counts solutions up to `limit`; with rng it tries digits in random order (used to fill a grid). */
  function solve(g, limit, rng) {
    const rows = new Int32Array(9), cols = new Int32Array(9), boxes = new Int32Array(9);
    const empties = [];
    for (let i = 0; i < 81; i++) {
      const v = g[i];
      if (v) {
        const bit = 1 << v;
        if ((rows[R[i]] | cols[C[i]] | boxes[B[i]]) & bit) return { count: 0 };
        rows[R[i]] |= bit; cols[C[i]] |= bit; boxes[B[i]] |= bit;
      } else empties.push(i);
    }
    let count = 0, first = null;
    const work = g.slice();
    function search(k) {
      if (k === empties.length) { count++; if (!first) first = work.slice(); return count >= limit; }
      let best = k, bestMask = 0, bestN = 10;
      for (let j = k; j < empties.length; j++) {
        const i = empties[j];
        const m = ~(rows[R[i]] | cols[C[i]] | boxes[B[i]]) & 0x3FE;
        const n = pop(m);
        if (n < bestN) { bestN = n; best = j; bestMask = m; if (n <= 1) break; }
      }
      if (bestN === 0) return false;
      const t = empties[k]; empties[k] = empties[best]; empties[best] = t;
      const i = empties[k];
      let digits = [];
      for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
      if (rng) digits = rng.shuffle(digits);
      for (const d of digits) {
        const bit = 1 << d;
        rows[R[i]] |= bit; cols[C[i]] |= bit; boxes[B[i]] |= bit; work[i] = d;
        const stop = search(k + 1);
        rows[R[i]] &= ~bit; cols[C[i]] &= ~bit; boxes[B[i]] &= ~bit; work[i] = 0;
        if (stop) return true;
      }
      return false;
    }
    search(0);
    return { count, solution: first };
  }

  /* Can it be solved by naked and hidden singles alone? */
  function singlesSolvable(p) {
    const g = p.slice();
    for (;;) {
      let progress = false;
      const cand = new Int32Array(81);
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        let m = 0x3FE;
        for (const k of PEERS[i]) if (g[k]) m &= ~(1 << g[k]);
        if (!m) return false;
        cand[i] = m;
        if (pop(m) === 1) { g[i] = 31 - Math.clz32(m); progress = true; }
      }
      if (!progress) {
        for (const unit of UNITS) {
          for (let d = 1; d <= 9 && !progress; d++) {
            let where = -1, n = 0;
            for (const i of unit) if (!g[i] && (cand[i] & (1 << d))) { where = i; n++; }
            if (n === 1) { g[where] = d; progress = true; }
          }
          if (progress) break;
        }
      }
      if (!progress) return g.every(v => v);
    }
  }

  function carve(rng, target) {
    const solution = solve(new Array(81).fill(0), 1, rng).solution;
    const g = solution.slice();
    let clues = 81;
    // Remove in pairs that mirror through the centre, so the puzzle looks balanced.
    for (const i of rng.shuffle([...Array(41).keys()])) {
      if (clues <= target) break;
      const pair = i === 40 ? [40] : [i, 80 - i];
      if (clues - pair.length < target - 1) continue;
      const keep = pair.map(k => g[k]);
      pair.forEach(k => { g[k] = 0; });
      if (solve(g, 2).count === 1) clues -= pair.length;
      else pair.forEach((k, n) => { g[k] = keep[n]; });
    }
    // Then single cells, to get as close to a low target as uniqueness allows.
    if (clues > target) {
      for (const i of rng.shuffle([...Array(81).keys()])) {
        if (clues <= target) break;
        if (!g[i]) continue;
        const v = g[i]; g[i] = 0;
        if (solve(g, 2).count === 1) clues--; else g[i] = v;
      }
    }
    return { puzzle: g, solution, clues };
  }

  const LEVELS = {
    easy:   { target: 40, singles: true },
    medium: { target: 32, singles: true },
    hard:   { target: 26 },
    expert: { target: 23, tricky: true },
  };

  function generate(rng, mode) {
    const lv = LEVELS[mode] || LEVELS.medium;
    let best = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const res = carve(rng, lv.target);
      const easyOk = singlesSolvable(res.puzzle);
      const ok = (!lv.singles || easyOk) && (!lv.tricky || !easyOk);
      if (ok && (lv.target > 30 || res.clues <= lv.target + 2)) return res;
      if (ok && (!best || res.clues < best.clues)) best = res;
    }
    return best || carve(rng, lv.target);
  }

  /* ---------- game ---------- */

  const MODES = [
    { id: 'easy', name: 'Easy', blurb: 'Plenty of numbers to start you off' },
    { id: 'medium', name: 'Medium', blurb: 'A steady think' },
    { id: 'hard', name: 'Hard', blurb: 'Fewer clues, more thinking' },
    { id: 'expert', name: 'Expert', blurb: 'Needs pencil marks and patience' },
  ];

  const def = {
    id: 'sudoku',
    name: 'Sudoku',
    category: 'numbers',
    icon: '🔢',
    blurb: 'Fill the grid so every row, column and box has 1 to 9',
    daily: true,
    better: 'lower',
    modes: MODES,
    modesPrompt: 'Choose a difficulty. There is a new puzzle at each level every day.',
    settings: [{ key: 'showMistakes', label: 'Show mistakes in red', default: true }],
    howTo: `<p>Fill every empty square with a number from 1 to 9.</p>
      <p>Each <b>row</b>, each <b>column</b> and each of the nine <b>3 × 3 boxes</b> must contain every number from 1 to 9 exactly once.</p>
      <ul>
        <li>Tap a square, then tap a number to put it in.</li>
        <li><b>Notes</b> switches to pencil marks: small numbers you can jot in a square while you think. Tap Notes again to go back to normal numbers.</li>
        <li><b>Erase</b> clears the chosen square. <b>Undo</b> takes back your last move.</li>
        <li>The numbers printed in black at the start can't be changed.</li>
        <li>A number button fades once all nine of that number are on the grid.</li>
      </ul>
      <p>The clock pauses if you leave, and your puzzle is kept so you can carry on later. Mistakes show in red; you can turn that off in Settings.</p>
      <p>With a keyboard: arrow keys move, 1 to 9 fill in, Backspace erases, N for notes, U to undo.</p>`,
    generate, solve, singlesSolvable,

    start(ctx) {
      const modeInfo = MODES.find(m => m.id === ctx.mode) || MODES[1];
      const saved = ctx.load();
      let puzzle, solution, values, notes, elapsed = 0, mistakes = 0, history = [];
      if (saved && saved.v === 1 && saved.puzzle && saved.puzzle.length === 81) {
        puzzle = [...saved.puzzle].map(Number);
        solution = [...saved.solution].map(Number);
        values = [...saved.values].map(Number);
        notes = saved.notes.slice();
        elapsed = saved.elapsed || 0;
        mistakes = saved.mistakes || 0;
        history = saved.history || [];
      } else {
        const res = generate(ctx.rng, modeInfo.id);
        puzzle = res.puzzle; solution = res.solution;
        values = puzzle.slice();
        notes = new Array(81).fill(0);
      }
      const given = puzzle.map(v => v !== 0);
      let selected = -1, notesMode = false, done = false;

      /* build */
      const cells = [];
      const grid = BT.h('div', { class: 'sd-grid', role: 'grid', 'aria-label': 'Sudoku grid' });
      for (let b = 0; b < 9; b++) {
        const box = BT.h('div', { class: 'sd-box' });
        for (let k = 0; k < 9; k++) {
          const i = (Math.floor(b / 3) * 3 + Math.floor(k / 3)) * 9 + (b % 3) * 3 + (k % 3);
          const cell = BT.h('button', { class: 'sd-cell', type: 'button', onclick: () => select(i) });
          cells[i] = cell;
          box.append(cell);
        }
        grid.append(box);
      }
      const numBtns = [];
      const nums = BT.h('div', { class: 'sd-nums' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => {
        const b = BT.h('button', { class: 'sd-num', type: 'button', 'aria-label': 'Number ' + n, onclick: () => enter(n) },
          BT.h('span', { class: 'sd-num-digit' }, String(n)), BT.h('span', { class: 'sd-num-left' }));
        numBtns[n] = b;
        return b;
      }));
      const undoBtn = BT.h('button', { class: 'btn sd-tool', type: 'button', onclick: undo }, '↶ Undo');
      const eraseBtn = BT.h('button', { class: 'btn sd-tool', type: 'button', onclick: erase }, '⌫ Erase');
      const notesBtn = BT.h('button', { class: 'btn sd-tool', type: 'button', 'aria-pressed': 'false', onclick: toggleNotes }, '✎ Notes: off');
      const tools = BT.h('div', { class: 'sd-tools' }, undoBtn, eraseBtn, notesBtn);
      const pad = BT.h('div', { class: 'sd-pad' }, nums, tools);
      const wrap = BT.h('div', { class: 'sd-wrap' }, BT.h('div', { class: 'sd-gridwrap' }, grid), pad);
      ctx.el.append(wrap);

      /* layout: as large a grid as fits, pad below or beside */
      function layout() {
        const W = ctx.el.clientWidth;
        const top = ctx.el.getBoundingClientRect().top + window.scrollY;
        const H = window.innerHeight - top - 16;
        const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 19;
        const below = Math.min(W, H - (window.innerWidth <= 480 ? 210 : 150) - 2.2 * fs);
        const sideW = Math.max(270, 12 * fs + 40);
        const beside = Math.min(W - sideW - 24, H);
        const side = beside > below + 10;
        let size = Math.floor(Math.max(side ? beside : below, Math.min(W, 300)));
        size = Math.min(size, W);
        wrap.classList.toggle('side', side);
        wrap.style.setProperty('--sd-size', size + 'px');
        wrap.style.setProperty('--sd-side', sideW + 'px');
      }
      layout();
      window.addEventListener('resize', layout);
      ctx.onExit(() => window.removeEventListener('resize', layout));

      /* drawing */
      function paint() {
        const sv = selected >= 0 ? values[selected] : 0;
        const showMistakes = ctx.setting('showMistakes');
        for (let i = 0; i < 81; i++) {
          const v = values[i];
          const cell = cells[i];
          let cls = 'sd-cell';
          if (given[i]) cls += ' given';
          else if (v) cls += ' entered';
          if (v && !given[i] && showMistakes && v !== solution[i]) cls += ' wrong';
          if (selected >= 0) {
            if (i === selected) cls += ' sel';
            else if (R[i] === R[selected] || C[i] === C[selected] || B[i] === B[selected]) cls += ' peer';
            if (sv && v === sv && i !== selected) cls += ' same';
          }
          cell.className = cls + (cell.classList.contains('pulse') ? ' pulse' : '');
          if (v) {
            if (cell.dataset.show !== 'v' + v) { cell.replaceChildren(BT.h('span', { class: 'sd-val' }, String(v))); cell.dataset.show = 'v' + v; }
          } else if (notes[i]) {
            const key = 'n' + notes[i] + (sv ? '-' + sv : '');
            if (cell.dataset.show !== key) {
              cell.replaceChildren(BT.h('span', { class: 'sd-notes' }, [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n =>
                BT.h('span', { class: n === sv && (notes[i] & (1 << n)) ? 'hi' : '' }, notes[i] & (1 << n) ? String(n) : ''))));
              cell.dataset.show = key;
            }
          } else if (cell.dataset.show !== '') { cell.replaceChildren(); cell.dataset.show = ''; }
          cell.setAttribute('aria-label', 'Row ' + (R[i] + 1) + ', column ' + (C[i] + 1) + ': ' + (v ? v + (given[i] ? ', given' : '') : 'empty'));
        }
        const counts = Array(10).fill(0);
        values.forEach(v => { if (v) counts[v]++; });
        for (let n = 1; n <= 9; n++) {
          const left = 9 - counts[n];
          numBtns[n].classList.toggle('complete', left <= 0);
          numBtns[n].lastChild.textContent = left > 0 ? left + ' left' : '✓';
        }
        notesBtn.textContent = notesMode ? '✎ Notes: on' : '✎ Notes: off';
        notesBtn.classList.toggle('primary', notesMode);
        notesBtn.setAttribute('aria-pressed', String(notesMode));
        pad.classList.toggle('notes-on', notesMode);
        undoBtn.disabled = !history.length;
      }

      function save() {
        if (done) return;
        ctx.save({ v: 1, puzzle: puzzle.join(''), solution: solution.join(''), values: values.join(''), notes, elapsed: Math.round(elapsed), mistakes, history: history.slice(-300) });
      }

      /* actions */
      function select(i) {
        if (done) return;
        selected = i;
        ctx.sound('tap');
        paint();
      }

      function record(changes) {
        if (changes.length) history.push(changes);
      }
      function snap(i) { return [i, values[i], notes[i]]; }

      function needSquare() {
        if (selected < 0) { ctx.toast('Tap a square first'); return true; }
        if (given[selected]) { ctx.toast('That number was given, so it can\'t be changed'); return true; }
        return false;
      }

      function enter(n) {
        if (done || needSquare()) return;
        const i = selected;
        if (notesMode) {
          if (values[i]) { ctx.toast('Erase the number first to add notes'); return; }
          record([snap(i)]);
          notes[i] ^= (1 << n);
          ctx.sound('tap');
        } else {
          if (values[i] === n) return;
          const changes = [snap(i)];
          values[i] = n;
          notes[i] = 0;
          for (const k of PEERS[i]) if (notes[k] & (1 << n)) { changes.push(snap(k)); notes[k] &= ~(1 << n); }
          record(changes);
          if (n !== solution[i]) {
            mistakes++;
            if (ctx.setting('showMistakes')) ctx.sound('bad'); else ctx.sound('tap');
          } else {
            ctx.sound('tap');
            celebrate(i);
          }
        }
        paint();
        save();
        checkWin();
      }

      function erase() {
        if (done || needSquare()) return;
        const i = selected;
        if (!values[i] && !notes[i]) return;
        record([snap(i)]);
        values[i] = 0; notes[i] = 0;
        ctx.sound('tap');
        paint(); save();
      }

      function undo() {
        if (done || !history.length) return;
        const changes = history.pop();
        for (let k = changes.length - 1; k >= 0; k--) { const [i, v, nt] = changes[k]; values[i] = v; notes[i] = nt; }
        selected = changes[0][0];
        ctx.sound('tap');
        paint(); save();
      }

      function toggleNotes() {
        if (done) return;
        notesMode = !notesMode;
        ctx.sound('tap');
        paint();
      }

      /* A gentle glow when a row, column or box is finished correctly. */
      function celebrate(i) {
        const unitsDone = [UNITS.find((u, n) => n % 3 === 0 && u.includes(i)), UNITS.find((u, n) => n % 3 === 1 && u.includes(i)), UNITS.find((u, n) => n % 3 === 2 && u.includes(i))]
          .filter(u => u.every(k => values[k] === solution[k]));
        if (!unitsDone.length) return;
        const set = new Set(unitsDone.flat());
        set.forEach(k => { cells[k].classList.remove('pulse'); void cells[k].offsetWidth; cells[k].classList.add('pulse'); });
        setTimeout(() => set.forEach(k => cells[k].classList.remove('pulse')), 900);
      }

      function checkWin() {
        if (values.some(v => !v)) return;
        if (values.every((v, i) => v === solution[i])) {
          done = true;
          tickTime();
          clearInterval(timer);
          const seconds = Math.max(1, Math.round(elapsed / 1000));
          ctx.setStatus('⏱ ' + fmt(elapsed));
          selected = -1; paint();
          wrap.classList.add('solved');
          ctx.finish({
            score: seconds, won: true,
            display: modeInfo.name + ' solved in ' + fmt(seconds * 1000),
            detail: { mode: modeInfo.id, seconds, mistakes },
            ms: seconds * 1000, delay: 1500,
          });
        } else {
          ctx.toast('The grid is full, but something isn\'t quite right yet. Have another look.', 3200);
        }
      }

      /* timer: counts only while the page is visible and no dialog is open */
      function fmt(ms) { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
      let last = performance.now(), sinceSave = 0;
      function tickTime() {
        const now = performance.now();
        const dt = Math.min(now - last, 1500);
        last = now;
        if (done || document.hidden || document.querySelector('.dialog-wrap')) return;
        elapsed += dt;
        sinceSave += dt;
      }
      const timer = setInterval(() => {
        tickTime();
        if (done) return;
        ctx.setStatus('⏱ ' + fmt(elapsed));
        if (sinceSave > 10000) { sinceSave = 0; save(); }
      }, 1000);
      const onVis = () => { if (document.hidden) { tickTime(); save(); } else last = performance.now(); };
      document.addEventListener('visibilitychange', onVis);
      ctx.onExit(() => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); tickTime(); save(); });

      /* physical keyboard */
      const onKey = (e) => {
        if (done || document.querySelector('.dialog-wrap')) return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { undo(); e.preventDefault(); return; }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
        if (moves[e.key]) {
          if (selected < 0) selected = 40;
          else {
            const r = R[selected], c = C[selected];
            if (e.key === 'ArrowUp') selected = ((r + 8) % 9) * 9 + c;
            if (e.key === 'ArrowDown') selected = ((r + 1) % 9) * 9 + c;
            if (e.key === 'ArrowLeft') selected = r * 9 + (c + 8) % 9;
            if (e.key === 'ArrowRight') selected = r * 9 + (c + 1) % 9;
          }
          paint();
        } else if (/^[1-9]$/.test(e.key)) enter(Number(e.key));
        else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') erase();
        else if (e.key.toLowerCase() === 'n') toggleNotes();
        else if (e.key.toLowerCase() === 'u') undo();
        else return;
        e.preventDefault();
      };
      document.addEventListener('keydown', onKey);
      ctx.onExit(() => document.removeEventListener('keydown', onKey));

      ctx.setStatus('⏱ ' + fmt(elapsed));
      paint();
      save();
    },
  };

  BT.registerGame(def);

  document.head.append(BT.h('style', null, `
    .sd-wrap { --sd-size: 340px; --sd-side: 280px; display: flex; flex-direction: column; align-items: center; gap: 14px; user-select: none; -webkit-user-select: none; }
    .sd-wrap.side { flex-direction: row; align-items: center; justify-content: center; gap: 24px; }
    .sd-gridwrap { width: var(--sd-size); flex: none; }
    .sd-grid { width: var(--sd-size); height: var(--sd-size); display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr);
      gap: 3px; padding: 3px; background: var(--ink); border-radius: 10px; }
    .sd-box { display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); gap: 1px; background: #b9b1a3; }
    .sd-box:nth-child(1) { border-top-left-radius: 7px; overflow: hidden; }
    .sd-box:nth-child(3) { border-top-right-radius: 7px; overflow: hidden; }
    .sd-box:nth-child(7) { border-bottom-left-radius: 7px; overflow: hidden; }
    .sd-box:nth-child(9) { border-bottom-right-radius: 7px; overflow: hidden; }
    .sd-cell { position: relative; display: grid; place-items: center; min-width: 0; min-height: 0; padding: 0; margin: 0; border: 0; border-radius: 0;
      background: var(--panel); color: var(--accent); font: inherit; font-size: calc(var(--sd-size) / 9 * 0.58); font-weight: 600; line-height: 1;
      cursor: pointer; touch-action: manipulation; font-variant-numeric: tabular-nums; }
    .sd-cell.given { color: var(--ink); font-weight: 800; background: #f3efe7; }
    .sd-cell.peer { background: #e5eef2; }
    .sd-cell.given.peer { background: #dce6ea; }
    .sd-cell.same { background: #bcd9e6; }
    .sd-cell.sel { background: #8fc3da; box-shadow: inset 0 0 0 3px var(--accent); }
    .sd-cell.wrong { color: var(--bad); }
    .sd-cell.wrong:not(.sel) { background: #f8dcd6; }
    .sd-cell.pulse { animation: sd-pulse 0.85s ease-out; }
    @keyframes sd-pulse { 0% { background: #bfe3c8; } 100% { } }
    .sd-wrap.solved .sd-cell { background: #e4f3e7; }
    .sd-notes { position: absolute; inset: 2px; display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr);
      font-size: calc(var(--sd-size) / 9 * 0.27); font-weight: 600; color: #4d5868; line-height: 1; }
    .sd-notes span { display: grid; place-items: center; }
    .sd-notes span.hi { background: #8fc3da; color: var(--ink); border-radius: 4px; }
    .sd-pad { width: var(--sd-size); display: flex; flex-direction: column; gap: 10px; }
    .sd-nums { display: grid; grid-template-columns: repeat(9, 1fr); gap: 6px; }
    .sd-num { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 66px; padding: 4px 0; min-width: 0;
      border: 2px solid var(--line); border-radius: 12px; background: var(--panel); color: var(--accent); font: inherit; cursor: pointer; touch-action: manipulation; }
    .sd-num:active { transform: scale(0.96); background: #e5eef2; }
    .sd-num-digit { font-size: 1.75rem; font-weight: 700; line-height: 1.05; }
    .sd-num-left { font-size: 0.85rem; color: var(--muted); font-weight: 600; white-space: nowrap; }
    .sd-num.complete { opacity: 0.4; background: #ece7de; }
    .sd-pad.notes-on .sd-num { border-color: var(--accent); border-style: dashed; }
    .sd-pad.notes-on .sd-num-digit { font-size: 1.25rem; color: #4d5868; }
    .sd-tools { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .sd-tool { padding: 0.4em 0.3em; min-width: 0; white-space: nowrap; }
    .sd-wrap.side .sd-pad { width: var(--sd-side); gap: 14px; }
    .sd-wrap.side .sd-nums { grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .sd-wrap.side .sd-num { min-height: 84px; }
    .sd-wrap.side .sd-num-digit { font-size: 2.1rem; }
    .sd-wrap.side .sd-pad.notes-on .sd-num-digit { font-size: 1.5rem; }
    .sd-wrap.side .sd-tools { grid-template-columns: 1fr; gap: 10px; }
    .sd-wrap.side .sd-tool { min-height: 60px; }
    @media (max-width: 480px) {
      .sd-nums { grid-template-columns: repeat(10, 1fr); gap: 6px; }
      .sd-num { grid-column: span 2; min-height: 58px; border-radius: 10px; }
      .sd-num:nth-child(6) { grid-column: 2 / span 2; }
      .sd-num-digit { font-size: 1.5rem; }
      .sd-num-left { font-size: 0.75rem; }
      .sd-tools { gap: 6px; }
      .sd-tool { font-size: 0.9rem; padding: 0.4em 0.2em; }
    }
  `));
})();
