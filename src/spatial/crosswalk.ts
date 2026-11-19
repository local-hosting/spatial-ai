import { QUESTION_LABELS, type QuestionLabel } from '@local-hosting/local-ai'

export type SpatialIllocution = 'query' | 'report' | 'other'

/** All map question labels except `other` are query illocutions (from local-ai catalog). */
const QUERY_LABELS = new Set<QuestionLabel>(
  QUESTION_LABELS.filter((label) => label !== 'other'),
)

export function labelToIllocution(label: QuestionLabel | 'other'): SpatialIllocution {
  if (label === 'other') return 'other'
  if (QUERY_LABELS.has(label)) return 'query'
  return 'other'
}

export function replyForLabel(label: QuestionLabel | 'other'): string {
  switch (label) {
    case 'where_to_go':
      return 'Nearest safe places from your session cell.'
    case 'what_to_do':
      return 'Suggested actions follow your event defaults.'
    case 'how_long':
      return 'Duration depends on the active event band and trend.'
    case 'is_it_safe_for_kids':
      return 'Kids safety uses local place and event vocabulary only.'
    case 'is_it_safe_outside':
      return 'Outdoor safety uses local sensors and reports only.'
    default:
      return 'No classified local spatial match.'
  }
}
