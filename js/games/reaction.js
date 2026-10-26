/* Reaction Time: wait for the panel to turn green, then tap it as quickly as you can.
 * Five rounds. Score = average time in milliseconds; lower is better. */
(function () {
  const ROUNDS = 5;

  BT.registerGame({
    id: 'reaction',
    name: 'Reaction Time',
    category: 'speed',
    icon: '⚡',
    blurb: 'Tap as soon as the panel turns green',
    daily: false,
    better: 'lower',
    howTo: `<p>Tap the big panel to begin. It will say <b>Wait…</b></p>
      <p>After a moment it turns <b style="color:#2e8b47">green</b> and says <b>Tap!</b>
      Tap it as soon as you can. Your time is shown in milliseconds (thousandths of a second).</p>
      <p>If you tap before it turns green, that round simply starts again.</p>
      <p>There are ${ROUNDS} rounds, and your score is the average time.</p>`,

    start(ctx) {
      const times = [];
      let state = 'ready'; // ready | wait | go | early | shown | over
      let timer = null, goAt = null, readyAt = 0;

      const big = BT.h('div', { class: 'rt-big' });
      const small = BT.h('div', { class: 'rt-small' });
      const panel = BT.h('div', { class: 'rt-panel', role: 'button', tabindex: '0', 'aria-live': 'assertive' }, big, small);
      const slots = Array.from({ length: ROUNDS }, (_, i) => BT.h('div', { class: 'rt-slot' },
        BT.h('span', { class: 'rt-slot-n' }, 'Round ' + (i + 1)), BT.h('span', { class: 'rt-slot-t' }, '–')));
      ctx.el.append(panel, BT.h('div', { class: 'rt-slots' }, slots));

      function show(cls, a, b) {
        panel.className = 'rt-panel ' + cls;
        big.textContent = a;
        small.textContent = b || '';
      }
      function paintSlots() {
        slots.forEach((s, i) => {
          s.classList.toggle('done', i < times.length);
          s.classList.toggle('now', i === times.length && state !== 'over');
          s.lastChild.textContent = i < times.length ? times[i] + ' ms' : '–';
        });
        ctx.setStatus('Round ' + Math.min(times.length + 1, ROUNDS) + ' of ' + ROUNDS);
      }

      function ready(note) {
        state = 'ready';
        readyAt = performance.now();
        const n = times.length + 1;
        show('rt-ready', times.length ? 'Round ' + n : 'Start', note || (times.length ? 'Tap here when you are ready' : 'Tap here when you are ready to begin'));
        paintSlots();
      }

      function wait() {
        state = 'wait';
        goAt = null;
        show('rt-wait', 'Wait…', 'Tap when it turns green');
        const delay = 1500 + Math.random() * 2500;
        timer = setTimeout(go, delay);
      }

      function go() {
        timer = null;
        state = 'go';
        show('rt-go', 'Tap!', '');
        // Start the clock now, then move it to the moment the green is actually painted.
        const shownAt = goAt = performance.now();
        requestAnimationFrame(() => { if (state === 'go' && goAt === shownAt) goAt = performance.now(); });
      }

      function tooSoon() {
        if (timer) { clearTimeout(timer); timer = null; }
        state = 'early';
        readyAt = performance.now();
        ctx.sound('bad');
        show('rt-early', 'Too soon!', 'Wait for the green. Tap to try that round again.');
      }

      function record(t) {
        const ms = Math.round(t - goAt);
        if (ms < 100) { tooSoon(); return; } // faster than anyone can react: a guess
        times.push(ms);
        ctx.tone(880, 90);
        state = 'shown';
        readyAt = performance.now();
        paintSlots();
        if (times.length === ROUNDS) {
          state = 'over';
          paintSlots();
          const avg = Math.round(times.reduce((a, b) => a + b, 0) / ROUNDS);
          show('rt-shown', ms + ' ms', 'All done! Your average was ' + avg + ' ms');
          ctx.finish({ score: avg, won: true, display: 'Average ' + avg + ' ms over ' + ROUNDS + ' taps', detail: { times: times.slice() }, delay: 1800 });
        } else {
          show('rt-shown', ms + ' ms', 'Tap for round ' + (times.length + 1));
        }
      }

      function tap(t) {
        const settled = t - readyAt > 450; // ignore a quick double tap on a message
        if (state === 'ready' || state === 'shown' || state === 'early') { if (settled) wait(); }
        else if (state === 'wait') tooSoon();
        else if (state === 'go') record(t);
      }

      const stamp = (e) => (e && e.timeStamp && Math.abs(performance.now() - e.timeStamp) < 1000 ? e.timeStamp : performance.now());
      panel.addEventListener('pointerdown', (e) => {
        if (e.isPrimary === false || (e.button && e.button !== 0)) return;
        e.preventDefault();
        tap(stamp(e));
      });
      const onKey = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        tap(performance.now());
      };
      // Leaving the app mid-round: cancel that round and start it again on return.
      const onVisible = () => {
        if (!document.hidden) return;
        if (state === 'wait' || state === 'go') {
          if (timer) { clearTimeout(timer); timer = null; }
          ready('Paused. Tap here to carry on.');
        }
      };
      document.addEventListener('keydown', onKey);
      document.addEventListener('visibilitychange', onVisible);
      ctx.onExit(() => {
        if (timer) clearTimeout(timer);
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisible);
      });

      readyAt = -1000;
      ready();
    },
  });

  document.head.append(BT.h('style', null, `
    .rt-panel { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
      height: clamp(240px, calc(100vh - 290px), 560px); height: clamp(240px, calc(100svh - 290px), 560px);
      border-radius: 26px; padding: 20px; cursor: pointer; color: #fff; box-shadow: var(--shadow);
      touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
      transition: background-color 0.15s; }
    .rt-panel.rt-go { transition: none; }
    .rt-panel:focus-visible { outline: 3px solid var(--ink); outline-offset: 3px; }
    .rt-big { font-size: clamp(2.6rem, 9vw, 5rem); font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .rt-small { font-size: 1.2rem; font-weight: 600; margin-top: 10px; opacity: 0.95; }
    .rt-ready { background: var(--panel); color: var(--ink); border: 3px solid var(--cat); }
    .rt-ready .rt-big { color: var(--cat); }
    .rt-wait { background: #46637f; }
    .rt-go { background: #2e8b47; }
    .rt-early { background: #a5642a; }
    .rt-shown { background: var(--panel); color: var(--ink); border: 3px solid var(--line); }
    .rt-slots { display: grid; grid-template-columns: repeat(${ROUNDS}, 1fr); gap: 8px; margin-top: 14px; }
    .rt-slot { display: flex; flex-direction: column; align-items: center; padding: 8px 4px; border-radius: 12px;
      background: var(--panel); border: 2px solid var(--line); min-width: 0; }
    .rt-slot-n { font-size: 0.85rem; color: var(--muted); white-space: nowrap; }
    .rt-slot-t { font-weight: 800; font-size: 1.1rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .rt-slot.now { border-color: var(--cat); }
    .rt-slot.done { background: #fdf3ea; }
    @media (max-width: 480px) { .rt-slot-n { font-size: 0.75rem; } .rt-slot-t { font-size: 0.95rem; } }
  `));
})();
