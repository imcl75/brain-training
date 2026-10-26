/* Daily Brain Gym progress sync (Cloudflare Worker + KV).
 *
 * POST /v1/results  header X-Sync-Code, body {device, name, version, results:[...]}
 *                   merges results by id into the store for that code.
 * GET  /v1/results  header X-Sync-Code -> {name, updated, results}
 *
 * The family code is the only key: it is hashed before use, never stored.
 * KV binding: BRAIN. Variable ALLOWED_ORIGINS: comma-separated origins.
 */
const MAX_BODY = 1_000_000;
const MAX_RESULTS = 30000;

async function keyFor(code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('brain-gym:' + code));
  return 'u:' + [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : (allowed[0] || ''),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Sync-Code',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, headers) });
}

/* Keep only the fields the app writes, with sane types and sizes. */
function clean(r) {
  if (!r || typeof r !== 'object' || typeof r.id !== 'string' || r.id.length > 40) return null;
  if (typeof r.game !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) return null;
  const out = {
    id: r.id, game: r.game.slice(0, 40), date: r.date,
    ts: Number(r.ts) || 0, mode: r.mode == null ? null : String(r.mode).slice(0, 40),
    practice: !!r.practice, won: r.won === false ? false : true,
    score: typeof r.score === 'number' && isFinite(r.score) ? r.score : null,
    display: typeof r.display === 'string' ? r.display.slice(0, 200) : '',
    ms: Number(r.ms) || 0, device: String(r.device || '').slice(0, 20),
  };
  if (r.detail && typeof r.detail === 'object') {
    const d = JSON.stringify(r.detail);
    if (d.length <= 2000) out.detail = r.detail;
  }
  return out;
}

export default {
  async fetch(req, env) {
    const headers = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(req.url);
    if (url.pathname !== '/v1/results') return json({ error: 'Not found' }, 404, headers);

    const code = (req.headers.get('X-Sync-Code') || '').trim();
    if (code.length < 12 || code.length > 100) return json({ error: 'A family code of at least 12 characters is needed' }, 401, headers);
    const key = await keyFor(code);

    if (req.method === 'GET') {
      const stored = await env.BRAIN.get(key, 'json');
      if (!stored) return json({ error: 'Nothing saved for this code yet' }, 404, headers);
      return json(stored, 200, headers);
    }

    if (req.method === 'POST') {
      const text = await req.text();
      if (text.length > MAX_BODY) return json({ error: 'Too large' }, 413, headers);
      let body;
      try { body = JSON.parse(text); } catch (e) { return json({ error: 'Bad JSON' }, 400, headers); }
      const incoming = (Array.isArray(body.results) ? body.results : []).map(clean).filter(Boolean);
      const stored = (await env.BRAIN.get(key, 'json')) || { results: [] };
      const byId = new Map(stored.results.map(r => [r.id, r]));
      incoming.forEach(r => byId.set(r.id, r));
      let results = [...byId.values()].sort((a, b) => a.ts - b.ts);
      if (results.length > MAX_RESULTS) results = results.slice(-MAX_RESULTS);
      const next = {
        name: typeof body.name === 'string' ? body.name.slice(0, 60) : stored.name || '',
        version: typeof body.version === 'string' ? body.version.slice(0, 20) : stored.version || '',
        updated: Date.now(),
        results,
      };
      await env.BRAIN.put(key, JSON.stringify(next));
      return json({ ok: true, count: results.length }, 200, headers);
    }

    return json({ error: 'Method not allowed' }, 405, headers);
  },
};
