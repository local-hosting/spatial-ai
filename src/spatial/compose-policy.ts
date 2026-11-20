import type { ComposeIntent, EventSummary } from '@local-hosting/local-ai'
import type { ComposeRubric, MapLabel } from './compose-rubric.js'

export function composePolicyEnabled(): boolean {
  const v = process.env.SPATIAL_AI_COMPOSE_POLICY?.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'off') return false
  return true
}

export function placeRepairEnabled(): boolean {
  if (!composePolicyEnabled()) return false
  const v = process.env.SPATIAL_AI_COMPOSE_PLACE_REPAIR?.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'off') return false
  return true
}

export function composeActionCap(): number {
  const n = Number(process.env.SPATIAL_AI_COMPOSE_ACTION_CAP ?? 2)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 2
}

export function narrowEventForLabel(
  event: EventSummary,
  rubric: ComposeRubric,
): EventSummary {
  const fromEvent = new Set(event.candidate_action_ids)
  const narrowed = rubric.acceptable_action_ids.filter((id) => fromEvent.has(id))
  if (narrowed.length === 0) return event
  return { ...event, candidate_action_ids: narrowed }
}

export function applyIntentComposePolicy(
  intent: ComposeIntent,
  label: MapLabel,
  rubric: ComposeRubric,
  rank1PlaceId: string | undefined,
  geoPlaceIds: string[],
): ComposeIntent {
  if (!composePolicyEnabled() || intent.source !== 'model') return intent

  const allowed = new Set(rubric.acceptable_action_ids)
  const geo = new Set(geoPlaceIds)
  const cap = composeActionCap()
  const repairPlaces = placeRepairEnabled()

  const per_actor = intent.per_actor.map((row) => {
    let action_ids = row.action_ids.filter((id) => allowed.has(id))
    if (action_ids.length === 0) {
      const required = rubric.required_any_action_ids.find((id) => allowed.has(id))
      const fallback = required ?? rubric.acceptable_action_ids[0]
      if (fallback) action_ids = [fallback]
    }
    action_ids = action_ids.slice(0, cap)

    let place_ids = (row.place_ids ?? []).filter((id) => geo.has(id))
    if (
      repairPlaces &&
      label !== 'other' &&
      rank1PlaceId &&
      geo.has(rank1PlaceId) &&
      !place_ids.includes(rank1PlaceId)
    ) {
      place_ids = [rank1PlaceId, ...place_ids].slice(0, 2)
    }

    return { ...row, action_ids, place_ids }
  })

  return { ...intent, per_actor }
}