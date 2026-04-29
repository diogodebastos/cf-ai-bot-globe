interface Env {
  CLOUDFLARE_API_TOKEN: string;
}

// Cloudflare Radar's AI bots endpoint has no per-location breakdown, so we
// must call it once per country with the `location` filter and aggregate.
// Pages Functions cap each invocation at 50 outbound subrequests (free tier),
// so we stay at 45 country calls + 1 global call. This list covers the
// countries that account for the overwhelming majority of internet users
// and AI crawler traffic — anything outside falls into "rest of world" and
// shows as low-share noise that wouldn't drive visible flashes anyway.
const COUNTRIES = [
  // North America
  "US", "CA", "MX",
  // South America
  "BR", "AR", "CL", "CO",
  // Western Europe
  "GB", "IE", "FR", "DE", "NL", "BE", "ES", "PT", "IT", "CH", "AT",
  // Nordics + Eastern Europe
  "SE", "NO", "FI", "DK", "PL", "CZ", "RU", "UA",
  // Middle East + Africa
  "TR", "IL", "AE", "SA", "EG", "ZA",
  // Asia-Pacific
  "JP", "KR", "CN", "TW", "HK", "SG", "IN", "ID", "TH", "VN", "PH",
  "MY", "AU",
];

const RADAR = "https://api.cloudflare.com/client/v4/radar";

async function radarJSON(path: string, token: string): Promise<any> {
  const res = await fetch(RADAR + path, {
    headers: { Authorization: `Bearer ${token}` },
    cf: { cacheTtl: 60, cacheEverything: true } as RequestInitCfProperties,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`radar ${path} ${res.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`radar ${path} bad json: ${text.slice(0, 200)}`);
  }
}

function extractValues(j: any): number[] {
  const r = j?.result;
  if (!r) return [];
  const node = r.serie_0 ?? r.main ?? Object.values(r).find((x: any) => x && Array.isArray(x.values));
  const vals = (node as any)?.values ?? [];
  return vals.map((v: string | number) => Number(v) || 0);
}

function sumSeries(values: number[]): number {
  let s = 0;
  for (const v of values) s += v;
  return s;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + "/__activity_cache");
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  if (!env.CLOUDFLARE_API_TOKEN) {
    return new Response(JSON.stringify({ error: "missing token" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const global = await radarJSON(
      "/ai/bots/timeseries?dateRange=1d&aggInterval=15m",
      env.CLOUDFLARE_API_TOKEN,
    );
    const totalRate = sumSeries(extractValues(global));

    const perCountry = await Promise.all(
      COUNTRIES.map(async (code) => {
        try {
          const j = await radarJSON(
            `/ai/bots/timeseries?dateRange=1d&aggInterval=15m&location=${code}`,
            env.CLOUDFLARE_API_TOKEN,
          );
          return { code, value: sumSeries(extractValues(j)) };
        } catch {
          return { code, value: 0 };
        }
      }),
    );

    const sum = perCountry.reduce((a, c) => a + c.value, 0) || 1;
    const countries = perCountry.map((c) => ({ ...c, share: c.value / sum }));

    const body = JSON.stringify({
      updatedAt: new Date().toISOString(),
      totalRate,
      countries,
    });

    const response = new Response(body, {
      headers: {
        "content-type": "application/json",
        "cache-control": "public, max-age=60",
        "access-control-allow-origin": "*",
      },
    });
    await cache.put(cacheKey, response.clone());
    return response;
  } catch (err: any) {
    console.error("activity error:", err?.message ?? err);
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
};
