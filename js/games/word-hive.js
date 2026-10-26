/* Word Hive: make words from seven letters in a honeycomb. Every word must use
 * the centre letter; letters can be used more than once. The puzzle is made at
 * run time from the word list (js/data/beewords.js), seeded by the date. */
(function () {
  const A = 97;
  const MIN_WORDS = 20, MAX_WORDS = 55, MIN_POINTS = 70, MAX_POINTS = 260;
  const RANKS = [
    ['Starting out', 0], ['Warming up', 0.02], ['Getting going', 0.05], ['Good', 0.09],
    ['Solid', 0.16], ['Nice', 0.26], ['Great', 0.4], ['Amazing', 0.55], ['Top bee', 0.72],
  ];


  const maskOf = (w) => { let m = 0; for (let i = 0; i < w.length; i++) m |= 1 << (w.charCodeAt(i) - A); return m; };
  const bitCount = (m) => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
  const lettersOf = (m) => { const out = []; for (let i = 0; i < 26; i++) if (m & (1 << i)) out.push(String.fromCharCode(A + i)); return out; };
  const S_BIT = 1 << 18;

  // Built once: words grouped by their set of letters, and the 7-letter sets.
  let INDEX = null;
  function index() {
    if (INDEX) return INDEX;
    const byMask = new Map(), seen = new Set(), pangrams = [];
    for (const w of BT.data.beewords.split(' ')) {
      if (w.length < 4) continue;
      const m = maskOf(w);
      if (m & S_BIT) continue;
      let list = byMask.get(m);
      if (!list) byMask.set(m, list = []);
      list.push(w);
      if (!seen.has(m) && bitCount(m) === 7) { seen.add(m); pangrams.push(m); }
    }
    return (INDEX = { byMask, pangrams });
  }

  function answersFor(mask, centre) {
    const { byMask } = index();
    const cb = 1 << (centre.charCodeAt(0) - A), rest = mask & ~cb, out = [];
    for (let s = rest; ; s = (s - 1) & rest) {     // every subset of the outer letters
      const list = byMask.get(s | cb);
      if (list) out.push(...list);
      if (s === 0) break;
    }
    return out.sort();
  }

  const isFullHouse = (w) => bitCount(maskOf(w)) === 7;
  const pointsFor = (w) => (w.length === 4 ? 1 : w.length) + (isFullHouse(w) ? 7 : 0);
  const sum = (words) => words.reduce((t, w) => t + pointsFor(w), 0);

  /* Pick a 7-letter set and a centre that give a fair puzzle. */
  function makePuzzle(rng) {
    const { pangrams } = index();
    let best = null;
    for (let tries = 0; tries < 3000; tries++) {
      const mask = pangrams[rng.int(pangrams.length)];
      const letters = lettersOf(mask);
      const centre = letters[rng.int(7)];
      const answers = answersFor(mask, centre);
      const points = sum(answers);
      const p = { centre, outer: rng.shuffle(letters.filter(l => l !== centre)), answers, points, tries: tries + 1 };
      if (answers.length >= MIN_WORDS && answers.length <= MAX_WORDS && points >= MIN_POINTS && points <= MAX_POINTS) return p;
      if (!best || Math.abs(answers.length - 35) < Math.abs(best.answers.length - 35)) best = p;
    }
    return best;
  }

  function rankFor(points, total) {
    let r = 0;
    RANKS.forEach(([, f], i) => { if (points >= Math.round(f * total)) r = i; });
    return r;
  }

  /* SVG honeycomb: flat-topped hexagons, centre first then the six around it. */
  const R = 50, D = 1.8 * R;
  const HEX = Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 3 * i;
    return (R * Math.cos(a)).toFixed(1) + ',' + (R * Math.sin(a)).toFixed(1);
  }).join(' ');
  const SPOTS = [[0, 0]].concat([270, 330, 30, 90, 150, 210].map(d => {
    const a = d * Math.PI / 180;
    return [D * Math.cos(a), D * Math.sin(a)];
  }));

  const def = {
    id: 'word-hive',
    name: 'Word Hive',
    category: 'words',
    icon: '🐝',
    blurb: 'Make words from seven letters',
    daily: true,
    better: 'higher',
    scripts: ['js/data/beewords.js'],
    howTo: `<p>Make as many words as you can from the seven letters in the hive.</p>
      <ul><li>Words must have at least <b>four letters</b>.</li>
      <li>Every word must use the <b>centre letter</b>.</li>
      <li>Letters can be used more than once.</li>
      <li>No names, and no words with hyphens.</li></ul>
      <p>Tap the letters (or type them), then tap <b>Enter</b>.</p>
      <p><b>Points:</b> a four-letter word scores 1. Longer words score one point per letter.
      A <b>full house</b> uses all seven letters and scores 7 extra.</p>
      <p>Climb the ranks as your points grow. Come back to the same hive as often as you like
      today, and tap <b>Finish for today</b> when you have had enough. You will see the words you missed.</p>`,

    start(ctx) {
      const saved = ctx.load();
      let centre, outer, answers;
      if (saved && saved.centre && saved.outer) {
        centre = saved.centre; outer = saved.outer.slice();
        answers = answersFor(maskOf(centre + outer.join('')), centre);
      } else {
        const p = makePuzzle(ctx.rng);
        centre = p.centre; outer = p.outer; answers = p.answers;
      }
      const letterSet = new Set([centre].concat(outer));
      const answerSet = new Set(answers);
      const total = sum(answers);
      const found = saved && saved.found ? saved.found.filter(w => answerSet.has(w)) : [];
      let points = sum(found);
      let word = '';
      let over = false, msgTimer = null;
      const timers = [];

      // ---- elements
      const rankName = BT.h('div', { class: 'wh-rank-name' });
      const rankPts = BT.h('div', { class: 'wh-rank-pts' });
      const barFill = BT.h('div', { class: 'wh-bar-fill' });
      const barMarks = BT.h('div', { class: 'wh-bar-marks' }, RANKS.map(() => BT.h('span', { class: 'wh-mark' })));
      const progress = BT.h('button', { class: 'wh-progress', 'aria-label': 'Show the ranks', onclick: showRanks },
        BT.h('div', { class: 'wh-rank-row' }, rankName, rankPts),
        BT.h('div', { class: 'wh-bar' }, barFill, barMarks));

      const wordEl = BT.h('div', { class: 'wh-word', 'aria-live': 'polite' });
      const msgEl = BT.h('div', { class: 'wh-msg', role: 'status' });
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '-133 -138 266 276');
      svg.setAttribute('class', 'wh-hive');
      svg.setAttribute('role', 'group');
      svg.setAttribute('aria-label', 'Letters');
      const cells = SPOTS.map(([x, y], i) => {
        const g = document.createElementNS(svgNS, 'g');
        g.setAttribute('class', 'wh-cell' + (i === 0 ? ' centre' : ''));
        g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        g.setAttribute('role', 'button');
        const poly = document.createElementNS(svgNS, 'polygon');
        poly.setAttribute('points', HEX);
        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('y', '2');
        g.append(poly, text);
        g.addEventListener('click', () => { const l = g.dataset.letter; if (l) { ctx.sound('tap'); type(l); } });
        svg.append(g);
        return g;
      });
      const hiveWrap = BT.h('div', { class: 'wh-hive-wrap' }, svg, msgEl);

      const buttons = BT.h('div', { class: 'game-buttons wh-buttons' },
        BT.h('button', { class: 'btn', onclick: del }, '⌫ Delete'),
        BT.h('button', { class: 'btn wh-round', 'aria-label': 'Shuffle the letters', onclick: shuffle }, '🔀'),
        BT.h('button', { class: 'btn primary', onclick: enter }, 'Enter'));

      const foundCount = BT.h('span');
      const foundList = BT.h('ul', { class: 'wh-list' });
      const foundBox = BT.h('div', { class: 'wh-found' },
        BT.h('button', { class: 'wh-found-head', 'aria-expanded': 'false', onclick: toggleList }, foundCount, BT.h('span', { class: 'wh-caret', 'aria-hidden': 'true' }, '▾')),
        foundList);
      const finishBtn = BT.h('button', { class: 'btn wh-finish', onclick: askFinish }, 'Finish for today');

      ctx.el.append(BT.h('div', { class: 'wh-wrap' }, progress,
        BT.h('div', { class: 'wh-main' }, wordEl, hiveWrap, buttons), foundBox, finishBtn));

      // ---- drawing
      function paintHive() {
        [centre].concat(outer).forEach((l, i) => {
          cells[i].dataset.letter = l;
          cells[i].setAttribute('aria-label', 'Letter ' + l.toUpperCase() + (i === 0 ? ', centre' : ''));
          cells[i].querySelector('text').textContent = l.toUpperCase();
        });
      }
      function paintWord() {
        wordEl.replaceChildren(...[...word].map(l => BT.h('span', { class: l === centre ? 'c' : letterSet.has(l) ? '' : 'x' }, l.toUpperCase())),
          BT.h('span', { class: 'wh-caret-line', 'aria-hidden': 'true' }));
      }
      function paintProgress() {
        const r = rankFor(points, total);
        rankName.textContent = RANKS[r][0];
        rankPts.textContent = points + (points === 1 ? ' point' : ' points');
        const top = Math.round(RANKS[RANKS.length - 1][1] * total) || 1;
        barFill.style.width = Math.min(100, points / top * 100) + '%';
        [...barMarks.children].forEach((m, i) => {
          m.style.left = (Math.round(RANKS[i][1] * total) / top * 100) + '%';
          m.classList.toggle('done', i <= r);
        });
        ctx.setStatus(points + (points === 1 ? ' point' : ' points'));
      }
      function paintList() {
        const n = found.length;
        foundCount.textContent = n ? 'You have found ' + n + (n === 1 ? ' word' : ' words') : 'Your words will appear here';
        foundList.replaceChildren(...found.slice().sort().map(w =>
          BT.h('li', { class: isFullHouse(w) ? 'full' : '' }, w.toUpperCase())));
      }
      function toggleList() {
        const open = foundBox.classList.toggle('open');
        foundBox.querySelector('.wh-found-head').setAttribute('aria-expanded', String(open));
      }

      function say(text, kind, ms) {
        clearTimeout(msgTimer);
        msgEl.textContent = text;
        msgEl.className = 'wh-msg show ' + (kind || '');
        msgTimer = setTimeout(() => { msgEl.className = 'wh-msg'; }, ms || 1500);
      }
      function shakeWord() {
        wordEl.classList.remove('shake'); void wordEl.offsetWidth; wordEl.classList.add('shake');
      }

      // ---- actions
      function type(l) {
        if (over || word.length >= 19) return;
        word += l;
        paintWord();
      }
      function del() {
        if (over) return;
        word = word.slice(0, -1);
        paintWord();
      }
      function shuffle() {
        if (over) return;
        outer = BT.rng(Date.now()).shuffle(outer);
        svg.classList.remove('spin'); void svg.getBoundingClientRect(); svg.classList.add('spin');
        paintHive();
        save();
      }
      function reject(text) {
        say(text, 'bad');
        shakeWord();
        ctx.sound('bad');
        timers.push(setTimeout(() => { word = ''; paintWord(); }, 500));
      }
      function enter() {
        if (over || !word) return;
        const w = word;
        if (w.length < 4) return reject('Too short');
        if (!w.includes(centre)) return reject('Must use the centre letter');
        if ([...w].some(l => !letterSet.has(l))) return reject('Only the letters in the hive');
        if (found.includes(w)) return reject('Already found');
        if (!answerSet.has(w)) return reject('Not in the word list');
        const before = rankFor(points, total);
        const gain = pointsFor(w);
        found.push(w);
        points += gain;
        word = '';
        save();
        paintWord(); paintList(); paintProgress();
        const plus = ' +' + gain;
        if (isFullHouse(w)) {
          say('Full house!' + plus, 'full', 2400);
          ctx.sound('win');
          svg.classList.remove('party'); void svg.getBoundingClientRect(); svg.classList.add('party');
        } else {
          say((w.length === 4 ? 'Good!' : w.length <= 6 ? 'Lovely!' : 'Brilliant!') + plus, 'good');
          ctx.sound('good');
        }
        const after = rankFor(points, total);
        if (found.length === answers.length) {
          say('You found every word!' + plus, 'full', 3000);
          finish(2600);
        } else if (after === RANKS.length - 1) {
          say('Top bee! Wonderful!' + plus, 'full', 3000);
          finish(2600);
        } else if (after > before) {
          timers.push(setTimeout(() => say('You have reached ' + RANKS[after][0] + '!', 'good', 1800), 1200));
        }
      }

      function save() { ctx.save({ centre, outer, found }); }

      function showRanks() {
        const r = rankFor(points, total);
        const rows = RANKS.slice().reverse().map(([name, f], i) => {
          const idx = RANKS.length - 1 - i;
          return BT.h('tr', { class: idx === r ? 'wh-now' : '' }, BT.h('td', null, name), BT.h('td', null, String(Math.round(f * total))));
        });
        BT.dialog('Ranks', BT.h('div', null,
          BT.h('p', null, 'Points needed for each rank in today’s hive (' + answers.length + ' words to find):'),
          BT.h('table', { class: 'wh-ranks' }, BT.h('tbody', null, rows))));
      }

      function askFinish() {
        if (over) return;
        BT.confirm('Finish for today?', '<p>Your points will be saved, and you will see the words you missed.</p><p>You can only finish today’s hive once.</p>', 'Finish')
          .then(yes => { if (yes) finish(300); });
      }

      function missedBox() {
        const missed = answers.filter(w => !found.includes(w));
        if (!missed.length) return BT.h('p', { class: 'wh-allfound' }, 'You found every word in the hive!');
        return BT.h('div', { class: 'wh-missed' },
          BT.h('h3', null, 'Words you missed (' + missed.length + ')'),
          BT.h('ul', { class: 'wh-list' }, missed.map(w => BT.h('li', { class: isFullHouse(w) ? 'full' : '' }, w.toUpperCase()))),
          missed.some(isFullHouse) ? BT.h('p', { class: 'muted' }, 'Full house words are shown in gold.') : null);
      }

      function finish(delay) {
        if (over) return;
        over = true;
        const rank = RANKS[rankFor(points, total)][0];
        const n = found.length;
        ctx.finish({
          score: points, won: true,
          display: 'Reached ' + rank + ' with ' + points + (points === 1 ? ' point' : ' points') + ' (' + n + (n === 1 ? ' word' : ' words') + ')',
          detail: { words: n, rank, total, possibleWords: answers.length, letters: centre + outer.join('') },
          extra: missedBox(), delay,
        });
      }

      const onKey = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('.dialog-wrap')) return;
        if (e.key === 'Enter') enter();
        else if (e.key === 'Backspace') del();
        else if (e.key === ' ') shuffle();
        else if (/^[a-z]$/i.test(e.key)) { if (letterSet.has(e.key.toLowerCase())) type(e.key.toLowerCase()); }
        else return;
        e.preventDefault();
      };
      document.addEventListener('keydown', onKey);
      ctx.onExit(() => {
        document.removeEventListener('keydown', onKey);
        clearTimeout(msgTimer);
        timers.forEach(clearTimeout);
      });

      if (!saved) save();
      paintHive(); paintWord(); paintList(); paintProgress();
    },
  };
  // For testing in node: the puzzle maker and helpers.
  def.makePuzzle = makePuzzle;
  def.answersFor = answersFor;
  def.pointsFor = pointsFor;
  BT.registerGame(def);

  if (typeof document === 'undefined') return;
  document.head.append(BT.h('style', null, `
    .wh-wrap { display: grid; gap: 14px; max-width: 980px; margin: 0 auto; grid-template-columns: minmax(0, 1fr);
      grid-template-areas: "prog" "main" "found" "fin"; }
    .wh-main { grid-area: main; display: flex; flex-direction: column; align-items: center; min-width: 0; }
    .wh-found { grid-area: found; }
    .wh-progress { grid-area: prog; display: block; width: 100%; text-align: left; font: inherit; color: var(--ink);
      background: var(--panel); border: 2px solid var(--line); border-radius: 14px; padding: 10px 14px 14px; cursor: pointer; }
    .wh-rank-row { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
    .wh-rank-name { font-weight: 800; font-size: 1.15rem; }
    .wh-rank-pts { color: var(--muted); font-weight: 700; font-variant-numeric: tabular-nums; }
    .wh-bar { position: relative; height: 10px; margin: 12px 6px 0; background: #e6dfd0; border-radius: 6px; }
    .wh-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; background: #e2b33c; border-radius: 6px; transition: width 0.5s; }
    .wh-bar-marks { position: absolute; inset: 0; }
    .wh-mark { position: absolute; top: 50%; width: 12px; height: 12px; margin: -6px 0 0 -6px; border-radius: 50%; background: #d4cbb8; }
    .wh-mark.done { background: #c48f12; }
    .wh-word { min-height: 3.2rem; font-size: 2rem; font-weight: 800; letter-spacing: 0.06em; text-align: center;
      display: flex; align-items: center; justify-content: center; flex-wrap: wrap; margin-top: 4px; max-width: 100%; }
    .wh-word .c { color: #c48f12; }
    .wh-word .x { color: #b9b2a4; }
    .wh-word.shake { animation: wh-shake 0.4s; }
    @keyframes wh-shake { 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
    .wh-caret-line { display: inline-block; width: 3px; height: 2.1rem; margin-left: 3px; background: #c48f12; animation: wh-blink 1.1s steps(1) infinite; }
    @keyframes wh-blink { 50% { opacity: 0; } }
    .wh-hive-wrap { position: relative; width: min(84vw, 420px, 44vh); min-width: 260px; }
    .wh-hive { display: block; width: 100%; height: auto; overflow: visible; user-select: none; -webkit-user-select: none; touch-action: manipulation; }
    .wh-cell { cursor: pointer; }
    .wh-cell polygon { fill: #e9e3d6; stroke: var(--bg); stroke-width: 3; transition: fill 0.1s; }
    .wh-cell.centre polygon { fill: #f0c24b; }
    .wh-cell text { font-size: 40px; font-weight: 800; fill: var(--ink); pointer-events: none; font-family: inherit; }
    .wh-cell:active polygon { fill: #d8d0bf; }
    .wh-cell.centre:active polygon { fill: #dcae33; }
    .wh-hive.spin .wh-cell:not(.centre) text { animation: wh-fade 0.35s; }
    @keyframes wh-fade { from { opacity: 0; } to { opacity: 1; } }
    .wh-hive.party .wh-cell polygon { animation: wh-party 1.2s; }
    @keyframes wh-party { 30% { fill: #f6d77a; } 60% { fill: #f0c24b; } }
    .wh-msg { position: absolute; left: 50%; top: -6px; transform: translate(-50%, -6px); opacity: 0; pointer-events: none;
      background: var(--ink); color: #fff; font-weight: 700; padding: 8px 16px; border-radius: 10px; white-space: nowrap; transition: opacity 0.2s, transform 0.2s; z-index: 2; }
    .wh-msg.show { opacity: 1; transform: translate(-50%, 0); }
    .wh-msg.good { background: var(--good); }
    .wh-msg.full { background: #c48f12; font-size: 1.15rem; }
    .wh-buttons { margin-top: 10px; }
    .wh-buttons .btn { min-width: 112px; white-space: nowrap; }
    .wh-buttons .wh-round { min-width: 64px; width: 64px; border-radius: 50%; font-size: 1.3rem; padding: 0; height: 64px; }
    .wh-found { background: var(--panel); border: 2px solid var(--line); border-radius: 14px; overflow: hidden; }
    .wh-found-head { display: flex; justify-content: space-between; align-items: center; width: 100%; min-height: 52px;
      padding: 8px 14px; background: none; border: 0; font: inherit; font-weight: 700; color: var(--ink); text-align: left; cursor: pointer; }
    .wh-caret { transition: transform 0.2s; }
    .wh-found.open .wh-caret { transform: rotate(180deg); }
    .wh-found .wh-list { display: none; padding: 0 14px 14px; }
    .wh-found.open .wh-list { display: flex; }
    .wh-list { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 16px; }
    .wh-list li { font-weight: 600; letter-spacing: 0.03em; }
    .wh-list li.full { font-weight: 800; color: #9a6d00; }
    .wh-finish { grid-area: fin; justify-self: center; }
    .wh-missed { max-width: 640px; margin: 20px auto 0; text-align: left; background: var(--panel); border: 2px solid var(--line); border-radius: 14px; padding: 14px 18px; }
    .wh-missed h3 { margin: 0 0 10px; font-size: 1.1rem; }
    .wh-missed p { margin: 10px 0 0; font-size: 0.9rem; }
    .wh-allfound { font-weight: 700; color: var(--good); }
    .wh-ranks { border-collapse: collapse; width: 100%; }
    .wh-ranks td { padding: 6px 8px; border-bottom: 1px solid var(--line); }
    .wh-ranks td:last-child { text-align: right; font-variant-numeric: tabular-nums; }
    .wh-ranks .wh-now td { font-weight: 800; background: #fbf0cf; }
    @media (min-width: 900px) {
      .wh-wrap { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); grid-template-rows: auto auto 1fr;
        grid-template-areas: "main prog" "main found" "main fin"; align-items: start; }
      .wh-hive-wrap { width: min(40vw, 420px, 56vh); }
      .wh-found-head { pointer-events: none; }
      .wh-found .wh-caret { display: none; }
      .wh-found .wh-list { display: flex; max-height: 46vh; overflow-y: auto; }
      .wh-finish { justify-self: start; }
    }
    @media (max-width: 899px) and (min-height: 900px) { .wh-found .wh-list { display: flex; } .wh-found .wh-caret { display: none; } .wh-found-head { pointer-events: none; } }
    @media (max-width: 480px) {
      .wh-word { font-size: 1.6rem; }
      .wh-buttons .btn { min-width: 0; flex: 1 1 0; }
      .wh-buttons .wh-round { flex: none; }
    }
  `));
})();
