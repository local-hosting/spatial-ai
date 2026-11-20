import type { CounterfactualReport } from './counterfactual-report.js'
import { evalDeviceTarget, evalP95BudgetMs, type EvalModelSpec } from './eval-models.js'
import { pct } from './compose-scoring.js'
import type { PairedCompareSummary } from './paired-compare.js'

export type ModelEvalHeadline = {
  model: string
  skipped?: boolean
  geo_rank1_in_output_pct?: number | null
  geo_rank1_in_compose_pct?: number | null
  action_acceptable_pct?: number | null
  p95_latency_ms?: number
  p95_compose_latency_ms?: number
  counterfactual?: CounterfactualReport | null
  places_non_empty_pct?: number | null
  avg_place_count?: number | null
}

export type ScorecardWeights = {
  geo_lift_rank1_pts: number
  geo_rank1_pct: number
  action_acceptable_pct: number
  p95_latency_ms: number
}

export type ScorecardRecommendation = {
  device_target: 'pi' | 'phone' | 'desktop'
  p95_budget_ms: number
  weights: ScorecardWeights
  /** Default ship candidate for MANIFEST.json — not proof of production quality. */
  chosen_composer: string | null
  fallback_composer: string | null
  confidence: 'high' | 'medium' | 'low' | 'insufficient_data'
  rationale: string[]
  tie_break: {
    action_edge_pp: number
    rank1_edge_pp: number
    rank1_similar_pp: number
  }
  models: Array<{
    model: string
    geo_rank1_pct: number | null
    action_acceptable_pct: number | null
    p95_ms: number | null
    geo_lift_rank1_pts: number | null
    places_non_empty_pct: number | null
    avg_place_count: number | null
  }>
  paired_compare?: PairedCompareSummary | null
}

const ACTION_EDGE_PP = 15
const RANK1_EDGE_PP = 20
const RANK1_SIMILAR_PP = 10

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function rank1Of(h: ModelEvalHeadline): number | null {
  return num(h.geo_rank1_in_compose_pct) ?? num(h.geo_rank1_in_output_pct)
}

function p95Of(h: ModelEvalHeadline): number | null {
  return num(h.p95_compose_latency_ms) ?? num(h.p95_latency_ms)
}

function liftOf(h: ModelEvalHeadline): number | null {
  const cf = h.counterfactual
  if (!cf || !cf.enabled) return null
  return num(cf.geo_lift_rank1_pts)
}

function isQwen(name: string): boolean {
  return name.includes('qwen')
}

function isGemma(name: string): boolean {
  return name.includes('gemma')
}

export function placeOutputStats(
  rowEvals: Array<{ place_ids: string[]; source: string }>,
): { places_non_empty_pct: number | null; avg_place_count: number | null; model_rows: number } {
  const modelRows = rowEvals.filter((r) => r.source === 'model')
  const nonEmpty = modelRows.filter((r) => r.place_ids.length > 0).length
  const totalPlaces = modelRows.reduce((s, r) => s + r.place_ids.length, 0)
  return {
    places_non_empty_pct: pct(nonEmpty, modelRows.length),
    avg_place_count:
      modelRows.length > 0
        ? Math.round((totalPlaces / modelRows.length) * 10) / 10
        : null,
    model_rows: modelRows.length,
  }
}

