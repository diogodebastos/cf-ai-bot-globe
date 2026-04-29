# cf-ai-bot-globe

3D night-lights globe that flashes by country to visualize AI bot / crawler activity from the Cloudflare Radar API. Frontend on Cloudflare Pages, API token kept server-side via Pages Functions.

## Stack

- `three` + `three-globe` (no bundler, ESM via importmap + esm.sh)
- Cloudflare Pages (static `public/`)
- Cloudflare Pages Functions (`functions/api/activity.ts`) proxies and caches the Radar API

## Setup

1. Create a Cloudflare API token with the **Account · Cloudflare Radar · Read** permission.
2. Copy `.dev.vars.example` to `.dev.vars` and put the token there.
3. Install wrangler: `npm install`.

## Run locally

```
npm run dev
```

Opens `http://localhost:8788`. The Pages Function is served at `/api/activity`.

Smoke test the API:

```
curl http://localhost:8788/api/activity | jq
```

Expected: `{ updatedAt, totalRate, countries: [{ code, value, share }, ...] }`.

## Deploy

```
npx wrangler pages project create cf-ai-bot-globe
npx wrangler pages secret put CLOUDFLARE_API_TOKEN --project-name cf-ai-bot-globe
npm run deploy
```

The site is then live at `https://cf-ai-bot-globe.pages.dev`.

## How "real time" works

The Radar API returns aggregated time series (5–15 min granularity), not a per-request stream. The Worker fetches the last hour every 60s; the browser polls every 30s. Flashes are scheduled locally at a rate proportional to the global total, weighted by per-country share — the visual is a faithful animation of the latest aggregate, not literal individual requests.

## Files

- `public/index.html`, `public/styles.css`, `public/app.js` — frontend
- `functions/api/activity.ts` — Pages Function that proxies Radar
- `wrangler.toml` — Pages config
