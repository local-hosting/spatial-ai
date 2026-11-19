# Environment variables

Operational names use **`SPATIAL_AI_`** upstream config uses **`LOCAL_AI_`** (see `@local-hosting/local-ai` [env.md](../../local-ai/docs/env.md)).

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | Listen port | `8092` |
| `SPATIAL_AI_PORT` | Same when `PORT` unset | `8092` |
| `SPATIAL_AI_BIND_HOST` | `127.0.0.1` or `0.0.0.0` | `127.0.0.1` |
| `SPATIAL_AI_SERVICE_ID` | `GET /` metadata | `spatial-ai` |
| `SPATIAL_AI_VERSION` | `GET /` metadata | package version |
| `SPATIAL_AI_API_KEY` | Gateway Bearer auth | unset (open) |
| `SPATIAL_AI_RULES_ONLY` | `1` forces compose rules path | unset |

Compose / map / llama timeouts and URLs come from **`LOCAL_AI_*`** via `loadUpstreamAiConfig`.

## Chat UI map tiles (`GET /ui/map-config.json`)

Server process env (or dotenv at **`start`**: `spatial-ai/.env`, then sibling **`geokit/.env`** for `MAPTILER_KEY`). The UI does **not** call MapTiler without a key.

| Variable | Purpose |
|----------|---------|
| `MAPTILER_KEY` | MapTiler Cloud (default provider when set) |
| `MAPBOX_TOKEN` | Mapbox GL provider |
| `PROTOMAPS_KEY` / `GEOKIT_PROTOMAPS_KEY` | Protomaps provider |
| `GEOKIT_MAP_PROVIDER` | Force `maptiler` \| `mapbox` \| `protomaps` |
| `SPATIAL_AI_MAP_PROVIDER` | Same override for chat UI only |

When both `MAPBOX_TOKEN` and `MAPTILER_KEY` are set, the chat UI defaults to **mapbox** so `http://127.0.0.1:8092` works without MapTiler URL allowlists. For MapTiler in the browser, add your loopback origin in the [MapTiler key HTTP referrers](https://docs.maptiler.com/cloud/api/authentication/key/) list.

`GET /ui/map-config.json` includes **`fallbackProviders`** (ordered list of providers that have keys). If the first choice fails to load tiles, the chat map remounts with the next provider in that list.

### Why `build:ui`?

The chat page is a **Vite bundle** (Tailwind + geokit) in `ui/dist/`. **`yarn start`** runs `prestart`, which builds **only if** `ui/dist/index.html` is missing. Re-run **`yarn build:ui`** after you change files under `ui/`.

Verify: `curl -s http://127.0.0.1:8092/ui/map-config.json | jq .configured`

## Dependencies (`@local-hosting/geokit`)

Chat map UI needs **`elements-lite/register`**, **`h3/map-ui`**, and **`point-visual`** (geokit ≥ 0.4.4 published).

### Local sibling (no publish)

`spatial-ai` can depend on **`portal:../geokit`** (see `package.json`). After geokit UI changes:

```bash
cd geokit && yarn build:ui:bundle
cd ../spatial-ai && yarn build:ui
# restart yarn start if the server is already running
```

### GitHub Packages

For CI or without a sibling checkout, pin a semver (e.g. `0.4.5+`) and set **`YARN_NPM_AUTH_TOKEN`** before `yarn install` (workspace `.yarnrc.yml`).