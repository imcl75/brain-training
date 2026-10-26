/* Progress screen. Shared by the app (local results) and family.html (synced results).
 * BT.stats.render(el, results, {name}) fills el. */
(function () {
  // One hue, light to dark, for "how many games that day" (sequential).
  const SEQ = ['#e9e4da', '#b5d8de', '#6fb2c0', '#2f8299', '#1b566b'];
  const LINE = '#1f6f8b';

  let tip = null;
  function showTip(evt, html) {
    if (!tip) { tip = BT.h('div', { class: 'st-tip', role: 'tooltip' }); document.body.append(tip); }
    tip.innerHTML = html;
    tip.style.display = 'block';
    const r = tip.getBoundingClientRect();
    let x = evt.clientX - r.width / 2, y = evt.clientY - r.height - 14;
    x = Math.max(8, Math.min(window.innerWidth - r.width - 8, x));
    if (y < 8) y = evt.clientY + 18;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function hideTip() { if (tip) tip.style.display = 'none'; }
  document.addEventListener('scroll', hideTip, true);

  const svgNS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs) { const e = document.createElementNS(svgNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }

  function tile(value, label) {
    return BT.h('div', { class: 'st-tile' }, BT.h('div', { class: 'st-value' }, String(value)), BT.h('div', { class: 'st-label' }, label));
  }

  function calendar(results, weeks) {
    const counts = {};
    results.forEach(r => { counts[r.date] = (counts[r.date] || 0) + 1; });
    const today = BT.today();
    // Start on the Monday `weeks` weeks ago.
    let start = BT.addDays(today, -(weeks * 7 - 1));
    const dow = (BT.parseDate(start).getDay() + 6) % 7;
    start = BT.addDays(start, -dow);
    const cell = 26, gap = 4, left = 34, top = 20;
    const cols = Math.ceil((BT.dayNumber(today) - BT.dayNumber(start) + 1) / 7);
    const svg = s('svg', { viewBox: `0 0 ${left + cols * (cell + gap)} ${top + 7 * (cell + gap)}`, class: 'st-cal', role: 'img', 'aria-label': 'Days played over the last ' + weeks + ' weeks' });
    ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].forEach((d, i) => {
      if (!d) return;
      const t = s('text', { x: 0, y: top + i * (cell + gap) + cell * 0.7, class: 'st-axis' }); t.textContent = d; svg.append(t);
    });
    let lastMonth = -1;
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < 7; r++) {
        const key = BT.addDays(start, c * 7 + r);
        if (key > today) continue;
        const d = BT.parseDate(key);
        if (r === 0 && d.getMonth() !== lastMonth) {
          lastMonth = d.getMonth();
          const t = s('text', { x: left + c * (cell + gap), y: 12, class: 'st-axis' });
          t.textContent = d.toLocaleDateString('en-GB', { month: 'short' }); svg.append(t);
        }
        const n = counts[key] || 0;
        const step = n === 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : n <= 6 ? 3 : 4;
        const rect = s('rect', { x: left + c * (cell + gap), y: top + r * (cell + gap), width: cell, height: cell, rx: 5, fill: SEQ[step], class: 'st-day' + (key === today ? ' today' : '') });
        const html = '<b>' + BT.escape(BT.niceDate(key)) + '</b><br>' + (n ? n + (n === 1 ? ' game' : ' games') : 'No games');
        rect.addEventListener('pointerenter', e => showTip(e, html));
        rect.addEventListener('pointerdown', e => showTip(e, html));
        rect.addEventListener('pointerleave', hideTip);
        svg.append(rect);
      }
    }
    const legend = BT.h('div', { class: 'st-legend' }, 'Fewer',
      SEQ.map(c => BT.h('span', { class: 'st-swatch', style: 'background:' + c })), 'More games');
    return BT.h('div', { class: 'st-cal-wrap' }, svg, legend);
  }

  /* A small trend line of one game (and mode)'s recent scores. */
  function trend(list, game) {
    const pts = list.slice(-20);
    const W = 300, H = 90, padL = 8, padR = 46, padT = 12, padB = 12;
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'st-trend', role: 'img', 'aria-label': 'Recent scores' });
    if (pts.length < 2) return null;
    const vals = pts.map(p => p.score);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    // "Up is better" on screen even when a lower score is better (times, moves).
    const flip = game.better === 'lower';
    const x = i => padL + (i / (pts.length - 1)) * (W - padL - padR);
    const y = v => { const t = (v - lo) / (hi - lo); return padT + (flip ? t : 1 - t) * (H - padT - padB); };
    svg.append(s('line', { x1: padL, x2: W - padR, y1: H - padB, y2: H - padB, class: 'st-base' }));
    svg.append(s('polyline', { points: pts.map((p, i) => x(i) + ',' + y(p.score)).join(' '), class: 'st-line', stroke: LINE }));
    pts.forEach((p, i) => {
      const last = i === pts.length - 1;
      svg.append(s('circle', { cx: x(i), cy: y(p.score), r: last ? 5 : 3, fill: last ? LINE : '#fff', stroke: LINE, 'stroke-width': 2 }));
      const hit = s('circle', { cx: x(i), cy: y(p.score), r: 13, fill: 'transparent', class: 'st-hit' });
      const html = '<b>' + BT.escape(BT.niceDate(p.date)) + '</b><br>' + BT.escape(p.display || String(p.score));
      hit.addEventListener('pointerenter', e => showTip(e, html));
      hit.addEventListener('pointerdown', e => showTip(e, html));
      hit.addEventListener('pointerleave', hideTip);
      svg.append(hit);
    });
    const end = s('text', { x: x(pts.length - 1) + 9, y: y(pts[pts.length - 1].score) + 5, class: 'st-end' });
    end.textContent = 'latest';
    svg.append(end);
    return svg;
  }

  function gameSection(game, results) {
    const mine = results.filter(r => r.game === game.id).sort((a, b) => a.ts - b.ts);
    if (!mine.length) return null;
    const modes = game.modes ? game.modes.map(m => m.id).filter(id => mine.some(r => r.mode === id)) : [null];
    const rows = modes.map(modeId => {
      const list = mine.filter(r => modeId === null || r.mode === modeId);
      const scored = list.filter(r => r.won !== false && typeof r.score === 'number');
      const best = scored.length ? scored.reduce((a, b) => (game.better === 'lower' ? (b.score < a.score ? b : a) : (b.score > a.score ? b : a))) : null;
      const wins = list.filter(r => r.won !== false).length;
      const modeName = modeId ? (game.modes.find(m => m.id === modeId) || {}).name : null;
      return BT.h('div', { class: 'st-row' },
        BT.h('div', { class: 'st-row-text' },
          modeName ? BT.h('div', { class: 'st-mode' }, modeName) : null,
          BT.h('div', null, list.length + (list.length === 1 ? ' game' : ' games') + (wins < list.length ? ' · ' + wins + ' completed' : '')),
          best ? BT.h('div', null, 'Best: ', BT.h('b', null, best.display || String(best.score))) : null,
          BT.h('div', { class: 'muted' }, 'Last: ' + (list[list.length - 1].display || ''))),
        trend(scored, game));
    });
    const cat = BT.categories[game.category] || {};
    return BT.h('section', { class: 'st-game', style: '--cat:' + (cat.colour || '#555') },
      BT.h('h3', null, (game.icon || '') + ' ' + game.name),
      rows);
  }

  function recentTable(results) {
    const list = results.slice().sort((a, b) => b.ts - a.ts).slice(0, 25);
    return BT.h('table', { class: 'st-table' },
      BT.h('thead', null, BT.h('tr', null, BT.h('th', null, 'Date'), BT.h('th', null, 'Game'), BT.h('th', null, 'Result'))),
      BT.h('tbody', null, list.map(r => {
        const g = BT.gameById[r.game];
        const mode = g && g.modes && r.mode ? ' (' + ((g.modes.find(m => m.id === r.mode) || {}).name || r.mode) + ')' : '';
        return BT.h('tr', null,
          BT.h('td', null, BT.parseDate(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })),
          BT.h('td', null, (g ? g.name : r.game) + mode + (r.practice ? ' · practice' : '')),
          BT.h('td', null, r.display || String(r.score)));
      })));
  }

  BT.stats = {
    render(el, results, opts) {
      opts = opts || {};
      if (!results.length) {
        el.replaceChildren(BT.h('p', { class: 'lead' }, 'No games played yet. Your progress will appear here.'));
        return;
      }
      const days = new Set(results.map(r => r.date));
      const month = BT.today().slice(0, 7);
      const thisMonth = [...days].filter(d => d.startsWith(month)).length;
      const lastPlayed = results.reduce((a, b) => (b.ts > a.ts ? b : a));
      el.replaceChildren(
        BT.h('div', { class: 'st-tiles' },
          tile(BT.streak(results), 'days in a row'),
          tile(thisMonth, 'days played this month'),
          tile(days.size, 'days played in all'),
          tile(results.length, 'games played')),
        opts.showLast ? BT.h('p', { class: 'muted' }, 'Last played ' + new Date(lastPlayed.ts).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })) : null,
        BT.h('h2', null, 'The last 12 weeks'),
        calendar(results, 12),
        BT.h('h2', null, 'Game by game'),
        BT.h('p', { class: 'muted' }, 'Each line shows the last 20 games. Higher always means better, so for times and guesses the line rises as they come down.'),
        BT.h('div', { class: 'st-games' }, BT.games.map(g => gameSection(g, results))),
        BT.h('h2', null, 'Recent games'),
        recentTable(results));
    },
  };

  document.head.append(BT.h('style', null, `
    .st-tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    .st-tile { background: var(--panel); border: 2px solid var(--line); border-radius: var(--radius); padding: 14px 16px; }
    .st-value { font-size: 2.2rem; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
    .st-label { color: var(--muted); }
    .st-cal-wrap { background: var(--panel); border: 2px solid var(--line); border-radius: var(--radius); padding: 14px; overflow-x: auto; }
    .st-cal { width: 100%; max-width: 560px; height: auto; display: block; }
    .st-axis { font-size: 11px; fill: var(--muted); }
    .st-day.today { stroke: var(--ink); stroke-width: 2; }
    .st-legend { display: flex; align-items: center; gap: 4px; color: var(--muted); font-size: 0.85rem; margin-top: 8px; }
    .st-swatch { width: 16px; height: 16px; border-radius: 4px; display: inline-block; }
    .st-games { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
    .st-game { background: var(--panel); border: 2px solid var(--line); border-left: 8px solid var(--cat); border-radius: var(--radius); padding: 14px 16px; }
    .st-game h3 { font-size: 1.1rem; }
    .st-game h3 small { font-weight: 400; color: var(--muted); font-size: 0.8rem; }
    .st-row { display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 6px 0; border-top: 1px solid var(--line); }
    .st-row:first-of-type { border-top: 0; }
    .st-row-text { font-size: 0.95rem; min-width: 0; }
    .st-mode { font-weight: 700; }
    .st-trend { width: 46%; max-width: 220px; height: auto; flex: none; }
    .st-line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .st-base { stroke: var(--line); stroke-width: 1; }
    .st-end { font-size: 11px; fill: var(--muted); }
    .st-table { width: 100%; border-collapse: collapse; background: var(--panel); border-radius: var(--radius); overflow: hidden; }
    .st-table th, .st-table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
    .st-table th { font-size: 0.9rem; color: var(--muted); }
    .st-tip { position: fixed; z-index: 70; background: var(--ink); color: #fff; padding: 8px 12px; border-radius: 10px; font-size: 0.9rem; pointer-events: none; display: none; max-width: 260px; }
  `));
})();
