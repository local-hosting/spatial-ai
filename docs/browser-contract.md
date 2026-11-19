# Browser offline contract

Apps (web, native shells) talk to **loopback spatial AI**, not cloud geocode or remote LLM on the critical path.

## Services

| Port | Package | Role |
|------|---------|------|
| `8090` | `@local-hosting/local-ai` | Basic map + compose |
| `8092` | `@local-hosting/spatial-ai` | `POST /spatial` or `POST /chat` |
| `8080` | llama | Composer (optional) |
| `8091` | GLiNER sidecar | Mapper (optional) |

## Session bag

Browsers pass only what they already have offline:

```json
{
  "session": {
    "h3_cell": "88283472b3fffff",
    "lat": 40.7128,
    "lon": -74.006,
    "geotype": "shelter",
    "limit": 8
  }
}
```

Geokit on the host derives `h3_cell` from `lat`/`lon` when omitted.

## Chat request

```http
POST http://127.0.0.1:8092/spatial
Content-Type: application/json

{
  "text": "where can I go that is safe?",
  "lang": "en",
  "vocab": { "...": "community pack ids only" },
  "session": { "lat": 40.7128, "lon": -74.006 },
  "compose": { "rules_only": true }
}
```

Optional `event` (elevated IDs-only summary) enables compose after map + `placesNear`.

## Geokit UI prefetch

- Use `@local-hosting/geokit` offline tile/cache contracts in the browser.
- Do not call Mapbox/MapTiler/Google place search for disaster mode.
- Set `onlineOk` in app config before enabling cloud providers (see geokit env docs).

## Degradation

1. Neural map + compose when llama/GLiNER up
2. Lexicon + rules (`rules_only: true`) — zero LLM tokens
3. Thin wire frames + vocab tip only