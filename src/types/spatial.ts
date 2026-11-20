import type {
  ComposeIntent,
  QuestionLabel,
  ReportType,
  SupportedLanguage,
  Vocabulary,
} from '@local-hosting/local-ai'
import type { PackMode } from '@local-hosting/compose'
import type { EventSummary } from '@local-hosting/local-ai'

/** Caller session bag — optional; omit for basic (non-spatial) use of `@local-hosting/local-ai`. */
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
  vocab?: Vocabulary
  vocab_tip?: string
  pack_mode?: PackMode
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
  /** Question label source before compose (GLiNER overlay vs lexicon). */
  map_source: 'spatial_map' | 'spatial_lexicon'
  place_ids: string[]
  action_ids: string[]
  source: SpatialSource
  spatial: boolean
  h3_cell: string | null
  illocution: 'query' | 'report' | 'other'
  reply: string
  intent?: ComposeIntent
}