# @local-hosting/spatial-ai

**Local spatial AI** — place-grounded layer on **`@local-hosting/local-ai`**.

```text
apps  →  spatial-ai  →  ai  →  compose  →  wire
              └─ geokit / geotypes (link, don’t merge)
```

| Need | Use |
|------|-----|
| Map + compose only | `@local-hosting/local-ai` |
| Offline place-grounded chat / near-me | `@local-hosting/spatial-ai` |

Basic inference (llama / GLiNER ports) still runs from **`ai`**. This package serves **`POST /spatial`** and **`POST /chat`** on loopback (`TF_SPATIAL_AI_PORT`, default **8092**).

## Commands

```bash
yarn install
yarn workspace @local-hosting/spatial-ai typecheck
yarn workspace @local-hosting/spatial-ai test
yarn workspace @local-hosting/spatial-ai start
```

See `docs/spatial-ai.md` and `docs/browser-contract.md`.
