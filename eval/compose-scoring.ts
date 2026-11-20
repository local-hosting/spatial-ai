import type { Vocabulary } from '@local-hosting/local-ai'
import {
  actionsInAcceptableSet,
  deriveComposeRubric,
  requiredActionsSatisfied,
  type ComposeRubric,
  type MapLabel,
} from '../src/spatial/compose-rubric.js'

export type { ComposeRubric, MapLabel }
export { actionsInAcceptableSet, deriveComposeRubric, requiredActionsSatisfied }

export function placesSubsetOfGeo(
  placeIds: string[],
  geoPlaceIds: string[],
): boolean {
  if (placeIds.length === 0) return false
  const geo = new Set(geoPlaceIds)
  return placeIds.every((id) => geo.has(id))
}

export function pct(n: number, total: number): number | null {
  if (total === 0) return null
  return Math.round((n / total) * 1000) / 10
}