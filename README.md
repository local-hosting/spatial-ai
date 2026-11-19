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

Loopback HTTP: **`POST /spatial`** and **`POST /chat`** (`TF_SPATIAL_AI_PORT`, default **8092**). Upstream llama / GLiNER URLs match local-ai.

## Commands

From the **local-hosting** workspace root:

```bash
yarn install --ignore-engines
yarn workspace @local-hosting/spatial-ai typecheck
yarn workspace @local-hosting/spatial-ai test
yarn workspace @local-hosting/spatial-ai start
```

See `docs/spatial-ai.md` and `docs/browser-contract.md`.
