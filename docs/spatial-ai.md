# Local spatial AI (layer)

`@local-hosting/spatial-ai` **builds on** `@local-hosting/local-ai`.

| Package | Role |
|---------|------|
| `@local-hosting/local-ai` | Basic local AI: map + compose, loopback, IDs-only |
| `@local-hosting/spatial-ai` | Spatial session, place candidates, token ladder A→B |
| geokit / geotypes | Libraries for where / kind — **link, don’t merge** into `P_*` |

```text
many apps
   ├─ basic  →  @local-hosting/local-ai
   └─ spatial →  @local-hosting/spatial-ai → local-ai → compose → frames
                     └─ geokit (H3/haversine) · geotypes (slugs)
```

## Degradation (token ladder)

| Mode | When | Path | LLM tokens |
|------|------|------|------------|
| A | llama + GLiNER up | map → local place filter → compose | Low |
| B | models down | map lexicon + rules / composeWords | ~0 |
| C | thin pipe | compact frames + vocab tip | ~0 |

## Three layers — link, do not merge

| Layer | Package | Role |
|-------|---------|------|
| Spatial | geokit | where (H3, distance, …) |
| Kind | `@local-hosting/geotypes` | what kind |
| Instance | ai vocab `P_*` | which place |

## Non-goals

- Cloud geocode on the critical path
- Embedding geotypes catalog into `places[]`
- Forcing every app through spatial (use `@local-hosting/local-ai` alone when geo isn’t needed)
