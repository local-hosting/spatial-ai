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
| `SPATIAL_AI_COMPOSE_POLICY` | `0` disables label narrowing + post-compose repair | on |
| `SPATIAL_AI_COMPOSE_PLACE_REPAIR` | `0` skips rank-1 place fill for `where_to_go` | on |
| `SPATIAL_AI_COMPOSE_ACTION_CAP` | Max `action_ids` per actor after repair | `2` |
| `SPATIAL_AI_SESSION_H3_RESOLUTION` | Max H3 fineness for session / `placesNear` (0–15; **7** ≈ 1.2 km edge) | `7` |
| `SPATIAL_AI_DEFAULT_H3_CELL` | Local **mesh** boot H3 (alias `SPATIAL_AI_DEFAULT_H3`) | unset |
| `SPATIAL_AI_REGION_H3_CELL` | Regional prior (alias `SPATIAL_AI_REGION_H3`) | unset |
| `SPATIAL_AI_REGION_DEFAULT_US` | `1` → US geographic center at region resolution | off |
| `SPATIAL_AI_REGION_H3_RESOLUTION` | Region cell fineness (default **5**, coarser than session) | `5` |
| `SPATIAL_AI_SESSION_OBSERVATIONS_MAX` | Max stored H3 observations per `session_id` (triangulation window) | `12` |
| `SPATIAL_AI_MODE` | Default **`everyday`** or **`resilience`** (UI + API when `mode` omitted) | `everyday` |
| `SPATIAL_AI_RESILIENCE_AUTO_EVENT` | `0` disables auto `E_FLOOD` event in resilience mode when `event` omitted | on |
| `SPATIAL_AI_VOCAB_H3_SLICE` | `0` disables anchor k-ring vocab slice before `placesNear` | on |
| `SPATIAL_AI_PLACES_RING_K` | k-ring for slice + disk ranking (0–3) | `1` |
| `SPATIAL_AI_LEXICON_FIRST_MAP` | Skip GLiNER when lexicon confidence ≥ 0.85 | on |
| `SPATIAL_AI_FAST_PATH` | Skip llama when lexicon + geo rank‑1 satisfy rubric | on |
| `SPATIAL_AI_HEALTH_AUTO_RULES_ONLY` | Force rules compose when llama unreachable | on |
| `SPATIAL_AI_HEALTH_CACHE_MS` | TTL for cached upstream probes on `POST /chat` | `5000` |

Compose / map / llama timeouts and URLs come from **`LOCAL_AI_*`** via `loadUpstreamAiConfig`. Swap the composer GGUF with **`LOCAL_AI_COMPOSE_MODEL`** (MANIFEST name) — see local-ai [env.md](../../local-ai/docs/env.md) and `yarn workspace @local-hosting/local-ai resolve:composer`.

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