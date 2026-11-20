import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { compose } from '@local-hosting/local-ai'
import {
  actionsInAcceptableSet,
  deriveComposeRubric,
  pct,
  requiredActionsSatisfied,
} from './compose-scoring.js'
import {
  applyIntentComposePolicy,
  narrowEventForLabel,
} from '../src/spatial/compose-policy.js'
import { buildCounterfactualReport } from './counterfactual-report.js'
import type { EvalModelSpec } from './eval-models.js'
import { placeOutputStats } from './scorecard.js'
import {
  allBenchPlaceIds,
  buildBenchEvent,
  CANDIDATE_ACTION_IDS,
  placeRankingHints,
  resilienceBenchVocabulary,
  type QuestionBenchContext,
} from './resilience-question-bench.js'

export type LiveComposeRowEval = {
  id: string
  text: string
  geo_rank1_id?: string
  map_label_detected: string
  acceptable_action_ids: string[]
  source: string
  latency_ms: number | null
  picks_geo_rank1: boolean | null
  picks_geo_top2: boolean | null
  action_acceptable: boolean | null
  required_actions_met: boolean | null
  must_include_places_met: boolean | null
  counterfactual_full_picks_rank1: boolean | null
  action_ids: string[]
  place_ids: string[]
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx] ?? 0
}

function scorePlaces(
  ctx: QuestionBenchContext,
  source: string,
  place_ids: string[],
): Pick<
  LiveComposeRowEval,
  'picks_geo_rank1' | 'picks_geo_top2' | 'must_include_places_met'
> {
  if (source !== 'model' || !ctx.geo_rank1_id) {
    return {
      picks_geo_rank1: null,
      picks_geo_top2: null,
      must_include_places_met: null,
    }
  }
  const top2 = new Set(ctx.row.geo_rank2_ids ?? ctx.geo_hits.slice(0, 2).map((h) => h.id))
  const must = ctx.row.expect_compose?.must_include_place_ids ?? [ctx.geo_rank1_id]
  return {
    picks_geo_rank1: place_ids.includes(ctx.geo_rank1_id),
    picks_geo_top2: place_ids.some((id) => top2.has(id)),
    must_include_places_met: must.every((id) => place_ids.includes(id)),
  }
}