export function buildScorecard(
  headlines: ModelEvalHeadline[],
  paired_compare?: PairedCompareSummary | null,
): ScorecardRecommendation {
  const device_target = evalDeviceTarget()
  const p95_budget_ms = evalP95BudgetMs(device_target)
  const weights: ScorecardWeights =
    device_target === 'desktop'
      ? {
          geo_lift_rank1_pts: 1,
          geo_rank1_pct: 2,
          action_acceptable_pct: 3,
          p95_latency_ms: 1,
        }
      : {
          geo_lift_rank1_pts: 2,
          geo_rank1_pct: 3,
          action_acceptable_pct: 2,
          p95_latency_ms: 3,
        }

  const active = headlines.filter((h) => !h.skipped)
  const models = active.map((h) => ({
    model: h.model,
    geo_rank1_pct: rank1Of(h),
    action_acceptable_pct: num(h.action_acceptable_pct),
    p95_ms: p95Of(h),
    geo_lift_rank1_pts: liftOf(h),
    places_non_empty_pct: num(h.places_non_empty_pct),
    avg_place_count: num(h.avg_place_count),
  }))

  const rationale: string[] = []
  let chosen_composer: string | null = null
  let fallback_composer: string | null = null
  let confidence: ScorecardRecommendation['confidence'] = 'insufficient_data'

  if (active.length < 2) {
    rationale.push('Need two runnable models for a paired composer recommendation.')
    if (active.length === 1) {
      chosen_composer = active[0]!.model
      confidence = 'low'
      rationale.push(`Only ${active[0]!.model} ran; treat as provisional default.`)
    }
    return {
      device_target,
      p95_budget_ms,
      weights,
      chosen_composer,
      fallback_composer,
      confidence,
      rationale,
      tie_break: {
        action_edge_pp: ACTION_EDGE_PP,
        rank1_edge_pp: RANK1_EDGE_PP,
        rank1_similar_pp: RANK1_SIMILAR_PP,
      },
      models,
      paired_compare: paired_compare ?? null,
    }
  }

  const qwen = active.find((h) => isQwen(h.model))
  const gemma = active.find((h) => isGemma(h.model))
  if (!qwen || !gemma) {
    rationale.push('Scorecard tie-break expects gemma-* and qwen* result rows.')
    confidence = 'low'
    return {
      device_target,
      p95_budget_ms,
      weights,
      chosen_composer,
      fallback_composer,
      confidence,
      rationale,
      tie_break: {
        action_edge_pp: ACTION_EDGE_PP,
        rank1_edge_pp: RANK1_EDGE_PP,
        rank1_similar_pp: RANK1_SIMILAR_PP,
      },
      models,
      paired_compare: paired_compare ?? null,
    }
  }

  const qAction = num(qwen.action_acceptable_pct) ?? 0
  const gAction = num(gemma.action_acceptable_pct) ?? 0
  const qRank = rank1Of(qwen) ?? 0
  const gRank = rank1Of(gemma) ?? 0
  const qP95 = p95Of(qwen)
  const gP95 = p95Of(gemma)
  const qLift = liftOf(qwen)
  const rankSimilar = Math.abs(qRank - gRank) <= RANK1_SIMILAR_PP

  if (
    qAction >= gAction + ACTION_EDGE_PP &&
    rankSimilar
  ) {
    chosen_composer = qwen.model
    fallback_composer = gemma.model
    confidence = 'high'
    rationale.push(
      `Qwen action_acceptable (${qAction}%) ≥ Gemma (${gAction}%) + ${ACTION_EDGE_PP}pp with similar rank-1 (${qRank}% vs ${gRank}%).`,
    )
  } else if (gRank > qRank + RANK1_EDGE_PP) {
    const gemmaLatencyOk =
      gP95 == null || gP95 <= p95_budget_ms
    if (gemmaLatencyOk) {
      chosen_composer = gemma.model
      fallback_composer = qwen.model
      confidence = 'medium'
      rationale.push(
        `Gemma rank-1 (${gRank}%) > Qwen (${qRank}%) + ${RANK1_EDGE_PP}pp with p95 within ${p95_budget_ms}ms budget.`,
      )
    } else {
      rationale.push(
        `Gemma leads rank-1 by ${RANK1_EDGE_PP}+pp but p95 ${gP95}ms exceeds ${device_target} budget ${p95_budget_ms}ms.`,
      )
    }
  }

  if (!chosen_composer) {
    if (qP95 != null && gP95 != null && qP95 <= p95_budget_ms && gP95 > p95_budget_ms) {
      chosen_composer = qwen.model
      fallback_composer = gemma.model
      confidence = 'medium'
      rationale.push('No clear quality tie-break; Qwen fits latency budget on target device.')
    } else if (qAction > gAction) {
      chosen_composer = qwen.model
      fallback_composer = gemma.model
      confidence = 'low'
      rationale.push(
        `Weak edge: Qwen action_acceptable ${qAction}% vs Gemma ${gAction}% (below +${ACTION_EDGE_PP}pp rule).`,
      )
    } else if (gAction > qAction) {
      chosen_composer = gemma.model
      fallback_composer = qwen.model
      confidence = 'low'
      rationale.push(
        `Weak edge: Gemma action_acceptable ${gAction}% vs Qwen ${qAction}% (below +${ACTION_EDGE_PP}pp rule).`,
      )
    } else {
      rationale.push('Metrics too close for automatic tie-break; review row_evals and counterfactual lift.')
    }
  }

  if (qLift != null && qLift <= 0) {
    rationale.push(
      'Counterfactual geo_lift ≤ 0: narrowing saves tokens more than rank-1 quality — prioritize prompt/ranking work.',
    )
  }

  return {
    device_target,
    p95_budget_ms,
    weights,
    chosen_composer,
    fallback_composer,
    confidence,
    rationale,
    tie_break: {
      action_edge_pp: ACTION_EDGE_PP,
      rank1_edge_pp: RANK1_EDGE_PP,
      rank1_similar_pp: RANK1_SIMILAR_PP,
    },
    models,
    paired_compare: paired_compare ?? null,
  }
}

export function modelSpecsLabel(models: EvalModelSpec[]): string {
  return models.map((m) => m.name).join(' vs ')
}