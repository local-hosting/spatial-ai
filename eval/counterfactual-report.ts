import { pct } from './compose-scoring.js'

export type CounterfactualMetrics = {
  rows: number
  geo_narrow_rank1_pct: number | null
  full_vocab_rank1_pct: number | null
  geo_lift_rank1_pts: number | null
}

export type CounterfactualReport = {
  enabled: boolean
  hint?: string
  rows?: number
  geo_narrow_rank1_pct?: number | null
  full_vocab_rank1_pct?: number | null
  geo_lift_rank1_pts?: number | null
  note?: string
}

export function buildCounterfactualReport(
  enabled: boolean,
  cfGeo: number,
  cfFull: number,
  cfScored: number,
): CounterfactualReport {
  if (!enabled) {
    return {
      enabled: false,
      hint: 'Set LOCAL_AI_EVAL_COUNTERFACTUAL=1 to compare geo-narrow vs full-vocab rank-1.',
    }
  }
  if (cfScored <= 0) {
    return {
      enabled: true,
      rows: 0,
      geo_narrow_rank1_pct: null,
      full_vocab_rank1_pct: null,
      geo_lift_rank1_pts: null,
      note: 'No model rows scored for counterfactual.',
    }
  }
  const geoPct = pct(cfGeo, cfScored)
  const fullPct = pct(cfFull, cfScored)
  const lift =
    geoPct != null && fullPct != null
      ? Math.round((geoPct - fullPct) * 10) / 10
      : null
  return {
    enabled: true,
    rows: cfScored,
    geo_narrow_rank1_pct: geoPct,
    full_vocab_rank1_pct: fullPct,
    geo_lift_rank1_pts: lift,
  }
}