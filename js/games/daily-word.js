/* Daily Word: guess the five-letter word in six tries.
 * This is the reference game: copy its shape when adding a new one. */
(function () {
  const ROWS = 6, LEN = 5;
  const KEYS = ['qwertyuiop', 'asdfghjkl', '+zxcvbnm-'];

  function answerFor(ctx, answers) {
    if (ctx.practice) return ctx.rng.pick(answers);
    // A fixed shuffle so the daily words never repeat until the list runs out.
    const order = BT.rng('daily-word-order').shuffle(answers);
    return order[BT.dayNumber(ctx.date) % order.length];
  }

  function score(guess, answer) {
    const res = Array(LEN).fill('absent'), left = {};
    for (let i = 0; i < LEN; i++) {
      if (guess[i] === answer[i]) res[i] = 'correct';
      else left[answer[i]] = (left[answer[i]] || 0) + 1;
    }
    for (let i = 0; i < LEN; i++) {
      if (res[i] !== 'correct' && left[guess[i]]) { res[i] = 'present'; left[guess[i]]--; }
    }
    return res;
  }

  BT.registerGame({
    id: 'daily-word',
    name: 'Daily Word',
    category: 'words',
    icon: '🟩',
    blurb: 'Guess the five-letter word in six tries',
    daily: true,
    better: 'lower',
    scripts: ['js/data/words5.js'],
    settings: [{ key: 'checkWords', label: 'Only accept real words', default: true }],
    howTo: `<p>Guess the hidden five-letter word. You have six tries.</p>
      <p>After each guess the tiles change colour:</p>
      <ul><li><b style="color:#3a8a4f">Green</b>: right letter, right place.</li>
      <li><b style="color:#c98a12">Gold</b>: the letter is in the word, but somewhere else.</li>
      <li><b style="color:#6b7280">Grey</b>: the letter is not in the word.</li></ul>
      <p>There is a new word every day.</p>`,

    start(ctx) {
      const data = BT.data.words5;
      const answers = data.answers.split(' ');
      const allowed = new Set(data.guesses.split(' ').concat(answers));
      const answer = answerFor(ctx, answers);
      const saved = ctx.load();
      const guesses = saved && saved.answer === answer ? saved.guesses : [];
      let current = '';
      let over = false;

      const board = BT.h('div', { class: 'dw-board' });
      const message = BT.h('div', { class: 'message', 'aria-live': 'polite' });
      const keyEls = {};
      const keyboard = BT.h('div', { class: 'keyboard' }, KEYS.map(row => BT.h('div', { class: 'row' }, [...row].map(k => {
        const label = k === '+' ? 'Enter' : k === '-' ? '⌫ Delete' : k;
        const b = BT.h('button', { class: 'key' + (k === '+' || k === '-' ? ' wide' : ''), onclick: () => press(k) }, label);
        if (k !== '+' && k !== '-') keyEls[k] = b;
        return b;
      }))));
      ctx.el.append(board, message, keyboard);

      for (let r = 0; r < ROWS; r++) {
        board.append(BT.h('div', { class: 'dw-row' }, Array.from({ length: LEN }, () => BT.h('div', { class: 'dw-tile' }))));
      }

      function paintRow(r, word, marks) {
        const tiles = board.children[r].children;
        for (let i = 0; i < LEN; i++) {
          tiles[i].textContent = word[i] || '';
          tiles[i].className = 'dw-tile' + (word[i] ? ' filled' : '') + (marks ? ' ' + marks[i] : '');
        }
      }
      function paintKeys() {
        const rank = { absent: 1, present: 2, correct: 3 }, best = {};
        guesses.forEach(g => score(g, answer).forEach((m, i) => {
          if (!best[g[i]] || rank[m] > rank[best[g[i]]]) best[g[i]] = m;
        }));
        for (const [k, el] of Object.entries(keyEls)) el.className = 'key' + (best[k] ? ' ' + best[k] : '');
      }
      function paint() {
        guesses.forEach((g, r) => paintRow(r, g, score(g, answer)));
        if (guesses.length < ROWS) paintRow(guesses.length, current);
        paintKeys();
        ctx.setStatus(Math.min(guesses.length + 1, ROWS) + ' / ' + ROWS);
      }

      function shake() {
        const row = board.children[guesses.length];
        row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake');
      }

      function submit() {
        if (current.length < LEN) { message.textContent = 'Not enough letters'; shake(); return; }
        if (ctx.setting('checkWords') && !allowed.has(current)) { message.textContent = 'Not in the word list'; shake(); ctx.sound('bad'); return; }
        guesses.push(current);
        current = '';
        message.textContent = '';
        ctx.save({ answer, guesses });
        paint();
        const last = guesses[guesses.length - 1];
        if (last === answer) {
          over = true;
          ctx.sound('good');
          const n = guesses.length;
          ctx.finish({ score: n, won: true, display: 'Solved in ' + n + (n === 1 ? ' guess' : ' guesses'), detail: { answer, guesses }, delay: 1400 });
        } else if (guesses.length === ROWS) {
          over = true;
          message.textContent = 'The word was ' + answer.toUpperCase();
          ctx.finish({ score: ROWS + 1, won: false, display: 'The word was ' + answer.toUpperCase(), detail: { answer, guesses }, delay: 2600 });
        }
      }

      function press(k) {
        if (over) return;
        if (k === '+') submit();
        else if (k === '-') { current = current.slice(0, -1); message.textContent = ''; }
        else if (current.length < LEN) current += k;
        paint();
      }

      const onKey = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'Enter') press('+');
        else if (e.key === 'Backspace') press('-');
        else if (/^[a-z]$/i.test(e.key)) press(e.key.toLowerCase());
        else return;
        e.preventDefault();
      };
      document.addEventListener('keydown', onKey);
      ctx.onExit(() => document.removeEventListener('keydown', onKey));
      paint();
    },
  });

  document.head.append(BT.h('style', null, `
    .dw-board { display: grid; gap: 7px; justify-content: center; margin: 4px auto 0; }
    .dw-row { display: grid; grid-template-columns: repeat(5, min(15vw, 64px)); gap: 7px; }
    .dw-row.shake { animation: dw-shake 0.4s; }
    @keyframes dw-shake { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
    .dw-tile { aspect-ratio: 1; display: grid; place-items: center; border: 3px solid var(--line); border-radius: 8px; background: var(--panel);
      font-size: min(8vw, 2rem); font-weight: 800; text-transform: uppercase; }
    .dw-tile.filled { border-color: #8d8576; }
    .dw-tile.correct, .key.correct { background: var(--good); border-color: var(--good); color: #fff; }
    .dw-tile.present, .key.present { background: var(--warn); border-color: var(--warn); color: #fff; }
    .dw-tile.absent, .key.absent { background: #6b7280; border-color: #6b7280; color: #fff; }
  `));
})();
