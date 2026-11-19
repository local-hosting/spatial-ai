# @local-hosting/spatial-ai

Place-grounded layer on **`@local-hosting/local-ai`**, using **`@local-hosting/geokit`** (H3 / haversine) and **`@local-hosting/geotypes`** (slug filters).

```text
apps  →  spatial-ai  →  local-ai  →  compose  →  frames
              └─ geokit / geotypes (linked, not merged into P_* vocab)
```

| Need | Use |
|------|-----|
| Map + compose only | `@local-hosting/local-ai` |
| Offline place-grounded chat / near-me | `@local-hosting/spatial-ai` |

Loopback HTTP: **`POST /spatial`** and **`POST /chat`**, plus all **local-ai** routes on one listener. Browsers get a Tailwind chat UI at **`GET /`** (HTML) or **`GET /ui`**; API clients still get JSON from **`GET /`** with `Accept: application/json`. Upstream llama / GLiNER use `LOCAL_AI_*` (see local-ai `docs/env.md`). Mesh boot: `runtime/boot.sh` — [`docs/runtime.md`](docs/runtime.md).

## Commands

From the **local-hosting** workspace root:

```bash
yarn install --ignore-engines
yarn workspace @local-hosting/spatial-ai typecheck
yarn workspace @local-hosting/spatial-ai test
yarn workspace @local-hosting/spatial-ai build:ui   # Tailwind bundle → ui/dist (prestart runs this)
yarn workspace @local-hosting/spatial-ai start
yarn workspace @local-hosting/spatial-ai dev:ui    # Vite dev (optional; proxy API on :8092)
```

Chat styles ship from **`ui/dist`** (no CDN). The composer sits over a **`@local-hosting/geokit`** map (`gk-map` + session point + H3 ring). Set **`MAPTILER_KEY`** (or `MAPBOX_TOKEN` / `PROTOMAPS_KEY`) in the environment when running **`build:ui`** / **`start`**.

See `docs/spatial-ai.md`, `docs/env.md` (`SPATIAL_AI_*`), and `docs/browser-contract.md`.
