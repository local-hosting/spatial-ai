# @local-hosting/spatial-ai

**Local spatial AI** — place-grounded layer on **`@local-hosting/ai`**.

```text
apps  →  spatial-ai  →  ai  →  compose  →  wire
              └─ geokit / geotypes (link, don’t merge)
```

| Need | Use |
|------|-----|
| Map + compose only | `@local-hosting/ai` |
| Offline place-grounded chat / near-me | `@local-hosting/spatial-ai` |

Basic inference (llama / GLiNER ports) still runs from **`ai`**. This package adds spatial session helpers and will own `/spatial` (or `/chat`) orchestration.

## Commands

```bash
yarn install
yarn workspace @local-hosting/spatial-ai typecheck
yarn workspace @local-hosting/spatial-ai test
```

See `docs/spatial-ai.md`.
