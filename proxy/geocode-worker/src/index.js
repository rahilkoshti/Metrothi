// Mappls geocoding proxy — a Cloudflare Worker that keeps the Mappls OAuth
// credentials server-side. Two actions:
//
//   GET /?q=<query>        →  { results: [{ name, eloc }] }   (autosuggest)
//   GET /?resolve=<eloc>   →  { lat, lng }                    (eLoc → coords)
//
// Mappls autosuggest returns place-codes (eLoc), not coordinates, so the app
// carries the eLoc through the suggestion list and resolves only the ONE
// place the user actually picks — one geocode call per selection, not per
// keystroke.
//
// Secrets (set with `wrangler secret put <NAME>`):
//   MAPPLS_CLIENT_ID
//   MAPPLS_CLIENT_SECRET
// Optional var (wrangler.toml [vars]):
//   ALLOWED_ORIGIN — CORS origin, defaults to "*"

const TOKEN_URL = 'https://outpost.mappls.com/api/security/oauth/token';
const SEARCH_URL = 'https://atlas.mappls.com/api/places/search/json';
const GEOCODE_URL = 'https://atlas.mappls.com/api/places/geocode';

// Ahmedabad/Gandhinagar service area.
const BBOX = { minLng: 72.4, minLat: 22.9, maxLng: 72.7, maxLat: 23.3 };
// Bias autosuggest toward central Ahmedabad.
const LOCATION_BIAS = '23.03,72.58';

// Mappls tokens live ~24h; cache per worker isolate.
let cachedToken = null; // { token, expiresAt }

async function getToken(env) {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.MAPPLS_CLIENT_ID,
      client_secret: env.MAPPLS_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`Mappls token request failed: ${res.status}`);
  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

// Retry a request once with a fresh token if the first attempt 401s.
async function authedFetch(url, env) {
  let token = await getToken(env);
  let res = await fetch(url, { headers: { Authorization: `bearer ${token}` } });
  if (res.status === 401) {
    cachedToken = null;
    token = await getToken(env);
    res = await fetch(url, { headers: { Authorization: `bearer ${token}` } });
  }
  return res;
}

// Autosuggest → [{ name, eloc }]. Coordinates are resolved later, on select.
async function searchMappls(q, env) {
  const url =
    `${SEARCH_URL}?query=${encodeURIComponent(q)}` +
    `&location=${LOCATION_BIAS}&region=IND`;
  const res = await authedFetch(url, env);
  if (!res.ok) throw new Error(`Mappls search failed: ${res.status}`);

  const data = await res.json();
  return (data.suggestedLocations ?? [])
    .filter((s) => s.eLoc && s.placeName)
    .slice(0, 6)
    .map((s) => ({
      // "Name, Locality" label, matching the app's Photon-result style.
      name: s.placeAddress
        ? `${s.placeName}, ${String(s.placeAddress).split(',')[0].trim()}`
        : s.placeName,
      eloc: s.eLoc,
    }));
}

// Geocode an eLoc → { lat, lng }, or null if it can't be resolved / is
// outside the service area. Mappls geocode returns coords in `copResults`
// (field names vary by tier, so several are tried).
async function resolveEloc(eloc, env) {
  const url = `${GEOCODE_URL}?address=${encodeURIComponent(eloc)}`;
  const res = await authedFetch(url, env);
  if (!res.ok) throw new Error(`Mappls geocode failed: ${res.status}`);

  const data = await res.json();
  const c = data.copResults ?? {};

  // Preferred: explicit lat/lng fields (name varies by Mappls tier).
  let lat = parseFloat(c.latitude ?? c.lat ?? c.y);
  let lng = parseFloat(c.longitude ?? c.lng ?? c.lon ?? c.x);

  // Fallback: scan any numeric field pair that falls in Gujarat's range,
  // so a differently-named coordinate field still resolves.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    let foundLat, foundLng;
    for (const v of Object.values(c)) {
      const n = parseFloat(v);
      if (!Number.isFinite(n)) continue;
      if (n >= BBOX.minLat && n <= BBOX.maxLat && foundLat === undefined) foundLat = n;
      else if (n >= BBOX.minLng && n <= BBOX.maxLng && foundLng === undefined) foundLng = n;
    }
    lat = foundLat;
    lng = foundLng;
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < BBOX.minLat || lat > BBOX.maxLat || lng < BBOX.minLng || lng > BBOX.maxLng) {
    return null;
  }
  return { lat, lng };
}

function json(body, corsHeaders, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return json({ error: 'method_not_allowed' }, cors, 405);
    }

    const params = new URL(request.url).searchParams;

    try {
      // TEMP DEBUG — probe candidate endpoints that may return lat/lng for a
      // query/eLoc. Remove once the coordinate source is confirmed.
      const rd = (params.get('resolveDebug') || '').trim();
      if (rd) {
        const token = await getToken(env);
        const probes = [];
        // advancedmaps geocode — token in PATH, no auth header (per docs).
        // Test with both a text address and an eLoc as the address value.
        const urls = [
          `https://apis.mappls.com/advancedmaps/v1/${token}/geocode?address=${encodeURIComponent(rd)}`,
          `https://apis.mappls.com/advancedmaps/v1/${token}/geo_code?addr=${encodeURIComponent(rd)}`,
        ];
        for (const url of urls) {
          try {
            const r = await fetch(url);
            probes.push({ url: url.replace(token, 'TOKEN'), status: r.status, body: (await r.text()).slice(0, 700) });
          } catch (e) {
            probes.push({ error: String(e) });
          }
        }
        return json({ probes }, cors);
      }

      const resolve = (params.get('resolve') || '').trim();
      if (resolve) {
        const coords = await resolveEloc(resolve, env);
        if (!coords) return json({ error: 'not_found' }, cors, 404);
        return json(coords, cors);
      }

      const q = (params.get('q') || '').trim();
      if (q.length < 3) return json({ results: [] }, cors);
      return json({ results: await searchMappls(q, env) }, cors);
    } catch (err) {
      console.error('geocode-worker:', err.message);
      return json({ error: 'geocoding_failed' }, cors, 502);
    }
  },
};
