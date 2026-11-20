# Resilience geo + token eval (Pi / mobile)

Measures whether **session geolocation** (`placesNear` → narrowed `candidate_place_ids`) improves place recall and shrinks **compose** prompts versus listing every place in the vocab.

## Corpus (200 messages in `@local-hosting/compose`)

| YAML | Count | Regenerate |
|------|-------|------------|
| `compose/messages/resilience/resilience-synthetic.yaml` | 100 | `yarn workspace @local-hosting/compose messages:resilience:synthetic` |
| `compose/messages/resilience/resilience-crisislex.yaml` | 100 | `yarn workspace @local-hosting/compose messages:resilience:crisislex` (network) |

Everyday / short resilience sets: `messages/everyday/corpus.yaml`, `messages/resilience/corpus.yaml`.

Load API: `readMessageCorpus`, `loadResilienceBenchMessages` from `@local-hosting/compose/messages`.

Optional gold compose rubric on a row: `expect_compose.acceptable_action_ids`, `must_include_place_ids`.

After `messages:resilience:synthetic`, **`geo_rank1_id`** / **`geo_rank2_ids`** are set from `placesNear`; **`expected_place_id`** matches rank-1.

## Run

```bash
yarn workspace @local-hosting/spatial-ai eval:geo
yarn workspace @local-hosting/spatial-ai eval:models:live
yarn workspace @local-hosting/spatial-ai eval:spatial-chat:live
yarn workspace @local-hosting/spatial-ai eval:crisislex-live
yarn workspace @local-hosting/spatial-ai eval:show-translations
```

Set `LOCAL_AI_EVAL_COUNTERFACTUAL=1` on `eval:models:live` or `eval:crisislex-live` for geo-narrow vs full-vocab place rank-1 (slow). Reports always include a `counterfactual` block (`enabled: false` + hint when off).

`LOCAL_AI_EVAL_DEVICE_TARGET` (`pi` | `phone` | `desktop`) and optional `LOCAL_AI_EVAL_P95_BUDGET_MS` feed **`scorecard.recommendation`** tie-breaks in JSON (not a substitute for hand review).

Reports:

- `spatial-ai/eval/geo-token-eval-report.json` — geo + tokens (offline by default).
- `spatial-ai/eval/live-model-compare.json` — compose path with resident text + ranked places. Score **`geo_rank1_in_output_pct`**, **`action_acceptable_pct`**, **`places_non_empty_pct`**, and **`scorecard`** — not schema alone.
- `spatial-ai/eval/spatial-chat-live.json` — production **`runSpatialChat`** path (map + geo + compose). Action rubric uses runtime **`chat.label`**, not bench lexicon only.
- `spatial-ai/eval/crisislex-live.json` — CrisisLex lexicon slice + live compose on crisis questions (see `lexicon.compose_words_ok_pct`).