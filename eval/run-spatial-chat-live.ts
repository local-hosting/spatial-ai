/**
 * Live eval through runSpatialChat (map + geo + compose), Gemma vs Qwen.
 *
 * Action rubric uses runtime `chat.label` (map path), not bench-time lexicon only.
 */
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  actionsInAcceptableSet,
  deriveComposeRubric,
  pct,
  requiredActionsSatisfied,
} from './compose-scoring.js'
import { buildCounterfactualReport } from './counterfactual-report.js'
import {
  evalComposeModels,
  evalCounterfactualEnabled,
  type EvalModelSpec,
} from './eval-models.js'
import { pairedCompareRows, type PairedRowSlice } from './paired-compare.js'
import {
  allBenchPlaceIds,
  buildBenchEvent,
  buildQuestionContexts,
  CANDIDATE_ACTION_IDS,
  corpusBaseline,
  loadBenchQuestions,
  resilienceBenchVocabulary,
} from './resilience-question-bench.js'
import { buildScorecard, placeOutputStats, type ModelEvalHeadline } from './scorecard.js'
import { runSpatialChat } from '../src/spatial/spatial-chat.js'
import { evalBenchCorpusId } from './eval-corpus.js'
import { loadEvalUpstreamConfig, snapshotEvalUpstream } from './eval-upstream.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

type SpatialChatRowEval = {
  id: string
  text: string
  geo_rank1_id?: string
  map_label: string
  map_label_lexicon: string
  map_source: string
  map_expected?: string
  map_ok: boolean | null
  map_used_gliner: boolean
  spatial_place_ids: string[]
  source: string
  picks_geo_rank1: boolean | null
  intent_place_ids: string[]
  action_ids: string[]
  action_acceptable: boolean | null
  required_actions_met: boolean | null
  acceptable_action_ids: string[]
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx] ?? 0
}

async function waitHealthy(port: number): Promise<void> {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) return
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`llama not healthy on :${port}`)
}

async function runModel(
  model: EvalModelSpec,
  contexts: ReturnType<typeof buildQuestionContexts>,
  port: number,
  upstream: ReturnType<typeof loadEvalUpstreamConfig>,
): Promise<Record<string, unknown>> {
  if (!existsSync(model.gguf)) {
    return { model: model.name, skipped: true, reason: `missing ${model.gguf}` }
  }

  const child = spawn(
    process.env.LOCAL_AI_LLAMA_SERVER_BIN ?? 'llama-server',
    [
      '-m',
      model.gguf,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '-c',
      process.env.LOCAL_AI_CTX_SIZE ?? '4096',
      '-np',
      '1',
      '-t',
      process.env.LOCAL_AI_THREADS ?? '6',
      '-a',
      model.alias,
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  await waitHealthy(port)

  const vocab = resilienceBenchVocabulary()
  const llamaBaseUrl = `http://127.0.0.1:${port}`
  const { glinerBaseUrl, composeTimeoutMs, mapTimeoutMs } = upstream

  let map_ok = 0
  let map_gliner = 0
  let map_total = 0
  let rank1 = 0
  let model_n = 0
  let action_acceptable_n = 0
  let required_met_n = 0
  const latencies: number[] = []
  const row_evals: SpatialChatRowEval[] = []

  for (const ctx of contexts) {
    map_total += 1
    const chat = await runSpatialChat(
      {
        text: ctx.row.text,
        lang: ctx.row.lang,
        vocab,
        session: ctx.session,
        event: buildBenchEvent(
          ctx,
          ctx.geo_place_ids.length > 0 ? ctx.geo_place_ids : allBenchPlaceIds().slice(0, 8),
        ),
        compose: { rules_only: false },
      },
      {
        llamaBaseUrl,
        glinerBaseUrl,
        composeTimeoutMs,
        mapTimeoutMs,
        composerName: model.name,
      },
    )

    if (chat.map_source === 'spatial_map') map_gliner += 1

    const rubric = deriveComposeRubric(
      vocab,
      ctx.row.event_ref,
      ctx.row.band,
      [...CANDIDATE_ACTION_IDS],
      chat.label,
      ctx.row.expect_compose?.acceptable_action_ids,
    )

    if (ctx.row.expected_map_label && chat.label === ctx.row.expected_map_label) {
      map_ok += 1
    }

    const intentSource = chat.intent?.source
    const place_ids = chat.intent?.per_actor[0]?.place_ids ?? []
    const picks_rank1 = ctx.geo_rank1_id ? place_ids.includes(ctx.geo_rank1_id) : null
    const action_ids = chat.action_ids

    let action_acceptable: boolean | null = null
    let required_actions_met: boolean | null = null
    if (intentSource === 'model') {
      model_n += 1
      if (picks_rank1) rank1 += 1
      latencies.push(chat.intent!.latency_ms)
      action_acceptable = actionsInAcceptableSet(action_ids, rubric.acceptable_action_ids)
      required_actions_met = requiredActionsSatisfied(
        action_ids,
        rubric.required_any_action_ids,
      )
      if (action_acceptable) action_acceptable_n += 1
      if (required_actions_met) required_met_n += 1
    }

    row_evals.push({
      id: ctx.row.id,
      text: ctx.row.text,
      geo_rank1_id: ctx.geo_rank1_id,
      map_label: chat.label,
      map_label_lexicon: ctx.map_label_detected,
      map_source: chat.map_source,
      map_used_gliner: chat.map_source === 'spatial_map',
      map_expected: ctx.row.expected_map_label,
      map_ok: ctx.row.expected_map_label ? chat.label === ctx.row.expected_map_label : null,
      spatial_place_ids: chat.place_ids,
      source: chat.intent?.source ?? chat.source,
      picks_geo_rank1: picks_rank1,
      intent_place_ids: place_ids,
      action_ids,
      action_acceptable,
      required_actions_met,
      acceptable_action_ids: rubric.acceptable_action_ids,
    })
  }

  child.kill('SIGTERM')

  const sorted = [...latencies].sort((a, b) => a - b)
  const placeStats = placeOutputStats(
    row_evals.map((r) => ({ place_ids: r.intent_place_ids, source: r.source })),
  )

  const counterfactual = buildCounterfactualReport(evalCounterfactualEnabled(), 0, 0, 0)

  return {
    model: model.name,
    map_label_accuracy_pct: pct(map_ok, map_total),
    map_gliner_pct: pct(map_gliner, map_total),
    geo_rank1_in_compose_pct: pct(rank1, model_n),
    action_acceptable_pct: pct(action_acceptable_n, model_n),
    required_actions_met_pct: pct(required_met_n, model_n),
    spatial_rows: contexts.length,
    compose_model_rows: model_n,
    avg_compose_latency_ms:
      latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0,
    p50_compose_latency_ms: percentile(sorted, 50),
    p95_compose_latency_ms: percentile(sorted, 95),
    counterfactual,
    ...placeStats,
    row_evals,
  }
}

function toPairedSlice(rows: SpatialChatRowEval[]): PairedRowSlice[] {
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    action_ids: r.action_ids,
    place_ids: r.intent_place_ids,
    model_picked_expected_place: r.picks_geo_rank1,
    action_acceptable: r.action_acceptable,
    required_actions_met: r.required_actions_met,
    places_subset_of_geo: null,
  }))
}

