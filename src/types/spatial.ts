import type { QuestionLabel, ReportType, Vocabulary } from '@local-hosting/ai'
import type { SupportedLanguage } from '@local-hosting/ai'

/** Caller session bag — optional; omit for basic (non-spatial) use of `@local-hosting/ai`. */
export type SpatialSession = {
  h3_cell?: string
  lat?: number
  lon?: number
  /** Optional geotype slug filter when geotypes is linked. */
  geotype?: string
  /** Max places to return from local vocab filter. */
  limit?: number
}

export type SpatialRequest = {
  text: string
  lang: SupportedLanguage
  vocab: Vocabulary
  session?: SpatialSession
}

export type SpatialResult = {
  label: QuestionLabel | ReportType | 'other'
  place_ids: string[]
  source: 'spatial_map' | 'spatial_lexicon' | 'rules'
  /** True when geo session was applied. */
  spatial: boolean
}
