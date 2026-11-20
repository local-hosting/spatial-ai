import { describe, expect, it } from 'vitest'
import { buildScorecard } from '../eval/scorecard.js'
import type { ModelEvalHeadline } from '../eval/scorecard.js'

describe('scorecard recommendation', () => {
  const gemma: ModelEvalHeadline = {
    model: 'gemma-4-e2b',
    geo_rank1_in_output_pct: 95,
    action_acceptable_pct: 30,
    p95_latency_ms: 5000,
    counterfactual: { enabled: false, hint: 'x' },
  }
  const qwen: ModelEvalHeadline = {
    model: 'qwen3-1.7b-instruct',
    geo_rank1_in_output_pct: 58,
    action_acceptable_pct: 79,
    p95_latency_ms: 2600,
    counterfactual: { enabled: true, geo_lift_rank1_pts: 5, rows: 30 },
  }

  it('picks Qwen when action edge is large at similar rank1', () => {
    const similarRankQwen = { ...qwen, geo_rank1_in_output_pct: 92 }
    const card = buildScorecard([gemma, similarRankQwen])
    expect(card.chosen_composer).toBe('qwen3-1.7b-instruct')
    expect(card.confidence).toBe('high')
  })

  it('picks Gemma when rank1 leads by 20+ and latency fits Pi budget', () => {
    process.env.LOCAL_AI_EVAL_DEVICE_TARGET = 'pi'
    process.env.LOCAL_AI_EVAL_P95_BUDGET_MS = '6000'
    const card = buildScorecard([gemma, qwen])
    expect(card.chosen_composer).toBe('gemma-4-e2b')
    delete process.env.LOCAL_AI_EVAL_DEVICE_TARGET
    delete process.env.LOCAL_AI_EVAL_P95_BUDGET_MS
  })

  it('notes counterfactual lift in rationale when enabled', () => {
    const flatLift = {
      ...qwen,
      counterfactual: {
        enabled: true,
        rows: 10,
        geo_lift_rank1_pts: 0,
        geo_narrow_rank1_pct: 50,
        full_vocab_rank1_pct: 50,
      },
    }
    const card = buildScorecard([gemma, flatLift])
    expect(card.rationale.some((r) => r.includes('geo_lift'))).toBe(true)
  })

  it('picks among Qwen-only peers when Gemma is absent', () => {
    process.env.LOCAL_AI_EVAL_DEVICE_TARGET = 'pi'
    process.env.LOCAL_AI_EVAL_P95_BUDGET_MS = '3500'
    const small: ModelEvalHeadline = {
      model: 'qwen3-0.6b-instruct',
      geo_rank1_in_compose_pct: 100,
      action_acceptable_pct: 73.5,
      p95_compose_latency_ms: 774,
    }
    const mid: ModelEvalHeadline = {
      model: 'qwen2.5-1.5b-instruct',
      geo_rank1_in_compose_pct: 100,
      action_acceptable_pct: 73.5,
      p95_compose_latency_ms: 1595,
    }
    const card = buildScorecard([small, mid])
    expect(card.chosen_composer).toBe('qwen3-0.6b-instruct')
    expect(card.fallback_composer).toBe('qwen2.5-1.5b-instruct')
    expect(card.confidence).toBe('medium')
    delete process.env.LOCAL_AI_EVAL_DEVICE_TARGET
    delete process.env.LOCAL_AI_EVAL_P95_BUDGET_MS
  })
})