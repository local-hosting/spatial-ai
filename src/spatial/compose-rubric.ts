import type { QuestionLabel } from '@local-hosting/local-ai'
import type { Vocabulary } from '@local-hosting/local-ai'

export type MapLabel = QuestionLabel | 'other'

export type ComposeRubric = {
  acceptable_action_ids: string[]
  required_any_action_ids: string[]
}

const QUESTION_ACTION_POOL: Record<QuestionLabel, string[]> = {
  where_to_go: ['A_SHELTER', 'A_EVAC'],
  what_to_do: ['A_EVAC', 'A_SHELTER', 'A_HIGHER', 'A_STAY'],
  how_long: ['A_STAY', 'A_SHELTER'],
  is_it_safe_for_kids: ['A_STAY', 'A_SHELTER'],
  is_it_safe_outside: ['A_STAY', 'A_EVAC', 'A_HIGHER'],
}

/**
 * Derives per-row acceptable actions from vocab defaults + question map label.
 * Override with corpus `expect_compose.acceptable_action_ids` when present.
 */
export function deriveComposeRubric(
  vocab: Vocabulary,
  eventRef: string,
  band: number,
  candidateActionIds: string[],
  mapLabel: MapLabel,
  yamlAcceptable?: string[][],
): ComposeRubric {
  if (yamlAcceptable?.length === 1) {
    return {
      acceptable_action_ids: yamlAcceptable[0]!.filter((id) =>
        candidateActionIds.includes(id),
      ),
      required_any_action_ids: [],
    }
  }

  const label = mapLabel === 'other' ? 'other' : mapLabel
  const cand = new Set(candidateActionIds)
  const bandDefaults = vocab.defaults[eventRef]?.[String(band)] ?? []
  const pool = new Set<string>()
  for (const id of bandDefaults) {
    if (cand.has(id)) pool.add(id)
  }
  if (label !== 'other') {
    for (const id of QUESTION_ACTION_POOL[label] ?? []) {
      if (cand.has(id)) pool.add(id)
    }
  }
  if (pool.size === 0) {
    for (const id of candidateActionIds) pool.add(id)
  }

  const required_any_action_ids: string[] = []
  if (label === 'where_to_go' && cand.has('A_SHELTER')) {
    required_any_action_ids.push('A_SHELTER')
  }
  if (label === 'what_to_do') {
    for (const id of bandDefaults) {
      if (cand.has(id)) required_any_action_ids.push(id)
    }
  }

  return {
    acceptable_action_ids: [...pool],
    required_any_action_ids,
  }
}

export function actionsInAcceptableSet(
  actionIds: string[],
  acceptable: string[],
): boolean {
  if (actionIds.length === 0) return false
  const allowed = new Set(acceptable)
  return actionIds.every((id) => allowed.has(id))
}

export function requiredActionsSatisfied(
  actionIds: string[],
  requiredAny: string[],
): boolean {
  if (requiredAny.length === 0) return true
  return requiredAny.some((id) => actionIds.includes(id))
}