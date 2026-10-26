# Progress sync Worker

Stores Mum's results so they can be seen on `family.html` from another device.
A Cloudflare Worker with one KV namespace (free plan is plenty: one write per
finished game).

## Live

Deployed 26.10.26 as `brain-gym-sync` on Cloudflare account "Innes.mclean@gmail.com's Account":
`https://brain-gym-sync.innes-mclean.workers.dev` (KV namespace `BRAIN`).
Redeploy after editing `worker.js`: `cd worker && npx wrangler deploy`.

## Data and privacy

- The only key is the **family code** (made on `family.html`, 16 random
  characters). The Worker stores data under a SHA-256 hash of it and never
  stores the code itself. Anyone with the code can read the results, so treat
  it like a password; make a new code to cut off an old one.
- Stored per code: the name in Settings, app version, and each game result
  (game, date, score, the result sentence, time taken). Nothing else.

## Set up (once)

Use a Cloudflare account of your own (not the school one).

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create BRAIN     # paste the id into wrangler.toml
npx wrangler deploy                        # prints https://brain-gym-sync.<you>.workers.dev
```

Then put that URL in `js/config.js` as `syncUrl`, bump the version, and push.
`ALLOWED_ORIGINS` in `wrangler.toml` must include the site's origin
(`https://imcl75.github.io`); localhost is always allowed for testing.

## Connect a device

1. Open `family.html` on your own device, tap **Make a family code**, copy it.
2. On Mum's iPad: Settings → "Share progress with family" → paste the code.
3. `family.html` with the same code shows her progress.
