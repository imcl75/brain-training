/* Four Groups: sixteen words hide four groups of four. Find them all with
 * fewer than four mistakes. Puzzles are in js/data/groups.js. */
(function () {
  const MAX_MISTAKES = 4;

  function puzzleIndex(ctx, n) {
    if (ctx.practice) return ctx.rng.int(n);
    return ((BT.dayNumber(ctx.date) % n) + n) % n;
  }
  const key = (words) => words.slice().sort().join('|');
  const upper = (w) => w.toUpperCase();

  function sizeClass(w) {
    const longest = Math.max(...w.split(' ').map(p => p.length));
    return longest >= 10 ? ' gr-xl' : longest >= 8 ? ' gr-l' : longest >= 6 ? ' gr-m' : '';
  }

  function solvedRow(group, extraClass) {
    return BT.h('div', { class: 'gr-solved gr-lv' + group.level + (extraClass || ''), role: 'listitem' },
      BT.h('div', { class: 'gr-solved-name' }, group.name),
      BT.h('div', { class: 'gr-solved-words' }, group.words.map(upper).join(', ')));
  }

  BT.registerGame({
    id: 'groups',
    name: 'Four Groups',
    category: 'words',
    icon: '🟪',
    blurb: 'Sort sixteen words into four groups of four',
    daily: true,
    better: 'lower',
    scripts: ['js/data/groups.js'],
    howTo: `<p>There are sixteen words. They make <b>four groups of four</b> that share something in common.</p>
      <p>Tap four words you think belong together, then tap <b>Submit</b>.</p>
      <ul><li>If you are right, the group is coloured in and the connection is shown.</li>
      <li>If not, you use up one of your four mistakes. &ldquo;One away&rdquo; means three of your four are right.</li></ul>
      <p>Watch out: some words look as if they fit more than one group. The colours go from
      <b style="background:#f2d46f;padding:0 4px;border-radius:4px">gentle</b>
      <b style="background:#a8d38d;padding:0 4px;border-radius:4px">steady</b>
      <b style="background:#9cc3ea;padding:0 4px;border-radius:4px">tricky</b> to
      <b style="background:#c7a6e3;padding:0 4px;border-radius:4px">crafty</b> (often wordplay).</p>
      <p>A new puzzle every day.</p>`,

    start(ctx) {
      const bank = BT.data.groups;
      const idx = puzzleIndex(ctx, bank.length);
      const puzzle = bank[idx];
      const groups = puzzle.groups;
      const groupOf = {};
      groups.forEach((g, gi) => g.words.forEach(w => { groupOf[w] = gi; }));

      const saved = ctx.load();
      const resume = saved && saved.idx === idx;
      let solved = resume ? saved.solved.slice() : [];          // group indices, in the order found
      let mistakes = resume ? saved.mistakes : 0;
      const wrong = new Set(resume ? saved.wrong : []);         // keys of wrong guesses
      let order = resume ? saved.order.slice()
        : ctx.rng.shuffle(groups.flatMap(g => g.words));        // unsolved words, display order
      order = order.filter(w => !solved.includes(groupOf[w]));
      let selected = [];
      let busy = false, over = false;
      const timers = [];
      const later = (fn, ms) => timers.push(setTimeout(fn, ms));

      const board = BT.h('div', { class: 'gr-board', role: 'list' });
      const message = BT.h('div', { class: 'message gr-message', 'aria-live': 'polite' });
      const dots = BT.h('div', { class: 'gr-dots', 'aria-live': 'polite' });
      const shuffleBtn = BT.h('button', { class: 'btn', onclick: shuffle }, 'Shuffle');
      const clearBtn = BT.h('button', { class: 'btn', onclick: deselect }, 'Deselect all');
      const submitBtn = BT.h('button', { class: 'btn primary gr-submit', onclick: submit }, 'Submit');
      ctx.el.append(BT.h('div', { class: 'gr-wrap' },
        BT.h('p', { class: 'gr-lead' }, 'Make four groups of four'),
        board, message, dots,
        BT.h('div', { class: 'game-buttons gr-buttons' }, shuffleBtn, clearBtn, submitBtn)));

      function save() {
        ctx.save({ idx, order, solved, mistakes, wrong: [...wrong] });
      }

      function render(newGroup) {
        const kids = solved.map(gi => solvedRow(groups[gi], gi === newGroup ? ' gr-new' : ''));
        order.forEach(w => {
          const on = selected.includes(w);
          kids.push(BT.h('button', {
            class: 'gr-tile' + sizeClass(w) + (on ? ' on' : ''), 'aria-pressed': String(on), 'data-word': w,
            onclick: () => toggle(w),
          }, BT.h('span', null, upper(w))));
        });
        board.replaceChildren(...kids);
        fitTiles();
        paintControls();
      }

      function paintControls() {
        const left = MAX_MISTAKES - mistakes;
        dots.replaceChildren(BT.h('span', null, 'Mistakes left:'),
          ...Array.from({ length: MAX_MISTAKES }, (_, i) =>
            BT.h('span', { class: 'gr-dot' + (i < left ? '' : ' used'), 'aria-hidden': 'true' })),
          BT.h('span', { class: 'gr-sr' }, String(left)));
        submitBtn.disabled = over || busy || selected.length !== 4;
        clearBtn.disabled = over || busy || !selected.length;
        shuffleBtn.disabled = over || busy;
        ctx.setStatus(solved.length + ' of 4 found');
      }

      // Shrink any word that is still too wide for its tile.
      function fitTiles() {
        board.querySelectorAll('.gr-tile span').forEach(s => {
          s.style.fontSize = '';
          let size = parseFloat(getComputedStyle(s).fontSize), guard = 0;
          while (s.scrollWidth > s.parentNode.clientWidth - 8 && size > 9 && guard++ < 20) {
            size -= 1; s.style.fontSize = size + 'px';
          }
        });
      }

      function toggle(w) {
        if (busy || over) return;
        if (selected.includes(w)) selected = selected.filter(x => x !== w);
        else if (selected.length < 4) selected.push(w);
        else return;
        ctx.sound('tap');
        message.textContent = '';
        board.querySelectorAll('.gr-tile').forEach(t => {
          const on = selected.includes(t.dataset.word);
          t.classList.toggle('on', on); t.setAttribute('aria-pressed', String(on));
        });
        paintControls();
      }

      function deselect() {
        if (busy || over) return;
        selected = [];
        message.textContent = '';
        render();
      }

      function shuffle() {
        if (busy || over) return;
        order = BT.rng(Date.now()).shuffle(order);
        save();
        render();
      }

      function tilesFor(words) {
        return [...board.querySelectorAll('.gr-tile')].filter(t => words.includes(t.dataset.word));
      }

      function submit() {
        if (busy || over || selected.length !== 4) return;
        const k = key(selected);
        if (wrong.has(k)) { message.textContent = 'You have already tried those four.'; return; }
        const counts = {};
        selected.forEach(w => { counts[groupOf[w]] = (counts[groupOf[w]] || 0) + 1; });
        const best = Math.max(...Object.values(counts));
        busy = true; paintControls();
        const tiles = tilesFor(selected);
        // A little hop in reading order before the answer is shown.
        tiles.sort((a, b) => order.indexOf(a.dataset.word) - order.indexOf(b.dataset.word))
          .forEach((t, i) => later(() => t.classList.add('gr-hop'), i * 90));
        later(() => (best === 4 ? correct() : incorrect(k, best)), 4 * 90 + 300);
      }

      function correct() {
        const gi = groupOf[selected[0]];
        solved.push(gi);
        order = order.filter(w => groupOf[w] !== gi);
        selected = [];
        busy = false;
        ctx.sound('good');
        message.textContent = ['Well spotted!', 'Lovely!', 'Nicely done!', 'Splendid!'][solved.length - 1];
        save();
        render(gi);
        if (solved.length === 4) win();
      }

      function incorrect(k, best) {
        wrong.add(k);
        mistakes++;
        ctx.sound('bad');
        const tiles = tilesFor(selected);
        tiles.forEach(t => { t.classList.remove('gr-hop'); void t.offsetWidth; t.classList.add('gr-shake'); });
        message.textContent = best === 3 ? 'One away…' : mistakes >= MAX_MISTAKES ? 'Not quite.' : 'Not quite, try again.';
        save();
        later(() => {
          tiles.forEach(t => t.classList.remove('gr-shake'));
          busy = false;
          if (mistakes >= MAX_MISTAKES) lose(); else paintControls();
        }, 600);
        paintControls();
      }

      function summary() {
        return BT.h('div', { class: 'gr-summary', role: 'list' },
          groups.slice().sort((a, b) => a.level - b.level).map(g => solvedRow(g)));
      }
      const plural = (n) => n + (n === 1 ? ' mistake' : ' mistakes');

      function win() {
        over = true; paintControls();
        ctx.finish({
          score: mistakes, won: true,
          display: mistakes === 0 ? 'Solved perfectly!' : 'Solved with ' + plural(mistakes),
          detail: { puzzle: idx, mistakes, found: 4 },
          extra: summary(), delay: 1600,
        });
      }

      function lose() {
        over = true;
        selected = [];
        const found = solved.length;
        message.textContent = 'Out of mistakes. Here are the groups:';
        const rest = groups.map((g, gi) => gi).filter(gi => !solved.includes(gi))
          .sort((a, b) => groups[a].level - groups[b].level);
        render();
        rest.forEach((gi, i) => later(() => {
          solved.push(gi);
          order = order.filter(w => groupOf[w] !== gi);
          render(gi);
        }, 700 + i * 900));
        later(() => ctx.finish({
          score: MAX_MISTAKES + 1, won: false,
          display: 'Found ' + found + ' of 4 groups',
          detail: { puzzle: idx, mistakes, found },
          extra: summary(), delay: 2200,
        }), 700 + rest.length * 900);
      }

      const onKey = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'Enter') submit();
        else if (e.key === 'Escape') deselect();
        else return;
        e.preventDefault();
      };
      let resizeTimer = null;
      const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(fitTiles, 150); };
      document.addEventListener('keydown', onKey);
      window.addEventListener('resize', onResize);
      ctx.onExit(() => {
        document.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', onResize);
        timers.forEach(clearTimeout);
        clearTimeout(resizeTimer);
      });

      render();
      if (resume && mistakes >= MAX_MISTAKES) lose();
      else if (resume && solved.length === 4) win();
    },
  });

  document.head.append(BT.h('style', null, `
    .gr-wrap { max-width: 680px; margin: 0 auto; }
    .gr-lead { text-align: center; color: var(--muted); margin: 0 0 12px; font-size: 1.05rem; }
    .gr-board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
    .gr-tile {
      min-height: 78px; padding: 4px; border: 0; border-radius: 12px;
      background: #e9e3d6; color: var(--ink); font: inherit; font-weight: 800;
      display: flex; align-items: center; justify-content: center; text-align: center;
      cursor: pointer; touch-action: manipulation; user-select: none; -webkit-user-select: none;
      transition: background 0.12s, transform 0.12s; overflow: hidden;
    }
    .gr-tile span { display: block; max-width: 100%; line-height: 1.15; font-size: min(1.4rem, 4.6vw); letter-spacing: 0.01em; }
    .gr-tile.gr-m span { font-size: min(1.25rem, 3.9vw); }
    .gr-tile.gr-l span { font-size: min(1.12rem, 3.3vw); }
    .gr-tile.gr-xl span { font-size: min(1.02rem, 2.85vw); }
    .gr-tile:active { transform: scale(0.97); }
    .gr-tile.on { background: #4a5163; color: #fff; }
    .gr-tile.gr-hop { animation: gr-hop 0.3s ease; }
    .gr-tile.gr-shake { animation: gr-shake 0.45s; }
    @keyframes gr-hop { 50% { transform: translateY(-8px); } }
    @keyframes gr-shake { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
    .gr-solved, .gr-summary .gr-solved { grid-column: 1 / -1; border-radius: 12px; padding: 10px 12px; text-align: center; min-height: 78px;
      display: flex; flex-direction: column; justify-content: center; color: #1d2433; }
    .gr-solved-name { font-weight: 800; font-size: 1.1rem; }
    .gr-solved-words { font-size: 1rem; letter-spacing: 0.02em; }
    .gr-solved.gr-new { animation: gr-pop 0.45s ease; }
    @keyframes gr-pop { from { transform: scale(0.85); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .gr-lv0 { background: #f2d46f; }
    .gr-lv1 { background: #a8d38d; }
    .gr-lv2 { background: #9cc3ea; }
    .gr-lv3 { background: #c7a6e3; }
    .gr-message { min-height: 1.6em; margin: 12px 0 4px; }
    .gr-dots { display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--muted); font-weight: 600; }
    .gr-dot { width: 16px; height: 16px; border-radius: 50%; background: #4a5163; transition: background 0.3s; }
    .gr-dot.used { background: transparent; box-shadow: inset 0 0 0 2px #b9b2a4; }
    .gr-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .gr-buttons .btn { min-width: 120px; }
    .gr-summary { display: grid; gap: 8px; max-width: 560px; margin: 18px auto 0; }
    @media (max-width: 480px) {
      .gr-board { gap: 6px; }
      .gr-tile { min-height: 68px; border-radius: 10px; padding: 3px; }
      .gr-buttons .btn { min-width: 0; flex: 1 1 0; padding: 0.5em 0.6em; }
      .gr-solved-words { font-size: 0.9rem; }
    }
    @media (min-width: 700px) and (min-height: 700px) { .gr-board { gap: 10px; } .gr-tile, .gr-solved { min-height: clamp(96px, 13vh, 128px); } }
  `));
})();