async function main(): Promise<void> {
  const max = Number(process.env.LOCAL_AI_EVAL_MAX_ROWS ?? 30)
  const port = Number(process.env.LOCAL_AI_LLAMA_PORT ?? 8080)
  const corpusId = evalBenchCorpusId()
  const upstream = loadEvalUpstreamConfig()
  const upstream_snapshot = await snapshotEvalUpstream()
  if (!upstream_snapshot.gliner_reachable) {
    console.error(
      `gliner not reachable at ${upstream.glinerBaseUrl} — eval uses lexicon fallback (${upstream_snapshot.gliner_probe_error ?? 'no /health'})`,
    )
  }
  const contexts = buildQuestionContexts(loadBenchQuestions(max, corpusId))

  const results: Record<string, unknown>[] = []
  for (const model of evalComposeModels()) {
    console.error(`\n=== spatial-chat live: ${model.name} ===`)
    const summary = await runModel(model, contexts, port, upstream)
    results.push(summary)
    const { row_evals, ...headline } = summary
    console.error(JSON.stringify(headline, null, 2))
    void row_evals
  }

  let paired_compare = null
  if (
    results.length === 2 &&
    results.every((r) => Array.isArray(r.row_evals) && !r.skipped)
  ) {
    paired_compare = pairedCompareRows(
      String(results[0]!.model),
      String(results[1]!.model),
      toPairedSlice(results[0]!.row_evals as SpatialChatRowEval[]),
      toPairedSlice(results[1]!.row_evals as SpatialChatRowEval[]),
    )
  }

  const headlines: ModelEvalHeadline[] = results.map((r) => {
    const { row_evals: _rows, ...h } = r
    void _rows
    return h as ModelEvalHeadline
  })

  const payload = {
    profile: 'spatial-chat-live',
    corpus: corpusId,
    path: 'spatial-chat (map label drives action rubric)',
    ran_at: new Date().toISOString(),
    upstream: upstream_snapshot,
    corpus_baseline: corpusBaseline(contexts),
    paired_compare,
    scorecard: buildScorecard(headlines, paired_compare),
    results: results.map(({ row_evals, ...h }) => h),
    detail: results.map((r) => ({ model: r.model, row_evals: r.row_evals })),
  }

  const outPath = path.join(repoRoot, 'eval', 'spatial-chat-live.json')
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(JSON.stringify(payload, null, 2))
  console.error(`Wrote ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})