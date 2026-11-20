# Resilience geo + token eval (Pi / mobile)

Measures whether **session geolocation** (`placesNear` → narrowed `candidate_place_ids`) improves place recall and shrinks **compose** prompts versus listing every place in the vocab.

## Corpus (200 messages in `@local-hosting/compose`)

| YAML | Count | Regenerate |
|------|-------|------------|
| `compose/messages/resilience/resilience-synthetic.yaml` | 100 | `yarn workspace @local-hosting/compose messages:resilience:synthetic` |
| `compose/messages/resilience/resilience-crisislex.yaml` | 100 | `yarn workspace @local-hosting/compose messages:resilience:crisislex` (network) |

Everyday / short resilience sets: `messages/everyday/corpus.yaml`, `messages/resilience/corpus.yaml`.

Family spatial live bench (session + geo gold): `messages/everyday/spatial.yaml` (`corpus: everyday-spatial`).

Family/neighbor **reports** (compose-first + lexicon gold): `messages/everyday/reports.yaml` (`corpus: everyday-reports`). Regenerate geo fields:

```bash
yarn workspace @local-hosting/compose messages:everyday:geo
# or per corpus:
yarn workspace @local-hosting/spatial-ai exec node --import tsx scripts/annotate-corpus-geo.ts everyday-spatial
yarn workspace @local-hosting/spatial-ai exec node --import tsx scripts/annotate-corpus-geo.ts everyday-reports
```

Resilience synthetic copy is neighbor/family SMS tone — regenerate with:

```bash
yarn workspace @local-hosting/compose messages:resilience:synthetic
```

Load API: `readMessageCorpus`, `loadResilienceBenchMessages` from `@local-hosting/compose/messages`.

Optional gold compose rubric on a row: `expect_compose.acceptable_action_ids`, `must_include_place_ids`.

After `messages:resilience:synthetic`, **`geo_rank1_id`** / **`geo_rank2_ids`** are set from `placesNear`; **`expected_place_id`** matches rank-1.

## Run

```bash
yarn workspace @local-hosting/spatial-ai eval:geo
yarn workspace @local-hosting/spatial-ai eval:models:live
yarn workspace @local-hosting/spatial-ai eval:spatial-chat:live
LOCAL_AI_EVAL_CORPUS=everyday-spatial yarn workspace @local-hosting/spatial-ai eval:spatial-chat:live
# or: eval:everyday-spatial:live
yarn workspace @local-hosting/spatial-ai eval:crisislex-live
yarn workspace @local-hosting/spatial-ai eval:show-translations
```

Set `LOCAL_AI_EVAL_COUNTERFACTUAL=1` on `eval:models:live` or `eval:crisislex-live` for geo-narrow vs full-vocab place rank-1 (slow). Reports always include a `counterfactual` block (`enabled: false` + hint when off).

`LOCAL_AI_EVAL_DEVICE_TARGET` (`pi` | `phone` | `desktop`) and optional `LOCAL_AI_EVAL_P95_BUDGET_MS` feed **`scorecard.recommendation`** tie-breaks in JSON (not a substitute for hand review).

## Compose-only model A/B (GGUF slot)

Map / report / everyday wording stay on **gliner2-base + lexicon + composeWords** — only the **compose** llama weights are swapped. Composer catalog is **`local-ai/models/MANIFEST.json`** (single source); `spatial-ai/eval/eval-models.ts` loads that list. HF `uri` + on-disk rename: [`local-ai/models/README.md`](../../local-ai/models/README.md).

| Slot | Composer |
| --- | --- |
| Ship default (`chosen_composer`) | `qwen3-0.6b-instruct` |
| Fallback (`fallback_composer`) | `qwen2.5-1.5b-instruct` |
| Runtime override | `LOCAL_AI_COMPOSE_MODEL=<name>` |

Subselect models (missing GGUF files are skipped automatically):

```bash
export LOCAL_AI_EVAL_COMPOSE_MODELS=qwen3-0.6b-instruct,qwen3-1.7b-instruct
```

Stack-aware runs (GLiNER default `LOCAL_AI_GLINER_BASE_URL` → `:8091`):

```bash
LOCAL_AI_EVAL_MAX_ROWS=34 yarn workspace @local-hosting/spatial-ai eval:spatial-chat:live
yarn workspace @local-hosting/spatial-ai eval:everyday-spatial:live
LOCAL_AI_EVAL_MAX_ROWS=34 yarn workspace @local-hosting/spatial-ai eval:models:live
```

Read JSON: `upstream.gliner_reachable`, `map_gliner_pct`, `intent.source` (model vs `rules_fallback`), **`p95_compose_latency_ms`** vs Pi budget (3500 ms default). Compare rank-1 / action on rows where **map and compose** both ran. Optional raw gap: `SPATIAL_AI_COMPOSE_POLICY=0` once per candidate.

**Practical order:** pull Qwen3-0.6B → everyday-spatial + 34-row spatial-chat with GLiNER healthy → within ~5pp of 1.7B on rank1/action, ship 0.6B primary with 1.7B fallback → if brittle with policy off, try Qwen2.5-1.5B → Gemma 2 2B only if you still need E2B-like place verbosity without ~3.2 GB RAM.

Reports:

- `spatial-ai/eval/geo-token-eval-report.json` — geo + tokens (offline by default).
- `spatial-ai/eval/live-model-compare.json` — compose path with resident text + ranked places. Score **`geo_rank1_in_output_pct`**, **`action_acceptable_pct`**, **`places_non_empty_pct`**, and **`scorecard`** — not schema alone.
- `spatial-ai/eval/spatial-chat-live.json` — production **`runSpatialChat`** path (map + geo + compose). Uses **`loadUpstreamAiConfig`** for GLiNER (`LOCAL_AI_GLINER_BASE_URL`, default `8091`); JSON includes **`upstream.gliner_reachable`** and per-row **`map_source`**. Action rubric uses runtime **`chat.label`**, not bench lexicon only.
- `spatial-ai/eval/crisislex-live.json` — CrisisLex lexicon slice + live compose on crisis questions (see `lexicon.compose_words_ok_pct`).