/* Sequence: watch the pads light up, then tap them in the same order.
 * Each round adds one more step. Score = the longest sequence repeated correctly. */
(function () {
  const SHAPES = {
    circle: '<circle cx="50" cy="50" r="34"/>',
    square: '<rect x="18" y="18" width="64" height="64" rx="6"/>',
    triangle: '<path d="M50 14 L88 82 L12 82 Z" stroke-linejoin="round"/>',
    star: '<path d="M50 10 L61 38 L91 39 L67 58 L76 88 L50 70 L24 88 L33 58 L9 39 L39 38 Z" stroke-linejoin="round"/>',
  };
  const PADS = [
    { name: 'Blue circle', shape: 'circle', col: '#2463a8', lit: '#5fa8f5', freq: 329.63 },
    { name: 'Red square', shape: 'square', col: '#b23a2c', lit: '#f5705e', freq: 392.0 },
    { name: 'Green triangle', shape: 'triangle', col: '#2d7a3a', lit: '#5fcc70', freq: 523.25 },
    { name: 'Gold star', shape: 'star', col: '#a8770c', lit: '#f5c443', freq: 659.25 },
  ];

  function shapeSvg(shape) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 100 100');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('class', 'sq-shape');
    s.innerHTML = SHAPES[shape];
    return s;
  }

  BT.registerGame({
    id: 'sequence',
    name: 'Sequence',
    category: 'memory',
    icon: '🎵',
    blurb: 'Watch the pattern, then tap it back',
    daily: false,
    better: 'higher',
    howTo: `<p>Four coloured pads each have their own shape and their own note.</p>
      <p>Watch as some of the pads light up, one after another. When it says <b>Your turn</b>,
      tap the pads in the same order.</p>
      <p>Each time you get it right, the pattern grows by one. There is no time limit for your turn.</p>
      <p>If you make a slip, you can try that pattern once more (once per game).</p>`,

    start(ctx) {
      const rand = () => Math.floor(Math.random() * PADS.length);
      let seq = [], idx = 0, longest = 0, retryUsed = false;
      let state = 'ready'; // ready | watch | input | between | missed | paused | over
      let timers = [];

      const later = (fn, ms) => { const t = setTimeout(() => { timers = timers.filter(x => x !== t); fn(); }, ms); timers.push(t); };
      const cancelAll = () => { timers.forEach(clearTimeout); timers = []; };

      const pads = PADS.map((p, i) => {
        const el = BT.h('button', { class: 'sq-pad', type: 'button', 'aria-label': p.name, style: '--sq-col:' + p.col + ';--sq-lit:' + p.lit });
        el.append(shapeSvg(p.shape));
        el.addEventListener('pointerdown', (e) => { if (e.isPrimary !== false) { e.preventDefault(); press(i); } });
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(i); } });
        return el;
      });
      const board = BT.h('div', { class: 'sq-board' }, pads);
      const message = BT.h('div', { class: 'sq-message', 'aria-live': 'polite' });
      const buttons = BT.h('div', { class: 'game-buttons sq-buttons' });
      ctx.el.append(BT.h('div', { class: 'sq-wrap' }, board, BT.h('div', { class: 'sq-side' }, message, buttons)));

      function say(text, small) {
        message.replaceChildren(BT.h('div', { class: 'sq-say' }, text), small ? BT.h('div', { class: 'sq-small' }, small) : null);
      }
      function setButtons(list) {
        buttons.replaceChildren(...list.map(b => BT.h('button', { class: 'btn big' + (b.primary ? ' primary' : ''), type: 'button', onclick: b.onclick }, b.label)));
      }
      function status() { ctx.setStatus(seq.length ? 'Length ' + seq.length + (longest ? ' · Best ' + longest : '') : ''); }
      function setTurn(on) { board.classList.toggle('sq-yours', on); }

      function light(i, ms) {
        const el = pads[i];
        el.classList.add('lit');
        ctx.tone(PADS[i].freq, Math.max(160, ms), 'triangle', 0.16);
        later(() => el.classList.remove('lit'), ms);
      }

      // A gentle pace that speeds up a little as the pattern grows.
      function pace() {
        const n = seq.length;
        return { on: Math.max(300, 560 - 20 * (n - 1)), gap: Math.max(150, 260 - 9 * (n - 1)) };
      }

      function play() {
        cancelAll();
        pads.forEach(p => p.classList.remove('lit', 'hint'));
        state = 'watch';
        setTurn(false);
        setButtons([]);
        say('Watch…');
        status();
        const { on, gap } = pace();
        let t = 800;
        seq.forEach(i => { later(() => light(i, on), t); t += on + gap; });
        later(() => {
          state = 'input';
          idx = 0;
          setTurn(true);
          say('Your turn', seq.length === 1 ? 'Tap the pad that lit up.' : 'Tap the ' + seq.length + ' pads in the same order.');
        }, t);
      }

      function begin() {
        seq = [rand()];
        longest = 0;
        retryUsed = false;
        play();
      }

      function press(i) {
        if (state !== 'input') return;
        light(i, 220);
        if (i === seq[idx]) {
          idx++;
          if (idx === seq.length) {
            longest = seq.length;
            state = 'between';
            setTurn(false);
            say(BT.cheer(), 'Here comes one more…');
            status();
            later(() => { seq.push(rand()); play(); }, 1100);
          }
          return;
        }
        // A slip.
        state = 'missed';
        setTurn(false);
        const right = seq[idx];
        later(() => {
          ctx.sound('bad');
          pads[right].classList.add('hint');
          later(() => pads[right].classList.remove('hint'), 1400);
        }, 260);
        if (!retryUsed) {
          say('Not quite', 'The next one was the ' + PADS[right].name.toLowerCase() + '. You can try that pattern once more.');
          setButtons([
            { label: 'Try that one again', primary: true, onclick: () => { retryUsed = true; play(); } },
            { label: 'Finish here', onclick: end },
          ]);
        } else {
          say('Not quite', 'The next one was the ' + PADS[right].name.toLowerCase() + '.');
          setButtons([]);
          later(end, 1800);
        }
      }

      function end() {
        if (state === 'over') return;
        state = 'over';
        cancelAll();
        setButtons([]);
        if (longest > 0) {
          ctx.finish({ score: longest, won: true, display: 'Remembered a sequence of ' + longest, detail: { longest }, delay: 600 });
        } else {
          ctx.finish({ score: 0, won: false, display: 'Not this time. Have another go!', detail: { longest: 0 }, delay: 600 });
        }
      }

      function ready() {
        state = 'ready';
        setTurn(false);
        say('Ready when you are', 'Watch the pads light up, then copy them.');
        setButtons([{ label: 'Start', primary: true, onclick: begin }]);
      }

      // Leaving the app part-way through the pattern: stop, and offer to show it again.
      const onVisible = () => {
        if (document.hidden && (state === 'watch' || state === 'between')) {
          const grow = state === 'between';
          cancelAll();
          pads.forEach(p => p.classList.remove('lit', 'hint'));
          if (grow) seq.push(rand());
          state = 'paused';
          setTurn(false);
          say('Paused', 'Tap below when you are ready to watch the pattern.');
          setButtons([{ label: 'Watch the pattern', primary: true, onclick: play }]);
        }
      };
      const onKey = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const n = Number(e.key);
        if (n >= 1 && n <= PADS.length) { press(n - 1); e.preventDefault(); }
      };
      document.addEventListener('visibilitychange', onVisible);
      document.addEventListener('keydown', onKey);
      ctx.onExit(() => {
        cancelAll();
        document.removeEventListener('visibilitychange', onVisible);
        document.removeEventListener('keydown', onKey);
      });

      ready();
    },
  });

  document.head.append(BT.h('style', null, `
    .sq-wrap { display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .sq-board { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 14px; border-radius: 26px;
      background: #e9e3d8; border: 3px solid transparent; transition: border-color 0.2s, background 0.2s;
      width: min(100%, 600px, calc(100vh - 330px)); width: min(100%, 600px, calc(100svh - 330px)); min-width: 260px; }
    .sq-board.sq-yours { border-color: var(--cat); background: #e3eee1; }
    .sq-pad { aspect-ratio: 1; border: 0; border-radius: 20px; padding: 0; cursor: pointer;
      background: var(--sq-col); display: grid; place-items: center;
      box-shadow: inset 0 -6px 0 rgba(0,0,0,0.18), var(--shadow);
      transition: background 0.08s, transform 0.08s, box-shadow 0.08s; touch-action: manipulation;
      -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    .sq-pad.lit { background: var(--sq-lit); transform: scale(1.04);
      box-shadow: 0 0 0 5px #fff, 0 0 28px 6px var(--sq-lit); }
    .sq-pad.hint { animation: sq-hint 0.7s ease 2; }
    @keyframes sq-hint { 50% { box-shadow: 0 0 0 7px #fff, 0 0 0 11px var(--ink); } }
    .sq-shape { width: 44%; height: 44%; fill: #fff; stroke: rgba(0,0,0,0.25); stroke-width: 3; transition: transform 0.08s; }
    .sq-pad.lit .sq-shape { transform: scale(1.15); }
    .sq-pad:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
    .sq-side { text-align: center; }
    .sq-message { min-height: 4.2em; }
    .sq-say { font-size: 1.5rem; font-weight: 800; }
    .sq-small { color: var(--muted); font-weight: 600; max-width: 30em; margin: 2px auto 0; }
    .sq-buttons { margin-top: 4px; min-height: 64px; }
    .sq-buttons .btn { min-width: 200px; }
    @media (orientation: landscape) and (min-width: 900px) {
      .sq-wrap { flex-direction: row; justify-content: center; gap: 36px; }
      .sq-board { width: min(56vw, 560px, calc(100vh - 130px)); width: min(56vw, 560px, calc(100svh - 130px)); }
      .sq-side { width: 320px; }
      .sq-buttons { flex-direction: column; align-items: stretch; }
    }
  `));
})();
