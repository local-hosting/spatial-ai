import {
  compose,
  mapQuestion,
  mapQuestionLexicon,
  type QuestionLabel,
} from '@local-hosting/local-ai'
import type { SpatialChatRequest, SpatialChatResult, SpatialSource } from '../types/spatial.js'
import { labelToIllocution, replyForLabel } from './crosswalk.js'
import { placesNear, type PlaceNearHit } from './places-near.js'
import { resolveSpatialSession } from './session-resolve.js'
import { resolveSessionVocab } from '@local-hosting/local-ai'
import {
  applyIntentComposePolicy,
  narrowEventForLabel,
} from './compose-policy.js'
import { deriveComposeRubric } from './compose-rubric.js'
import { applyLabelGeotypeToSession } from './geotype-from-label.js'
import { sliceVocabForAnchor } from './vocab-h3-slice.js'
import {
  shouldSkipGlinerMap,
  trySpatialFastPathIntent,
} from './spatial-fast-path.js'
import { healthAutoRulesOnly } from '../api/spatial-health-cache.js'
import { prepareSpatialChatRequest } from './spatial-mode.js'

function rankingHints(hits: PlaceNearHit[]) {
  return hits.slice(0, 8).map((h, i) => ({
    id: h.id,
    rank: i + 1,
    distance_m: h.distance_m,
    type: h.type,
  }))
}

export type SpatialChatOptions = {
  llamaBaseUrl: string
  glinerBaseUrl: string
  composeTimeoutMs: number
  mapTimeoutMs: number
  /** Pin MANIFEST composer (eval A/B); else LOCAL_AI_COMPOSE_MODEL / chosen_composer. */
  composerName?: string
  llamaReachable?: boolean
  glinerReachable?: boolean
}

function shouldRulesOnlyCompose(
  rulesOnlyRequest: boolean | undefined,
  source: SpatialSource,
  label: QuestionLabel | 'other',
  confidence: number,
  options: SpatialChatOptions,
): boolean {
  if (rulesOnlyRequest) return true
  if (
    healthAutoRulesOnly() &&
    options.llamaReachable === false
  ) {
    return true
  }
  const flag = process.env.SPATIAL_AI_RULES_ONLY?.trim()
  if (flag === '1' || flag?.toLowerCase() === 'true') return true
  if (source === 'spatial_lexicon' && label !== 'other' && confidence >= 0.85) {
    return true
  }
  return false
}

export async function runSpatialChat(
  req: SpatialChatRequest,
  options: SpatialChatOptions,
): Promise<SpatialChatResult> {
  const { request: prepared, mode } = prepareSpatialChatRequest(req)
  const baseVocab = resolveSessionVocab(prepared)
  if (!baseVocab) throw new Error('vocab not available')

  const lexicon = mapQuestionLexicon(prepared.text, prepared.lang)
  let label: QuestionLabel | 'other' = lexicon.label
  let confidence = lexicon.confidence
  let mapSource: SpatialChatResult['map_source'] = 'spatial_lexicon'

  const glinerUp = options.glinerReachable !== false
  const skipGliner = shouldSkipGlinerMap(
    label,
    confidence,
    glinerUp,
  )

  if (!skipGliner) {
    const mapped = await mapQuestion(prepared.text, prepared.lang, {
      baseUrl: options.glinerBaseUrl,
      timeoutMs: options.mapTimeoutMs,
    })
    if (mapped.confidence >= confidence) {
      label = mapped.label
      confidence = mapped.confidence
      mapSource = 'spatial_map'
    }
  }

  const session = resolveSpatialSession(
    applyLabelGeotypeToSession(prepared.session ?? {}, label),
  )
  const spatial = Boolean(
    session.h3_cell || session.geotype || (session.lat != null && session.lon != null),
  )

  const vocab = sliceVocabForAnchor(baseVocab, session.h3_cell)
  const hits = placesNear(vocab, session)
  const place_ids = hits.map((h) => h.id)

  let action_ids: string[] = []
  let intent: SpatialChatResult['intent']
  let composeSource: SpatialSource | null = null

  if (prepared.event) {
    const event = {
      ...prepared.event,
      h3_cell: session.h3_cell ?? prepared.event.h3_cell,
      candidate_place_ids: [
        ...new Set([...place_ids, ...prepared.event.candidate_place_ids]),
      ],
    }
    const rubric = deriveComposeRubric(
      vocab,
      prepared.event.event_ref,
      prepared.event.band,
      prepared.event.candidate_action_ids,
      label,
    )
    const geoTop = hits.slice(0, 8).map((h) => h.id)
    const composeEvent = narrowEventForLabel(event, rubric)
    const rulesOnly = shouldRulesOnlyCompose(
      prepared.compose?.rules_only,
      mapSource,
      label,
      confidence,
      options,
    )
    const rank1 = hits[0]?.id

    const fastPath = trySpatialFastPathIntent(
      vocab,
      composeEvent,
      rubric,
      label,
      mapSource,
      confidence,
      rank1,
      geoTop,
    )

    if (fastPath) {
      intent = applyIntentComposePolicy(
        fastPath,
        label,
        rubric,
        rank1,
        geoTop,
      )
      composeSource = 'rules'
    } else {
      intent = applyIntentComposePolicy(
        await compose(
          {
            vocab,
            event: composeEvent,
            resident_text: prepared.text,
            place_ranking: rankingHints(hits),
            question_label: label,
          },
          {
            llamaBaseUrl: options.llamaBaseUrl,
            timeoutMs: options.composeTimeoutMs,
            rulesOnlyForce: rulesOnly,
            composerName: options.composerName,
          },
        ),
        label,
        rubric,
        rank1,
        geoTop,
      )
      composeSource = intent.source === 'rules_fallback' ? 'rules' : 'model'
    }
    action_ids = [
      ...new Set(intent.per_actor.flatMap((row) => row.action_ids ?? [])),
    ]
  }

  const finalSource: SpatialSource = composeSource ?? mapSource

  return {
    mode,
    label,
    map_source: mapSource,
    place_ids,
    action_ids,
    source: finalSource,
    spatial,
    h3_cell: session.h3_cell ?? null,
    illocution: labelToIllocution(label),
    reply: replyForLabel(label),
    intent,
  }
}