import type { QuestionLabel } from '@local-hosting/local-ai'
import type { SpatialSession } from '../types/spatial.js'

/** Offline hints: narrow `placesNear` by vocab place `type` (geotypes-linked slug). */
const LABEL_GEOTYPE_HINT: Partial<Record<QuestionLabel, string>> = {
  where_to_go: 'shelter',
  is_it_safe_for_kids: 'kids',
  how_long: 'shelter',
}

export function geotypeHintFromMapLabel(
  label: QuestionLabel | 'other',
): string | undefined {
  if (label === 'other') return undefined
  return LABEL_GEOTYPE_HINT[label]
}

export function applyLabelGeotypeToSession(
  session: SpatialSession,
  label: QuestionLabel | 'other',
): SpatialSession {
  if (session.geotype?.trim()) return session
  const hint = geotypeHintFromMapLabel(label)
  if (!hint) return session
  return { ...session, geotype: hint }
}