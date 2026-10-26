/* Colour Clash: a colour word is shown in a coloured ink. Tap the colour of the INK,
 * not the word. 45 seconds. Score = correct answers. */
(function () {
  const SECONDS = 45;
  const COLOURS = [
    { id: 'red', name: 'Red', ink: '#c62828' },
    { id: 'blue', name: 'Blue', ink: '#1f55c0' },
    { id: 'green', name: 'Green', ink: '#2a7a30' },
    { id: 'yellow', name: 'Yellow', ink: '#b07f00' },
  ];

  BT.registerGame({
    id: 'colour-clash',
    name: 'Colour Clash',
    category: 'speed',
    icon: '🎨',
    blurb: 'Name the ink colour, not the word',
    daily: false,
    better: 'higher',
    howTo: `<p>You will see a colour word, such as <b style="color:#1f55c0">RED</b>, printed in a coloured ink.</p>
      <p>Tap the button for the colour of the <b>ink</b>, not the word. So for
      <b style="color:#1f55c0">RED</b> you would tap <b>Blue</b>.</p>
      <p>You have ${SECONDS} seconds, starting when you tap Start. Get as many right as you can:
      a slip just moves you on to the next word.</p>`,

    start(ctx) {
      let correct = 0, wrong = 0;
      let state = 'ready'; // ready | play | wait | paused | over
      let remaining = SECONDS * 1000, last = 0, tick = null, nextTimer = null;
      let item = null;

      const word = BT.h('div', { class: 'cc-word', 'aria-live': 'polite' });
      const mark = BT.h('div', { class: 'cc-mark', 'aria-hidden': 'true' });
      const stage = BT.h('div', { class: 'cc-stage' }, word, mark);
      const note = BT.h('div', { class: 'cc-note', 'aria-live': 'polite' });
      const answers = BT.h('div', { class: 'cc-answers' }, COLOURS.map((c, i) => {
        const b = BT.h('button', { class: 'cc-btn', type: 'button', 'aria-label': c.name },
          BT.h('span', { class: 'cc-swatch', style: 'background:' + c.ink, 'aria-hidden': 'true' }), c.name);
        b.addEventListener('pointerdown', (e) => { if (e.isPrimary !== false) { e.preventDefault(); answer(i); } });
        b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); answer(i); } });
        return b;
      }));
      const startBtn = BT.h('button', { class: 'btn big primary cc-start', type: 'button', onclick: begin }, 'Start');
      const overlay = BT.h('div', { class: 'cc-overlay' },
        BT.h('p', { class: 'cc-intro' }, 'Tap the colour of the ', BT.h('b', null, 'ink'), ', not the word.'),
        startBtn);
      ctx.el.append(BT.h('div', { class: 'cc-wrap' }, BT.h('div', { class: 'cc-top' }, stage, overlay), note, answers));
      answers.classList.add('cc-off');

      function clock() {
        const s = Math.ceil(remaining / 1000);
        ctx.setStatus('⏱ ' + BT.fmtTime(s * 1000) + ' · ✓ ' + correct);
      }

      function nextItem() {
        let w, ink;
        do {
          w = Math.floor(Math.random() * COLOURS.length);
          // Mostly a clash: the ink matches the word only one time in four.
          ink = Math.random() < 0.25 ? w : (w + 1 + Math.floor(Math.random() * (COLOURS.length - 1))) % COLOURS.length;
        } while (item && item.w === w && item.ink === ink);
        item = { w, ink };
        word.textContent = COLOURS[w].name.toUpperCase();
        word.style.color = COLOURS[ink].ink;
        word.classList.remove('cc-in'); void word.offsetWidth; word.classList.add('cc-in');
        mark.className = 'cc-mark';
        state = 'play';
      }

      function begin() {
        overlay.hidden = true;
        answers.classList.remove('cc-off');
        correct = wrong = 0;
        remaining = SECONDS * 1000;
        resume();
        nextItem();
      }

      function resume() {
        last = performance.now();
        clearInterval(tick);
        tick = setInterval(step, 200);
        clock();
      }

      function step() {
        const now = performance.now();
        remaining -= now - last;
        last = now;
        clock();
        if (remaining <= 0) timeUp();
      }

      function answer(i) {
        if (state !== 'play') return;
        const right = i === item.ink;
        state = 'wait';
        if (right) {
          correct++;
          mark.textContent = '✓';
          mark.className = 'cc-mark good';
          note.textContent = '';
          ctx.tone(880, 90, 'sine', 0.08);
        } else {
          wrong++;
          mark.textContent = '✗';
          mark.className = 'cc-mark bad';
          note.textContent = 'That ink was ' + COLOURS[item.ink].name.toLowerCase() + '.';
          ctx.tone(220, 140, 'triangle', 0.08);
        }
        clock();
        nextTimer = setTimeout(() => { nextTimer = null; if (state === 'wait') nextItem(); }, right ? 260 : 700);
      }

      function timeUp() {
        if (state === 'over') return;
        state = 'over';
        clearInterval(tick); tick = null;
        if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
        remaining = 0;
        clock();
        answers.classList.add('cc-off');
        mark.className = 'cc-mark';
        word.style.color = '';
        word.textContent = "Time's up!";
        note.textContent = '';
        ctx.sound('good');
        const slips = wrong === 0 ? 'no slips' : wrong + (wrong === 1 ? ' slip' : ' slips');
        ctx.finish({ score: correct, won: true, display: correct + ' correct, ' + slips, detail: { correct, wrong }, delay: 1500 });
      }

      // Leaving the app: stop the clock; carry on only when she taps.
      const pauseBtn = BT.h('button', { class: 'btn big primary', type: 'button', onclick: () => {
        pauseBox.hidden = true; answers.classList.remove('cc-off'); resume(); nextItem();
      } }, 'Carry on');
      const pauseBox = BT.h('div', { class: 'cc-overlay', hidden: true }, BT.h('p', { class: 'cc-intro' }, 'Paused. The clock has stopped.'), pauseBtn);
      ctx.el.querySelector('.cc-top').append(pauseBox);
      const onVisible = () => {
        if (!document.hidden || (state !== 'play' && state !== 'wait')) return;
        step();
        if (state === 'over') return;
        clearInterval(tick); tick = null;
        if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
        state = 'paused';
        answers.classList.add('cc-off');
        pauseBox.hidden = false;
      };
      const onKey = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
        const i = { r: 0, b: 1, g: 2, y: 3, 1: 0, 2: 1, 3: 2, 4: 3 }[e.key.toLowerCase()];
        if (i != null) { e.preventDefault(); answer(i); }
      };
      document.addEventListener('visibilitychange', onVisible);
      document.addEventListener('keydown', onKey);
      ctx.onExit(() => {
        clearInterval(tick);
        if (nextTimer) clearTimeout(nextTimer);
        document.removeEventListener('visibilitychange', onVisible);
        document.removeEventListener('keydown', onKey);
      });

      clock();
    },
  });

  document.head.append(BT.h('style', null, `
    .cc-wrap { max-width: 760px; margin: 0 auto; }
    .cc-top { position: relative; }
    .cc-stage { position: relative; display: grid; place-items: center; background: var(--panel); border: 2px solid var(--line);
      border-radius: 22px; box-shadow: var(--shadow);
      height: clamp(170px, calc(100vh - 420px), 420px); height: clamp(170px, calc(100svh - 420px), 420px); }
    .cc-word { font-size: clamp(3rem, 13vw, 6rem); font-weight: 900; letter-spacing: 0.04em; line-height: 1; }
    .cc-word.cc-in { animation: cc-in 0.18s ease-out; }
    @keyframes cc-in { from { transform: scale(0.92); opacity: 0.3; } }
    .cc-mark { position: absolute; top: 12px; right: 18px; font-size: 2.6rem; font-weight: 900; opacity: 0; }
    .cc-mark.good { color: var(--good); animation: cc-flash 0.5s ease-out; }
    .cc-mark.bad { color: var(--bad); animation: cc-flash 0.8s ease-out; }
    @keyframes cc-flash { 0% { opacity: 1; transform: scale(1.3); } 70% { opacity: 1; transform: scale(1); } 100% { opacity: 0; } }
    .cc-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 12px; padding: 16px; text-align: center; background: var(--panel); border: 2px solid var(--line); border-radius: 22px; }
    .cc-overlay[hidden] { display: none; }
    .cc-intro { font-size: 1.25rem; font-weight: 600; margin: 0; }
    .cc-start { min-width: 220px; }
    .cc-note { min-height: 1.6em; text-align: center; font-weight: 600; color: var(--muted); margin: 10px 0; }
    .cc-answers { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; transition: opacity 0.2s; }
    .cc-answers.cc-off { opacity: 0.4; pointer-events: none; }
    .cc-btn { display: flex; align-items: center; justify-content: center; gap: 14px; min-height: 76px; padding: 0 12px;
      border: 2px solid var(--line); border-radius: 16px; background: var(--panel); color: var(--ink);
      font: inherit; font-size: 1.35rem; font-weight: 700; cursor: pointer; box-shadow: var(--shadow);
      touch-action: manipulation; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    .cc-btn:active { background: #efe9df; transform: scale(0.98); }
    .cc-btn:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
    @media (min-height: 900px) { .cc-btn { min-height: 92px; font-size: 1.5rem; } }
    .cc-swatch { width: 26px; height: 26px; border-radius: 50%; flex: none; box-shadow: inset 0 0 0 2px rgba(0,0,0,0.15); }
    @media (orientation: landscape) and (min-width: 900px) {
      .cc-answers { grid-template-columns: repeat(4, 1fr); }
      .cc-stage { height: clamp(170px, calc(100vh - 330px), 380px); height: clamp(170px, calc(100svh - 330px), 380px); }
    }
  `));
})();
