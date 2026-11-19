import type {
  ComposeIntent,
  QuestionLabel,
  ReportType,
  SupportedLanguage,
  Vocabulary,
} from '@local-hosting/ai'
import type { EventSummary } from '@local-hosting/ai'

/** Caller session bag — optional; omit for basic (non-spatial) use of `@local-hosting/ai`. */
export type SpatialSession = {
  h3_cell?: string
  lat?: number
  lon?: number
  /** H3 resolution when deriving cell from lat/lon (default 9). */
  h3_resolution?: number
  /** Optional geotype slug filter when geotypes is linked. */
  geotype?: string
  /** Max places to return from local vocab filter. */
  limit?: number
}

export type SpatialComposeOptions = {
  rules_only?: boolean
}

export type SpatialChatRequest = {
  text: string
  lang: SupportedLanguage
  vocab: Vocabulary
  session?: SpatialSession
  /** When set, runs compose after map (elevated event). */
  event?: EventSummary
  compose?: SpatialComposeOptions
}

export type SpatialSource =
  | 'spatial_map'
  | 'spatial_lexicon'
  | 'rules'
  | 'model'

export type SpatialChatResult = {
  label: QuestionLabel | ReportType | 'other'
  place_ids: string[]
  action_ids: string[]
  source: SpatialSource
  spatial: boolean
  h3_cell: string | null
  illocution: 'query' | 'report' | 'other'
  reply: string
  intent?: ComposeIntent
}

export type SpatialRequest = SpatialChatRequest
export type SpatialResult = SpatialChatResult