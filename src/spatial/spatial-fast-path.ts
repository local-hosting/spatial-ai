import type {
  ComposeIntent,
  EventSummary,
  QuestionLabel,
  Vocabulary,
} from '@local-hosting/local-ai'
import { vocabularyTip } from '@local-hosting/local-ai'
import type { ComposeRubric } from './compose-rubric.js'
import {
  actionsInAcceptableSet,
  requiredActionsSatisfied,
} from './compose-rubric.js'
import { readSpatialAiEnv } from '../runtime/read-env.js'

const LEXICON_CONFIDENCE_MIN = 0.85

export function spatialFastPathEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = readSpatialAiEnv('FAST_PATH', env)?.toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  return true
}

export function lexiconFirstMapEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = readSpatialAiEnv('LEXICON_FIRST_MAP', env)?.toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  return true
}

export function shouldSkipGlinerMap(
  label: QuestionLabel | 'other',
  lexiconConfidence: number,
  glinerReachable: boolean,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!glinerReachable) return true
  if (!lexiconFirstMapEnabled(env)) return false
  return label !== 'other' && lexiconConfidence >= LEXICON_CONFIDENCE_MIN
}

function pickActionIds(
  event: EventSummary,
  rubric: ComposeRubric,
): string[] {
  const cand = event.candidate_action_ids
  const required = rubric.required_any_action_ids.find((id) => cand.includes(id))
  if (required) return [required]
  const acceptable = rubric.acceptable_action_ids.filter((id) => cand.includes(id))
  if (acceptable.length > 0) return [acceptable[0]!]
  return cand.slice(0, 1)
}

/**
 * Zero-LLM compose when lexicon + geo rank-1 satisfy the rubric.
 */
export function trySpatialFastPathIntent(
  vocab: Vocabulary,
  event: EventSummary,
  rubric: ComposeRubric,
  label: QuestionLabel | 'other',
  mapSource: 'spatial_lexicon' | 'spatial_map',
  lexiconConfidence: number,
  rank1PlaceId: string | undefined,
  geoPlaceIds: string[],
  env: NodeJS.ProcessEnv = process.env,
): ComposeIntent | null {
  if (!spatialFastPathEnabled(env)) return null
  if (!rank1PlaceId || !geoPlaceIds.includes(rank1PlaceId)) return null
  if (mapSource !== 'spatial_lexicon') return null
  if (label === 'other' || lexiconConfidence < LEXICON_CONFIDENCE_MIN) return null

  const action_ids = pickActionIds(event, rubric)
  if (
    !actionsInAcceptableSet(action_ids, rubric.acceptable_action_ids) ||
    !requiredActionsSatisfied(action_ids, rubric.required_any_action_ids)
  ) {
    return null
  }

  const place_ids =
    label === 'where_to_go' || label === 'is_it_safe_for_kids'
      ? [rank1PlaceId]
      : []

  const per_actor = event.actors.map((actor_id) => ({
    actor_id,
    severity: event.band,
    action_ids,
    place_ids: place_ids.length > 0 ? place_ids : undefined,
  }))

  return {
    event_id: event.event_id,
    event_ref: event.event_ref,
    per_actor,
    source: 'rules_fallback',
    model: null,
    vocab_version: vocab.vocab_version,
    vocab_tip: vocabularyTip(vocab),
    latency_ms: 0,
  }
}