/* Pairs: turn over two cards at a time and find all the matching pictures.
 * Score = number of moves (one move = two cards turned over); fewer is better. */
(function () {
  const PICS = [
    ['🍎', 'apple'], ['🍌', 'banana'], ['🍇', 'grapes'], ['🍓', 'strawberry'], ['🍐', 'pear'],
    ['🍍', 'pineapple'], ['🍉', 'watermelon'], ['🥕', 'carrot'], ['🌻', 'sunflower'], ['🌷', 'tulip'],
    ['🦋', 'butterfly'], ['🐠', 'fish'], ['🐸', 'frog'], ['🐧', 'penguin'], ['🐱', 'cat'],
    ['🐶', 'dog'], ['🐰', 'rabbit'], ['🦉', 'owl'], ['🐢', 'tortoise'], ['🍄', 'mushroom'],
    ['🐞', 'ladybird'], ['🐘', 'elephant'], ['🌈', 'rainbow'], ['🐝', 'bee'],
  ];
  const SIZES = { small: 12, medium: 16, large: 24 };
  const GAP = 10;

  BT.registerGame({
    id: 'pairs',
    name: 'Pairs',
    category: 'memory',
    icon: '🃏',
    blurb: 'Turn over the cards and find the matching pictures',
    daily: false,
    better: 'lower',
    modes: [
      { id: 'small', name: 'Small', blurb: '12 cards, 6 pairs' },
      { id: 'medium', name: 'Medium', blurb: '16 cards, 8 pairs' },
      { id: 'large', name: 'Large', blurb: '24 cards, 12 pairs' },
    ],
    modesPrompt: 'How many cards would you like?',
    howTo: `<p>All the cards are face down. Each picture is on two cards.</p>
      <p>Tap a card to turn it over, then tap another. If the two pictures match, they stay face up.
      If not, they turn back over after a moment, so try to remember where they were.</p>
      <p>Find all the pairs in as few moves as you can. There is no rush: take your time.</p>`,

    start(ctx) {
      const total = SIZES[ctx.mode] || 16;
      const pairs = total / 2;
      const pics = ctx.rng.shuffle(PICS).slice(0, pairs);
      const deck = ctx.rng.shuffle(pics.concat(pics)).map((p, i) => ({ i, pic: p[0], name: p[1], up: false, matched: false }));

      let first = null, second = null, lockTimer = null;
      let moves = 0, found = 0, over = false;
      let elapsed = 0, clockFrom = null, started = false;

      const hint = BT.h('p', { class: 'pa-hint', 'aria-live': 'polite' }, 'Tap a card to turn it over.');
      const grid = BT.h('div', { class: 'pa-grid' });
      deck.forEach(c => {
        c.el = BT.h('button', { class: 'pa-card', type: 'button', 'aria-label': 'Card ' + (c.i + 1) + ', face down', onclick: () => tap(c) },
          BT.h('span', { class: 'pa-inner' },
            BT.h('span', { class: 'pa-face pa-back', 'aria-hidden': 'true' }),
            BT.h('span', { class: 'pa-face pa-front', 'aria-hidden': 'true' }, c.pic)));
        grid.append(c.el);
      });
      ctx.el.append(hint, grid);

      function status() {
        ctx.setStatus('Moves ' + moves + ' · Pairs ' + found + '/' + pairs);
      }

      function show(c, up) {
        c.up = up;
        c.el.classList.toggle('up', up);
        c.el.setAttribute('aria-label', up ? c.name : 'Card ' + (c.i + 1) + ', face down');
      }

      function turnBack() {
        if (lockTimer) { clearTimeout(lockTimer); lockTimer = null; }
        if (first) show(first, false);
        if (second) show(second, false);
        first = second = null;
      }

      function now() { return performance.now(); }
      function seconds() { return Math.round((elapsed + (clockFrom != null ? now() - clockFrom : 0)) / 1000); }

      function tap(c) {
        if (over || c.up || c.matched) return;
        // A mismatched pair still showing: turn it back straight away.
        if (lockTimer) turnBack();
        if (!started) { started = true; clockFrom = now(); hint.textContent = ''; }
        show(c, true);
        ctx.sound('tap');
        if (!first) { first = c; return; }
        second = c;
        moves++;
        if (first.pic === second.pic) {
          first.matched = second.matched = true;
          first.el.classList.add('matched');
          second.el.classList.add('matched');
          first = second = null;
          found++;
          ctx.sound('good');
          if (found === pairs) win();
        } else {
          lockTimer = setTimeout(turnBack, 1100);
        }
        status();
      }

      function win() {
        over = true;
        const secs = seconds();
        clockFrom = null;
        hint.textContent = 'All pairs found!';
        ctx.finish({
          score: moves, won: true,
          display: 'Matched all ' + pairs + ' pairs in ' + moves + ' moves (' + BT.fmtTime(secs * 1000) + ')',
          detail: { mode: ctx.mode, moves, seconds: secs },
          ms: secs * 1000, delay: 1300,
        });
      }

      // Fit the cards to the screen: try each grid shape and keep the one with the biggest cards.
      function layout() {
        const W = ctx.el.clientWidth;
        const top = grid.getBoundingClientRect().top + window.scrollY;
        const H = Math.max(240, window.innerHeight - top - 20);
        let best = { size: 0, cols: 4 };
        for (let cols = 2; cols <= total / 2; cols++) {
          if (total % cols) continue;
          const rows = total / cols;
          const size = Math.min((W - (cols - 1) * GAP) / cols, (H - (rows - 1) * GAP) / rows);
          if (size > best.size) best = { size, cols };
        }
        const size = Math.max(60, Math.min(170, Math.floor(best.size)));
        grid.style.setProperty('--pa-cols', best.cols);
        grid.style.setProperty('--pa-size', size + 'px');
      }

      const onResize = () => layout();
      const onVisible = () => {
        if (over || !started) return;
        if (document.hidden) { if (clockFrom != null) { elapsed += now() - clockFrom; clockFrom = null; } }
        else if (clockFrom == null) clockFrom = now();
      };
      window.addEventListener('resize', onResize);
      document.addEventListener('visibilitychange', onVisible);
      ctx.onExit(() => {
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisible);
        if (lockTimer) clearTimeout(lockTimer);
      });

      layout();
      status();
    },
  });

  document.head.append(BT.h('style', null, `
    .pa-hint { text-align: center; color: var(--muted); font-weight: 600; min-height: 1.5em; margin: 0 0 10px; }
    .pa-grid { display: grid; grid-template-columns: repeat(var(--pa-cols, 4), var(--pa-size, 100px)); gap: ${GAP}px;
      justify-content: center; margin: 0 auto; }
    .pa-card { width: var(--pa-size, 100px); height: var(--pa-size, 100px); padding: 0; border: 0; background: none;
      cursor: pointer; perspective: 700px; -webkit-perspective: 700px; touch-action: manipulation;
      -webkit-user-select: none; user-select: none; }
    .pa-inner { position: relative; display: block; width: 100%; height: 100%; transition: transform 0.4s ease;
      transform-style: preserve-3d; -webkit-transform-style: preserve-3d; }
    .pa-card.up .pa-inner { transform: rotateY(180deg); }
    .pa-face { position: absolute; inset: 0; border-radius: 14px; display: grid; place-items: center;
      backface-visibility: hidden; -webkit-backface-visibility: hidden; box-shadow: var(--shadow); }
    .pa-back { background-color: #2f7a6b;
      background-image: radial-gradient(rgba(255,255,255,0.22) 2px, transparent 2.6px),
        linear-gradient(135deg, #3f8f7c, #276457);
      background-size: 14px 14px, 100% 100%;
      box-shadow: inset 0 0 0 5px rgba(255,255,255,0.35), var(--shadow); }
    .pa-back::after { content: ''; width: 34%; height: 34%; border-radius: 50%; border: 3px solid rgba(255,255,255,0.55); }
    .pa-front { transform: rotateY(180deg); background: var(--panel); border: 3px solid var(--line);
      font-size: calc(var(--pa-size, 100px) * 0.56); line-height: 1; }
    .pa-card.matched .pa-front { background: #eef7ef; border-color: var(--good); animation: pa-pop 0.45s ease 0.3s; }
    @keyframes pa-pop { 50% { transform: rotateY(180deg) scale(1.08); } }
    .pa-card:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; border-radius: 14px; }
  `));
})();
