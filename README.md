# Daily Brain Gym

A daily puzzle app for Mum: word games, crosswords, Sudoku, mahjong tiles,
memory and speed games in one place. Plain HTML, CSS and JavaScript: no build
step, no framework. Hosted on GitHub Pages; works offline once opened (service
worker), and can be added to the iPad home screen.

Puzzles are original. Game names avoid other publishers' trademarks.

## Files

| Path | What it is |
|------|------------|
| `index.html` | Loads the shell and every game (one `<script>` per game) |
| `css/app.css` | Shared look: large type, big buttons, colours as CSS variables |
| `js/core.js` | Shell: storage, dates, seeded random, results, home/play/progress/settings screens, sound, sync |
| `js/config.js` | `syncUrl` of the progress-sync Worker (empty = no sync) |
| `js/stats.js` | Progress screen, shared with `family.html` |
| `js/games/*.js` | One file per game |
| `js/data/*.js` | Word lists and puzzle banks, loaded only when a game needs them |
| `family.html` | Family view of synced progress (enter the family code) |
| `worker/` | Cloudflare Worker that stores synced results |
| `sw.js` | Offline cache. **Add new files to its list** |
| `tools/build_words.py` | Rebuilds the word lists |

## Version number

`BT.version` in `js/core.js` (format `DD.MM.YYx`, e.g. `26.10.26a`) is shown
in the footer. Bump it on every push; `sw.js` reads it too, so bumping it is
what makes iPads fetch the new files.

## Adding a game

1. Create `js/games/<id>.js` that calls `BT.registerGame({...})` (copy
   `daily-word.js`, the reference game).
2. Add a `<script>` tag for it in `index.html` and the path to `sw.js`.
3. Bump the version.

### Game definition

```js
BT.registerGame({
  id: 'my-game',            // unique, used in URLs and saved results
  name: 'My Game',
  category: 'words',        // words | crosswords | numbers | tiles | memory | speed
  icon: '🧩',               // one emoji
  blurb: 'Short line shown on the home card',
  howTo: '<p>HTML shown in the "How to play" box (and the first time)</p>',
  daily: true,              // true: one scored puzzle per day (per mode), same for everyone,
                            //       plus unlimited practice puzzles. false: play any time.
  better: 'higher',         // is a higher score better? 'higher' | 'lower'
  modes: [{ id: 'easy', name: 'Easy', blurb: '...' }],   // optional: chosen before play
  modesPrompt: 'Choose a difficulty:',                    // optional
  scripts: ['js/data/my-bank.js'],   // optional: loaded before start()
  settings: [{ key: 'hints', label: 'Show hints', default: true }],  // optional on/off settings
  start(ctx) { ... },
});
```

### `ctx`, passed to `start`

| Member | Use |
|--------|-----|
| `ctx.el` | Empty element to build the game in |
| `ctx.date` | Today, `YYYY-MM-DD` |
| `ctx.mode` | Chosen mode id, or `null` |
| `ctx.practice` | `true` for a practice puzzle (daily games) |
| `ctx.rng()` | Seeded random 0..1 (same all day for a daily puzzle). Also `ctx.rng.int(n)`, `.pick(arr)`, `.shuffle(arr)` |
| `ctx.setting(key)` | Value of one of the game's settings |
| `ctx.setStatus(text)` | Text at the right of the header (timer, moves, score) |
| `ctx.save(data)` / `ctx.load()` / `ctx.clearSave()` | Keep an unfinished puzzle so it resumes after leaving |
| `ctx.onExit(fn)` | Clean-up when the player leaves (remove listeners, stop timers) |
| `ctx.sound(name)` | `'tap'`, `'good'`, `'bad'`, `'win'`; `ctx.tone(freq, ms)` for a note |
| `ctx.toast(msg)` | Brief message |
| `ctx.finish({score, won, display, detail, ms, delay, extra})` | Record the result and show the result screen. `score` is a number (compared with `better`), `display` the sentence shown ("Solved in 4 guesses"), `won: false` for a loss, `delay` ms before the result screen (default 900), `extra` an optional element shown on it |

Helpers: `BT.h(tag, attrs, ...children)` builds elements (`onclick` etc. as
attrs), `BT.dialog`, `BT.confirm`, `BT.fmtTime(ms)`, `BT.dayNumber(date)`
(days since 1 Jan 2026, for picking today's item from a bank),
`BT.rng(seed)`.

Put a game's own CSS in a `<style>` it adds once (see `daily-word.js`), with
class names prefixed by the game (`dw-`). Use the CSS variables in
`css/app.css`. Touch targets at least 52px; text at least 1rem.
