# Metrothi geocoding proxy (Mappls)

A tiny Cloudflare Worker that fronts the [Mappls (MapmyIndia)](https://apis.mappls.com/console/)
Places Search API so the OAuth client secret never ships in the app bundle.
The app calls `GET <worker-url>/?q=<query>` and gets back
`{ results: [{ name, lat, lng }] }`, already filtered to the
Ahmedabad/Gandhinagar bounding box and capped at 5 results.

## One-time setup

1. **Get Mappls credentials** (free tier is generous):
   - Sign up at <https://apis.mappls.com/console/>.
   - Create a project / OAuth app; note the **Client ID** and **Client Secret**
     (the REST/Atlas credentials, not the SDK map key).

2. **Deploy the worker** (needs a free Cloudflare account and
   [`wrangler`](https://developers.cloudflare.com/workers/wrangler/)):

   ```sh
   cd proxy/geocode-worker
   npx wrangler secret put MAPPLS_CLIENT_ID      # paste client id
   npx wrangler secret put MAPPLS_CLIENT_SECRET  # paste client secret
   npx wrangler deploy
   ```

   Note the deployed URL, e.g. `https://metrothi-geocode.<account>.workers.dev`.

3. **Point the app at it** — in `app/.env.local`:

   ```
   VITE_GEOCODE_PROXY_URL=https://metrothi-geocode.<account>.workers.dev
   ```

   Restart the dev server. Without this variable the app falls back to the
   free Photon (OSM) geocoder, so the proxy is optional in development.

4. **Lock down CORS** once the app has a real domain: set `ALLOWED_ORIGIN`
   in `wrangler.toml` and redeploy.

## Local testing

```sh
cd proxy/geocode-worker
echo 'MAPPLS_CLIENT_ID=...\nMAPPLS_CLIENT_SECRET=...' > .dev.vars
npx wrangler dev          # serves on http://localhost:8787
curl "http://localhost:8787/?q=sabarmati%20ashram"
```
