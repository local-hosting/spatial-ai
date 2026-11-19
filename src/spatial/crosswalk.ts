import type { QuestionLabel } from '@local-hosting/ai'

export type SpatialIllocution = 'query' | 'report' | 'other'

const QUERY_LABELS = new Set<QuestionLabel>([
  'where_to_go',
  'what_to_do',
  'how_long',
  'is_it_safe_for_kids',
  'is_it_safe_outside',
])

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