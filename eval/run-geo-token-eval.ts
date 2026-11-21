/**
 * Pi / mobile benchmark: geo pre-filter vs full place lists for compose prompt size + place recall.
 * Offline by default (no llama). Optional live compose with LOCAL_AI_EVAL_LIVE=1 on a tethered device.
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  composeWords,
  vocabularyToLabelPack,
  vocabularyToSymbolTable,
} from '@local-hosting/compose'
import { readMessageCorpus, type MessageRow } from '@local-hosting/compose/messages'
import {
  compose,
  estimateComposePromptTokens,
  mapQuestionLexicon,
  type EventSummary,
  type SupportedLanguage,
} from '@local-hosting/local-ai'
import {
  allResiliencePlaceIds,
  resilienceEvalVocabulary,
  RESILIENCE_EVAL_CENTROID,
} from './resilience-eval-vocab.js'
import { placesNear } from '../src/spatial/places-near.js'
import { resolveSpatialSession } from '../src/spatial/session-resolve.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

type BenchRow = {
  id: string
  text: string
  lang: SupportedLanguage
  kind: 'question' | 'report'
  expected_map_label?: string
  expected_place_id: string
  session: { lat?: number; lon?: number; geotype?: string }
  event_ref: string
  band: number
  source?: 'synthetic' | 'resilience-social'
}

type EvalRow = {
  id: string
  corpus: 'synthetic' | 'resilience-social'
  place_hit: boolean
  place_rank: number | null
  map_label_ok: boolean | null
  tokens_baseline: number
  tokens_geo: number
  token_savings_pct: number
  rules_only: boolean
  compose_source: string
}

function benchRowFromMessage(
  message: MessageRow,
  source: BenchRow['source'],
): BenchRow {
  if (
    !message.expected_place_id ||
    !message.event_ref ||
    message.band == null ||
    !message.session
  ) {
    throw new Error(`message ${message.id}: missing spatial eval fields in compose YAML`)
  }
  return {
    id: message.id,
    text: message.text,
    lang: message.lang,
    kind: message.kind,
    expected_map_label: message.expected_map_label,
    expected_place_id: message.expected_place_id,
    session: message.session,
    event_ref: message.event_ref,
    band: message.band,
    source,
  }
}

function loadCorpus(): BenchRow[] {
  const synthetic = readMessageCorpus('resilience-synthetic')
  const social = readMessageCorpus('resilience-social')
  return [
    ...synthetic.messages.map((m) => benchRowFromMessage(m, 'synthetic')),
    ...social.messages.map((m) => benchRowFromMessage(m, 'resilience-social')),
  ]
}

function sliceMetrics(rows: EvalRow[]): {
  place_recall_at_8: number
  map_label_accuracy_pct: number | null
  avg_token_savings_pct: number
} {
  const n = rows.length
  if (n === 0) {
    return { place_recall_at_8: 0, map_label_accuracy_pct: null, avg_token_savings_pct: 0 }
  }
  const placeHits = rows.filter((r) => r.place_hit).length
  const mapRows = rows.filter((r) => r.map_label_ok !== null)
  const mapOk = mapRows.filter((r) => r.map_label_ok).length
  const baseline = rows.reduce((s, r) => s + r.tokens_baseline, 0)
  const geo = rows.reduce((s, r) => s + r.tokens_geo, 0)
  return {
    place_recall_at_8: Math.round((placeHits / n) * 1000) / 10,
    map_label_accuracy_pct:
      mapRows.length > 0 ? Math.round((mapOk / mapRows.length) * 1000) / 10 : null,
    avg_token_savings_pct:
      baseline > 0 ? Math.round(((baseline - geo) / baseline) * 1000) / 10 : 0,
  }
}

function baseEvent(
  row: BenchRow,
  candidate_place_ids: string[],
  vocabPlaceIds: string[],
): EventSummary {
  return {
    event_id: row.id,
    event_ref: row.event_ref,
    h3_cell: RESILIENCE_EVAL_CENTROID.h3_cell,
    band: row.band as 1 | 2 | 3 | 4,
    trend: 'rising',
    sensors_agreeing: 2,
    started_utc: '2026-08-14T12:00:00Z',
    reports: [],
    candidate_action_ids: ['A_EVAC', 'A_SHELTER', 'A_STAY', 'A_HIGHER'],
    candidate_place_ids:
      candidate_place_ids.length > 0 ? candidate_place_ids : vocabPlaceIds.slice(0, 8),
    candidate_resource_ids: ['R_KIT'],
    actors: ['PR_RESIDENT'],
  }
}

function shouldRulesOnly(confidence: number, label: string): boolean {
  if (process.env.SPATIAL_AI_RULES_ONLY?.trim() === '1') return true
  return label !== 'other' && confidence >= 0.85
}

async function main(): Promise<void> {
  const vocab = resilienceEvalVocabulary()
  const symbolTable = vocabularyToSymbolTable(vocab)
  const labelPack = vocabularyToLabelPack(vocab)
  const allPlaces = allResiliencePlaceIds(vocab)
  const rows = loadCorpus()

  const live = process.env.LOCAL_AI_EVAL_LIVE === '1'
  const llamaBaseUrl = process.env.LOCAL_AI_LLAMA_BASE_URL ?? 'http://127.0.0.1:8080'
  const profile = process.env.EVAL_DEVICE_PROFILE ?? 'pi-mobile'

  const evalRows: EvalRow[] = []
  let placeHits = 0
  let mapCorrect = 0
  let mapTotal = 0
  let tokensBaselineSum = 0
  let tokensGeoSum = 0
  let rulesOnlyCount = 0
  let liveComposeOk = 0

  for (const row of rows) {
    const session = resolveSpatialSession(row.session)
    const hits = placesNear(vocab, session)
    const geoPlaceIds = hits.map((h) => h.id)
    const hitIndex = hits.findIndex((h) => h.id === row.expected_place_id)

    if (hitIndex >= 0) placeHits += 1

    let map_label_ok: boolean | null = null
    if (row.kind === 'question' && row.expected_map_label) {
      mapTotal += 1
      const mapped = mapQuestionLexicon(row.text, row.lang)
      map_label_ok = mapped.label === row.expected_map_label
      if (map_label_ok) mapCorrect += 1
    }

    const lexicon = mapQuestionLexicon(row.text, row.lang)
    const rules_only = shouldRulesOnly(lexicon.confidence, lexicon.label)
    if (rules_only) rulesOnlyCount += 1

    const eventBaseline = baseEvent(row, allPlaces, allPlaces)
    const eventGeo = baseEvent(row, geoPlaceIds, allPlaces)
    const tokens_baseline = estimateComposePromptTokens(vocab, eventBaseline).tokens_est
    const tokens_geo = estimateComposePromptTokens(vocab, eventGeo).tokens_est
    tokensBaselineSum += tokens_baseline
    tokensGeoSum += tokens_geo
    const token_savings_pct =
      tokens_baseline > 0
        ? Math.round(((tokens_baseline - tokens_geo) / tokens_baseline) * 1000) / 10
        : 0

    let compose_source = rules_only ? 'rules_skip_llama' : 'would_call_llama'
    if (live && row.kind === 'question') {
      try {
        const intent = await compose(
          { vocab, event: eventGeo },
          {
            llamaBaseUrl,
            timeoutMs: Number(process.env.LOCAL_AI_EVAL_TIMEOUT_MS ?? 30_000),
            rulesOnlyForce: rules_only,
          },
        )
        compose_source = intent.source
        if (intent.source === 'model' || intent.source === 'rules_fallback') {
          liveComposeOk += 1
        }
      } catch {
        compose_source = 'live_error'
      }
    }

    if (row.kind === 'report') {
      const words = composeWords(row.text, symbolTable, labelPack, row.lang)
      compose_source = words.ok ? 'compose_words' : 'compose_words_miss'
    }

    evalRows.push({
      id: row.id,
      corpus: row.source ?? 'synthetic',
      place_hit: hitIndex >= 0,
      place_rank: hitIndex >= 0 ? hitIndex + 1 : null,
      map_label_ok,
      tokens_baseline,
      tokens_geo,
      token_savings_pct,
      rules_only,
      compose_source,
    })
  }

  const syntheticRows = evalRows.filter((r) => r.corpus === 'synthetic')
  const socialRows = evalRows.filter((r) => r.corpus === 'resilience-social')

  const report = {
    profile,
    corpus_size: rows.length,
    corpus_breakdown: {
      synthetic: { count: 100, metrics: sliceMetrics(syntheticRows) },
      'resilience-social': {
        count: 100,
        metrics: sliceMetrics(socialRows),
        upstream: 'github.com/sajao/CrisisLex (CrisisLexT6, on-topic)',
      },
    },
    place_recall_at_8: Math.round((placeHits / rows.length) * 1000) / 10,
    map_label_accuracy_pct:
      mapTotal > 0 ? Math.round((mapCorrect / mapTotal) * 1000) / 10 : null,
    avg_compose_prompt_tokens_baseline: Math.round(tokensBaselineSum / rows.length),
    avg_compose_prompt_tokens_geo: Math.round(tokensGeoSum / rows.length),
    avg_token_savings_pct: Math.round(
      ((tokensBaselineSum - tokensGeoSum) / tokensBaselineSum) * 1000,
    ) / 10,
    rules_only_rate_pct: Math.round((rulesOnlyCount / rows.length) * 1000) / 10,
    live_eval: live,
    live_compose_completed: live ? liveComposeOk : null,
    pi_mobile_recommended: {
      LOCAL_AI_GGUF: 'qwen3-0.6b-instruct-q4_k_m or qwen3-1.7b-instruct-q4_k_m',
      LOCAL_AI_CTX_SIZE: '4096',
      LOCAL_AI_THREADS: '4 (Pi) / 2–4 (phone)',
      SPATIAL_AI_START_GLINER: '0',
      SPATIAL_AI_RULES_ONLY: '1 for field tests',
    },
  }

  const outPath = path.join(repoRoot, 'eval', 'geo-token-eval-report.json')
  writeFileSync(outPath, JSON.stringify({ report, rows: evalRows }, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
  console.log(`Detail → ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})