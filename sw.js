/* Offline copy of the app. Network first (so updates show straight away when
 * online), falling back to the cached copy when offline.
 * VERSION must match BT.version in js/core.js: tools/bump_version.sh sets both. */
const VERSION = '26.10.26a';
const CACHE = 'brain-gym-' + VERSION;
importScripts('js/games-list.js');

const SHELL = [
  './', 'index.html', 'family.html', 'manifest.webmanifest', 'css/app.css',
  'js/core.js', 'js/config.js', 'js/stats.js', 'js/games-list.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
].concat(BT_GAMES.map(id => 'js/games/' + id + '.js'), BT_DATA);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('brain-gym-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(url.pathname === '/' ? req : new Request(url.origin + url.pathname), copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('index.html')))
  );
});
