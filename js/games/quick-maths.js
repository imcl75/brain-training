/* Quick Maths: as many mental sums as possible in 60 seconds.
 * Questions start with single digits, step up after three right in a row and
 * step down after a miss. Answers are always whole numbers above zero. */
(function () {
  const ROUND_MS = 60000;
  const MAX_LEVEL = 8;

  /* Each level gives a question for an operation: [a, b] with a OP b = answer. */
  function between(rng, lo, hi) { return lo + rng.int(hi - lo + 1); }

  function makeQuestion(rng, level) {
    const ops = level === 1 ? ['+', '−'] : level === 2 ? ['+', '−', '×'] : ['+', '−', '×', '÷'];
    const op = rng.pick(ops);
    let a, b;
    const L = level;
    if (op === '+') {
      const ranges = [null, [1, 9, 1, 9], [2, 20, 1, 9], [10, 89, 2, 9], [10, 59, 10, 39], [12, 89, 12, 89], [100, 899, 11, 99], [100, 499, 100, 499], [150, 899, 120, 899]][L];
      a = between(rng, ranges[0], ranges[1]); b = between(rng, ranges[2], ranges[3]);
      if (rng() < 0.5) [a, b] = [b, a];
      return { text: a + ' + ' + b, answer: a + b };
    }
    if (op === '−') {
      const ranges = [null, [2, 10], [10, 20], [20, 99], [30, 99], [40, 150], [100, 999], [200, 999], [300, 1500]][L];
      a = between(rng, ranges[0], ranges[1]);
      const bMax = L <= 2 ? Math.min(9, a - 1) : L <= 3 ? 9 : L <= 5 ? a - 1 : L === 6 ? Math.min(99, a - 1) : a - 1;
      const bMin = L <= 3 ? 1 : L <= 5 ? 10 : L === 6 ? 11 : 100;
      b = between(rng, Math.min(bMin, bMax), bMax);
      if (a - b < 1) b = a - 1;
      return { text: a + ' − ' + b, answer: a - b };
    }
    if (op === '×') {
      const t = [null, null, [[2, 5, 10], 1, 10], [[2, 3, 4, 5, 10], 1, 10], [[2, 3, 4, 5, 6, 7, 8, 9, 10], 2, 10], [[3, 4, 6, 7, 8, 9, 11, 12], 2, 12]][L];
      if (t) { a = rng.pick(t[0]); b = between(rng, t[1], t[2]); }
      else if (L === 6) { a = between(rng, 11, 19); b = between(rng, 2, 9); }
      else if (L === 7) { a = between(rng, 13, 49); b = between(rng, 3, 9); }
      else { a = between(rng, 11, 19); b = between(rng, 11, 19); }
      if (rng() < 0.5) [a, b] = [b, a];
      return { text: a + ' × ' + b, answer: a * b };
    }
    // division: build it from a multiplication so the answer is whole
    const d = [null, null, null, [[2, 5, 10], 1, 10], [[2, 3, 4, 5, 6, 7, 8, 9, 10], 2, 10], [[3, 4, 6, 7, 8, 9, 11, 12], 2, 12], [[2, 3, 4, 5, 6, 7, 8, 9], 11, 19], [[3, 4, 5, 6, 7, 8, 9], 12, 30], [[4, 6, 7, 8, 9], 21, 99]][L];
    b = rng.pick(d[0]);
    const ans = between(rng, d[1], d[2]);
    return { text: (ans * b) + ' ÷ ' + b, answer: ans };
  }

  const def = {
    id: 'quick-maths',
    name: 'Quick Maths',
    category: 'numbers',
    icon: '➗',
    blurb: 'How many sums can you do in a minute?',
    daily: false,
    better: 'higher',
    howTo: `<p>Answer as many sums as you can in <b>60 seconds</b>.</p>
      <ul>
        <li>Tap the numbers on the keypad. As soon as your answer is right it moves on by itself, so there is no need to press Enter.</li>
        <li>If an answer is wrong, the right one is shown for a moment and then the next sum appears.</li>
        <li><b>Skip</b> moves on if you'd rather not do that one. <b>⌫</b> rubs out the last number you typed.</li>
        <li>The sums start easy. Get three right in a row and they get a little harder; miss one and they get a little easier.</li>
      </ul>
      <p>The clock doesn't start until you tap <b>Start</b>, and it pauses if you leave the game.</p>
      <p>With a keyboard: type the digits, Backspace rubs out, S skips.</p>`,
    makeQuestion,

    start(ctx) {
      // A fresh set of sums every round (ctx.rng is seeded by date for games that are not daily).
      const rng = BT.rng('qm-' + Date.now() + '-' + Math.random());
      let phase = 'ready'; // ready | countdown | play | reveal | paused | over
      let level = 1, maxLevel = 1, streak = 0, correct = 0, wrong = 0, skipped = 0;
      let q = null, typed = '', lastText = '';
      let elapsed = 0, last = 0, pausedFrom = null;
      const timeouts = [];
      const later = (fn, ms) => { const t = setTimeout(fn, ms); timeouts.push(t); return t; };

      const bar = BT.h('div', { class: 'qm-bar-fill' });
      const levelEl = BT.h('span', null, 'Level 1');
      const scoreEl = BT.h('span', null, '✓ 0 right');
      const qText = BT.h('div', { class: 'qm-q', 'aria-live': 'polite' }, '');
      const ansEl = BT.h('div', { class: 'qm-ans', 'aria-live': 'polite' }, '');
      const note = BT.h('div', { class: 'qm-note', 'aria-live': 'polite' }, '');
      const keyBtns = [];
      const key = (label, val, cls, aria) => {
        const b = BT.h('button', { class: 'qm-key' + (cls ? ' ' + cls : ''), type: 'button', 'aria-label': aria || label, onclick: () => press(val) }, label);
        keyBtns.push(b);
        return b;
      };
      const keys = BT.h('div', { class: 'qm-keys' },
        [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => key(String(n), String(n))),
        key('⌫ Delete', 'del', 'qm-fn', 'Delete'), key('0', '0'), key('Skip', 'skip', 'qm-fn'));

      const best = BT.results.best('quick-maths');
      const overlay = BT.h('div', { class: 'qm-overlay' });
      function showReady() {
        overlay.replaceChildren(...[
          BT.h('p', { class: 'qm-intro' }, 'Answer as many sums as you can in one minute.'),
          BT.h('p', { class: 'qm-intro muted' }, 'They start easy and grow with you.'),
          best ? BT.h('p', { class: 'qm-intro muted' }, 'Your best so far: ' + best.display) : null,
          BT.h('button', { class: 'btn big primary qm-start', type: 'button', onclick: countdown }, 'Start')].filter(Boolean));
        overlay.hidden = false;
      }

      const stage = BT.h('div', { class: 'qm-stage' },
        BT.h('div', { class: 'qm-info' }, levelEl, scoreEl),
        BT.h('div', { class: 'qm-bar' }, bar),
        BT.h('div', { class: 'qm-card' }, qText, ansEl, note));
      const wrap = BT.h('div', { class: 'qm-wrap' }, stage, keys, overlay);
      ctx.el.append(wrap);

      function setKeys(on) { keyBtns.forEach(b => { b.disabled = !on; }); }

      function countdown() {
        if (phase !== 'ready') return;
        phase = 'countdown';
        let n = 3;
        const step = () => {
          if (n > 0) {
            overlay.replaceChildren(BT.h('div', { class: 'qm-count' }, String(n)));
            ctx.tone(520, 160);
            n--;
            later(step, 800);
          } else {
            overlay.replaceChildren(BT.h('div', { class: 'qm-count go' }, 'Go!'));
            ctx.tone(780, 260);
            later(begin, 450);
          }
        };
        step();
      }

      function begin() {
        overlay.hidden = true;
        phase = 'play';
        last = performance.now();
        setKeys(true);
        nextQuestion();
        timer = setInterval(tick, 200);
        tick();
      }

      function nextQuestion() {
        let tries = 0;
        do { q = makeQuestion(rng, level); tries++; } while (q.text === lastText && tries < 10);
        lastText = q.text;
        typed = '';
        qText.textContent = q.text + ' =';
        ansEl.textContent = '';
        ansEl.className = 'qm-ans';
        note.textContent = '';
        note.className = 'qm-note';
        levelEl.textContent = 'Level ' + level;
        phase = 'play';
      }

      function paintTyped() { ansEl.textContent = typed; }

      function press(v) {
        if (phase !== 'play') return;
        const target = String(q.answer);
        if (v === 'del') { typed = typed.slice(0, -1); paintTyped(); return; }
        if (v === 'skip') { skipped++; miss(); ctx.sound('tap'); nextQuestion(); return; }
        if (typed === '' && v === '0') return; // answers never start with 0
        typed += v;
        paintTyped();
        if (typed === target) right();
        else if (typed.length >= target.length) oops();
      }

      function right() {
        correct++;
        streak++;
        scoreEl.textContent = '✓ ' + correct + ' right';
        ansEl.className = 'qm-ans good';
        ctx.sound('good');
        let msg = '';
        if (streak >= 3 && level < MAX_LEVEL) { level++; streak = 0; maxLevel = Math.max(maxLevel, level); msg = 'Getting harder!'; }
        phase = 'reveal';
        note.textContent = msg;
        later(() => { if (phase === 'reveal') nextQuestion(); }, 380);
      }

      function miss() { streak = 0; if (level > 1) level--; }

      function oops() {
        wrong++;
        miss();
        ansEl.className = 'qm-ans bad';
        ansEl.replaceChildren(BT.h('s', null, typed));
        note.replaceChildren('Not quite. The answer is ', BT.h('b', null, String(q.answer)));
        note.className = 'qm-note show';
        ctx.tone(260, 200, 'triangle', 0.08);
        phase = 'reveal';
        later(() => { if (phase === 'reveal') nextQuestion(); }, 1400);
      }

      /* timer: only counts while visible and no dialog is open */
      let timer = null;
      function tick() {
        const now = performance.now();
        const dt = Math.min(now - last, 1000);
        last = now;
        if (phase === 'play' || phase === 'reveal') {
          if (!document.querySelector('.dialog-wrap')) elapsed += dt;
        }
        const left = Math.max(0, ROUND_MS - elapsed);
        const secs = Math.ceil(left / 1000);
        ctx.setStatus('⏱ ' + (secs >= 60 ? '1:00' : '0:' + String(secs).padStart(2, '0')));
        bar.style.width = (left / ROUND_MS * 100) + '%';
        bar.classList.toggle('low', left <= 10000);
        if (left <= 0 && phase !== 'over') end();
      }

      function pause() {
        if (phase !== 'play' && phase !== 'reveal') return;
        tick();
        pausedFrom = phase;
        phase = 'paused';
        setKeys(false);
        overlay.replaceChildren(
          BT.h('p', { class: 'qm-intro' }, 'Paused'),
          BT.h('button', { class: 'btn big primary qm-start', type: 'button', onclick: resume }, 'Carry on'));
        overlay.hidden = false;
      }
      function resume() {
        if (phase !== 'paused') return;
        overlay.hidden = true;
        last = performance.now();
        setKeys(true);
        if (pausedFrom === 'reveal') nextQuestion(); else phase = 'play';
      }

      function end() {
        phase = 'over';
        clearInterval(timer);
        setKeys(false);
        ctx.setStatus('⏱ 0:00');
        qText.textContent = 'Time\'s up!';
        ansEl.className = 'qm-ans';
        ansEl.textContent = '';
        note.textContent = '';
        const answered = correct + wrong;
        const pct = answered ? Math.round(correct / answered * 100) : 0;
        ctx.finish({
          score: correct, won: true,
          display: correct + ' correct in 60 seconds' + (answered ? ' (' + pct + '% right)' : ''),
          detail: { correct, wrong, skipped, maxLevel },
          ms: ROUND_MS, delay: 1300,
        });
      }

      const onVis = () => { if (document.hidden) pause(); };
      document.addEventListener('visibilitychange', onVis);

      const onKey = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.dialog-wrap')) return;
        if (phase === 'ready' && (e.key === 'Enter' || e.key === ' ')) countdown();
        else if (phase === 'paused' && (e.key === 'Enter' || e.key === ' ')) resume();
        else if (/^[0-9]$/.test(e.key)) press(e.key);
        else if (e.key === 'Backspace' || e.key === 'Delete') press('del');
        else if (e.key.toLowerCase() === 's') press('skip');
        else return;
        e.preventDefault();
      };
      document.addEventListener('keydown', onKey);

      ctx.onExit(() => {
        clearInterval(timer);
        timeouts.forEach(clearTimeout);
        document.removeEventListener('visibilitychange', onVis);
        document.removeEventListener('keydown', onKey);
      });

      setKeys(false);
      qText.textContent = 'Ready?';
      ctx.setStatus('⏱ 1:00');
      showReady();
    },
  };

  BT.registerGame(def);

  document.head.append(BT.h('style', null, `
    .qm-wrap { position: relative; display: flex; flex-direction: column; align-items: center; gap: 16px; max-width: 520px; margin: 0 auto;
      user-select: none; -webkit-user-select: none; }
    .qm-stage { width: 100%; display: flex; flex-direction: column; gap: 10px; }
    .qm-info { display: flex; justify-content: space-between; font-weight: 700; color: var(--muted); font-size: 1.05rem; }
    .qm-bar { height: 14px; background: #e6e0d5; border-radius: 999px; overflow: hidden; }
    .qm-bar-fill { height: 100%; width: 100%; background: var(--cat); border-radius: 999px; transition: width 0.2s linear, background 0.3s; }
    .qm-bar-fill.low { background: var(--warn); }
    .qm-card { background: var(--panel); border: 2px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow);
      padding: 18px 16px 10px; text-align: center; }
    .qm-q { font-size: clamp(2.2rem, 9vw, 3.4rem); font-weight: 800; line-height: 1.15; font-variant-numeric: tabular-nums; }
    .qm-ans { margin: 12px auto 0; min-height: 1.5em; width: min(100%, 6.5em); font-size: clamp(2.2rem, 9vw, 3.2rem); font-weight: 800; line-height: 1.4;
      border: 3px solid var(--line); border-radius: 14px; background: #faf8f4; color: var(--accent); font-variant-numeric: tabular-nums;
      transition: background 0.15s, border-color 0.15s; }
    .qm-ans.good { background: #dff1e3; border-color: var(--good); color: var(--good); }
    .qm-ans.bad { background: #f8dcd6; border-color: var(--bad); color: var(--bad); animation: qm-shake 0.35s; }
    @keyframes qm-shake { 25%, 75% { transform: translateX(-6px); } 50% { transform: translateX(6px); } }
    .qm-note { min-height: 1.6em; margin-top: 8px; font-weight: 600; color: var(--muted); font-size: 1.15rem; }
    .qm-note.show { color: var(--ink); }
    .qm-note b { color: var(--good); font-size: 1.35em; }
    .qm-ans s { text-decoration-thickness: 3px; }
    .qm-keys { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .qm-key { min-height: 72px; border: 0; border-radius: 14px; background: #dcd6cb; color: var(--ink); font: inherit; font-size: 1.9rem; font-weight: 700;
      cursor: pointer; touch-action: manipulation; }
    .qm-key:active { filter: brightness(0.9); transform: scale(0.97); }
    .qm-key.qm-fn { font-size: 1.2rem; background: #ece7de; border: 2px solid var(--line); }
    .qm-key:disabled { opacity: 0.5; cursor: default; }
    .qm-overlay { position: absolute; inset: -6px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
      background: rgba(247, 243, 236, 0.94); border-radius: var(--radius); text-align: center; padding: 16px; z-index: 2; }
    .qm-overlay[hidden] { display: none; }
    .qm-intro { font-size: 1.2rem; font-weight: 600; margin: 0 0 4px; }
    .qm-start { min-width: 220px; margin-top: 14px; font-size: 1.4rem; min-height: 76px; }
    .qm-count { font-size: 6rem; font-weight: 800; color: var(--cat); line-height: 1; animation: qm-pop 0.5s ease-out; }
    .qm-count.go { color: var(--good); }
    @keyframes qm-pop { from { transform: scale(0.6); opacity: 0.3; } to { transform: scale(1); opacity: 1; } }
    @media (min-width: 700px) {
      .qm-wrap { max-width: 560px; }
      .qm-key { min-height: 84px; font-size: 2.1rem; }
    }
    @media (min-width: 900px) and (orientation: landscape) {
      .qm-wrap { flex-direction: row; align-items: stretch; max-width: 940px; gap: 28px; }
      .qm-stage { flex: 1.2; justify-content: center; }
      .qm-keys { flex: 1; max-width: 400px; align-content: center; }
      .qm-key { min-height: clamp(84px, 13vh, 120px); }
      .qm-card { padding: 28px 16px 14px; }
    }
    @media (max-width: 480px) {
      .qm-key.qm-fn { font-size: 1rem; }
    }
  `));
})();
