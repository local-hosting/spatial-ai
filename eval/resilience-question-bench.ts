import { readMessageCorpus, type MessageCorpusId } from '@local-hosting/compose/messages'
import type { ComposeIntentExpect } from '@local-hosting/compose/messages'
import {
  mapQuestionLexicon,
  type EventSummary,
  type PlaceRankingHint,
  type QuestionLabel,
  type SupportedLanguage,
} from '@local-hosting/local-ai'
import { deriveComposeRubric } from './compose-scoring.js'
import {
  allResiliencePlaceIds,
  resilienceEvalVocabulary,
} from './resilience-eval-vocab.js'
import { placesNear, type PlaceNearHit } from '../src/spatial/places-near.js'
import { resolveSpatialSession } from '../src/spatial/session-resolve.js'
import { evalBenchCorpusId } from './eval-corpus.js'

export const CANDIDATE_ACTION_IDS = ['A_EVAC', 'A_SHELTER', 'A_STAY', 'A_HIGHER'] as const

export type BenchQuestionRow = {
  id: string
  text: string
  lang: SupportedLanguage
  event_ref: string
  band: number
  session: { lat?: number; lon?: number; geotype?: string }
  expected_map_label?: string
  expected_place_id?: string
  geo_rank1_id?: string
  geo_rank2_ids?: string[]
  expect_compose?: ComposeIntentExpect
}

export type QuestionBenchContext = {
  row: BenchQuestionRow
  session: ReturnType<typeof resolveSpatialSession>
  geo_hits: PlaceNearHit[]
  geo_place_ids: string[]
  geo_rank1_id: string | undefined
  map_label_detected: QuestionLabel
  map_label_lexicon_ok: boolean | null
  rubric: ReturnType<typeof deriveComposeRubric>
}

export function loadBenchQuestions(
  max: number,
  corpusId: MessageCorpusId = evalBenchCorpusId(),
): BenchQuestionRow[] {
  const synthetic = readMessageCorpus(corpusId).messages
  const rows = synthetic
    .filter((m) => m.kind === 'question' && m.event_ref && m.band != null && m.session)
    .map((m) => ({
      id: m.id,
      text: m.text,
      lang: m.lang,
      event_ref: m.event_ref!,
      band: m.band!,
      session: m.session!,
      expected_map_label: m.expected_map_label,
      expected_place_id: m.expected_place_id,
      geo_rank1_id: m.geo_rank1_id,
      geo_rank2_ids: m.geo_rank2_ids,
      expect_compose: m.expect_compose,
    }))
  return rows.slice(0, max)
}

export function buildQuestionContexts(rows: BenchQuestionRow[]): QuestionBenchContext[] {
  const vocab = resilienceEvalVocabulary()
  return rows.map((row) => {
    const session = resolveSpatialSession(row.session)
    const geo_hits = placesNear(vocab, session)
    const geo_place_ids = geo_hits.slice(0, 8).map((h) => h.id)
    const geo_rank1_id = row.geo_rank1_id ?? geo_hits[0]?.id
    const mapped = mapQuestionLexicon(row.text, row.lang)
    const map_label_lexicon_ok = row.expected_map_label
      ? mapped.label === row.expected_map_label
      : null
    const rubric = deriveComposeRubric(
      vocab,
      row.event_ref,
      row.band,
      [...CANDIDATE_ACTION_IDS],
      mapped.label,
      row.expect_compose?.acceptable_action_ids,
    )
    return {
      row,
      session,
      geo_hits,
      geo_place_ids,
      geo_rank1_id,
      map_label_detected: mapped.label,
      map_label_lexicon_ok,
      rubric,
    }
  })
}

export function placeRankingHints(hits: PlaceNearHit[]): PlaceRankingHint[] {
  return hits.slice(0, 8).map((h, i) => ({
    id: h.id,
    rank: i + 1,
    distance_m: h.distance_m,
    type: h.type,
  }))
}

export function buildBenchEvent(
  ctx: QuestionBenchContext,
  candidatePlaceIds: string[],
): EventSummary {
  const { row, session } = ctx
  const h3_cell =
    session.h3_cell?.trim() ??
    resilienceEvalVocabulary().places[0]?.h3 ??
    '88283472b3fffff'
  return {
    event_id: row.id,
    event_ref: row.event_ref,
    h3_cell,
    band: row.band as 1 | 2 | 3 | 4,
    trend: 'rising',
    sensors_agreeing: 2,
    started_utc: '2026-08-14T12:00:00Z',
    reports: [
      {
        type: 'resident_question',
        mapped_ids: [],
      },
    ],
    candidate_action_ids: [...CANDIDATE_ACTION_IDS],
    candidate_place_ids:
      candidatePlaceIds.length > 0 ? candidatePlaceIds : ['P_DIS_01'],
    candidate_resource_ids: ['R_KIT'],
    actors: ['PR_RESIDENT'],
  }
}

export function corpusBaseline(contexts: QuestionBenchContext[]): Record<string, unknown> {
  const withLabel = contexts.filter((c) => c.map_label_lexicon_ok !== null)
  const lexiconOk = withLabel.filter((c) => c.map_label_lexicon_ok).length
  const rank1Known = contexts.filter((c) => c.geo_rank1_id).length
  return {
    question_rows: contexts.length,
    geo_rank1_resolved_pct:
      rank1Known > 0 ? Math.round((rank1Known / contexts.length) * 1000) / 10 : 0,
    map_label_lexicon_accuracy_pct:
      withLabel.length > 0
        ? Math.round((lexiconOk / withLabel.length) * 1000) / 10
        : null,
    note: 'Geo rank-1 comes from placesNear at annotation time; lexicon is model-independent.',
  }
}

export function resilienceBenchVocabulary() {
  return resilienceEvalVocabulary()
}

export function allBenchPlaceIds() {
  return allResiliencePlaceIds(resilienceEvalVocabulary())
}