export async function runLiveComposeModel(
  model: EvalModelSpec,
  contexts: QuestionBenchContext[],
  port: number,
  timeoutMs: number,
  counterfactual: boolean,
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

  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/health`)
      if (res.ok) break
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500))
  }

  const vocab = resilienceBenchVocabulary()
  const allPlaces = allBenchPlaceIds()
  const baseUrl = `http://127.0.0.1:${port}`

  let schema_valid = 0
  let rules_fallback = 0
  let failed = 0
  let latency_sum = 0
  let semantic_scored = 0
  let action_acceptable_n = 0
  let required_met_n = 0
  let rank1_n = 0
  let top2_n = 0
  let must_place_met_n = 0
  let must_place_scored = 0
  let cf_rank1_geo = 0
  let cf_rank1_full = 0
  let cf_scored = 0
  const latencies: number[] = []
  const row_evals: LiveComposeRowEval[] = []

  for (const ctx of contexts) {
    const composeBase = {
      vocab,
      resident_text: ctx.row.text,
      place_ranking: placeRankingHints(ctx.geo_hits),
    }
    try {
      const rubric = deriveComposeRubric(
        vocab,
        ctx.row.event_ref,
        ctx.row.band,
        [...CANDIDATE_ACTION_IDS],
        ctx.map_label_detected,
        ctx.row.expect_compose?.acceptable_action_ids,
      )
      const geoIds =
        ctx.geo_place_ids.length > 0 ? ctx.geo_place_ids : allPlaces.slice(0, 8)
      const composeEvent = narrowEventForLabel(
        buildBenchEvent(ctx, geoIds),
        rubric,
      )
      let intent = applyIntentComposePolicy(
        await compose(
          {
            ...composeBase,
            event: composeEvent,
            question_label: ctx.map_label_detected,
          },
          {
            llamaBaseUrl: baseUrl,
            timeoutMs,
            rulesOnlyForce: false,
            composerName: model.name,
          },
        ),
        ctx.map_label_detected,
        rubric,
        ctx.geo_rank1_id,
        geoIds,
      )
      latency_sum += intent.latency_ms
      latencies.push(intent.latency_ms)

      const actor = intent.per_actor[0]
      const action_ids = actor?.action_ids ?? []
      const place_ids = actor?.place_ids ?? []
      const placeScores = scorePlaces(ctx, intent.source, place_ids)

      let counterfactual_full_picks_rank1: boolean | null = null
      if (counterfactual && ctx.geo_rank1_id && intent.source === 'model') {
        cf_scored += 1
        if (placeScores.picks_geo_rank1) cf_rank1_geo += 1
        const full = await compose(
          {
            ...composeBase,
            place_ranking: undefined,
            event: buildBenchEvent(ctx, allPlaces),
          },
          {
            llamaBaseUrl: baseUrl,
            timeoutMs,
            rulesOnlyForce: false,
            composerName: model.name,
          },
        )
        const fullPlaces = full.per_actor[0]?.place_ids ?? []
        counterfactual_full_picks_rank1 = fullPlaces.includes(ctx.geo_rank1_id)
        if (counterfactual_full_picks_rank1) cf_rank1_full += 1
      }

      const action_acceptable =
        intent.source === 'model'
          ? actionsInAcceptableSet(action_ids, rubric.acceptable_action_ids)
          : null
      const required_actions_met =
        intent.source === 'model'
          ? requiredActionsSatisfied(action_ids, rubric.required_any_action_ids)
          : null

      if (intent.source === 'model') {
        schema_valid += 1
        semantic_scored += 1
        if (action_acceptable) action_acceptable_n += 1
        if (required_actions_met) required_met_n += 1
        if (placeScores.picks_geo_rank1) rank1_n += 1
        if (placeScores.picks_geo_top2) top2_n += 1
        if (placeScores.must_include_places_met !== null) {
          must_place_scored += 1
          if (placeScores.must_include_places_met) must_place_met_n += 1
        }
      } else if (intent.source === 'rules_fallback') {
        rules_fallback += 1
      } else {
        failed += 1
      }

      row_evals.push({
        id: ctx.row.id,
        text: ctx.row.text,
        geo_rank1_id: ctx.geo_rank1_id,
        map_label_detected: ctx.map_label_detected,
        acceptable_action_ids: rubric.acceptable_action_ids,
        source: intent.source,
        latency_ms: intent.latency_ms,
        ...placeScores,
        action_acceptable,
        required_actions_met,
        counterfactual_full_picks_rank1,
        action_ids,
        place_ids,
      })
    } catch {
      failed += 1
      row_evals.push({
        id: ctx.row.id,
        text: ctx.row.text,
        geo_rank1_id: ctx.geo_rank1_id,
        map_label_detected: ctx.map_label_detected,
        acceptable_action_ids: [],
        source: 'error',
        latency_ms: null,
        picks_geo_rank1: null,
        picks_geo_top2: null,
        action_acceptable: null,
        required_actions_met: null,
        must_include_places_met: null,
        counterfactual_full_picks_rank1: null,
        action_ids: [],
        place_ids: [],
      })
    }
  }

  child.kill('SIGTERM')
  await new Promise((r) => setTimeout(r, 800))

  const sortedLat = [...latencies].sort((a, b) => a - b)
  const n = contexts.length
  const placeStats = placeOutputStats(row_evals)

  return {
    model: model.name,
    gguf: model.gguf.split('/').pop(),
    rows: n,
    schema_valid_model: schema_valid,
    compose_rules_fallback: rules_fallback,
    compose_failed: failed,
    schema_valid_rate_pct: pct(schema_valid, n),
    action_acceptable_pct: pct(action_acceptable_n, semantic_scored),
    required_actions_met_pct: pct(required_met_n, semantic_scored),
    geo_rank1_in_output_pct: pct(rank1_n, semantic_scored),
    geo_top2_in_output_pct: pct(top2_n, semantic_scored),
    must_include_place_pct: pct(must_place_met_n, must_place_scored),
    counterfactual: buildCounterfactualReport(
      counterfactual,
      cf_rank1_geo,
      cf_rank1_full,
      cf_scored,
    ),
    ...placeStats,
    avg_latency_ms: n > 0 ? Math.round(latency_sum / n) : 0,
    p50_latency_ms: percentile(sortedLat, 50),
    p95_latency_ms: percentile(sortedLat, 95),
    row_evals,
  }
}