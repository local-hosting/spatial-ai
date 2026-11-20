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
}

function shouldRulesOnlyCompose(
  rulesOnlyRequest: boolean | undefined,
  source: SpatialSource,
  label: QuestionLabel | 'other',
  confidence: number,
): boolean {
  if (rulesOnlyRequest) return true
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
  const vocab = resolveSessionVocab(req)
  if (!vocab) throw new Error('vocab not available')

  const session = resolveSpatialSession(req.session ?? {})
  const spatial = Boolean(
    session.h3_cell || session.geotype || (session.lat != null && session.lon != null),
  )

  const lexicon = mapQuestionLexicon(req.text, req.lang)
  let label: QuestionLabel | 'other' = lexicon.label
  let confidence = lexicon.confidence
  let source: SpatialSource = 'spatial_lexicon'

  const mapped = await mapQuestion(req.text, req.lang, {
    baseUrl: options.glinerBaseUrl,
    timeoutMs: options.mapTimeoutMs,
  })
  if (mapped.confidence >= confidence) {
    label = mapped.label
    confidence = mapped.confidence
    source = 'spatial_map'
  }

  const hits = placesNear(vocab, session)
  const place_ids = hits.map((h) => h.id)

  let action_ids: string[] = []
  let intent: SpatialChatResult['intent']
  let composeSource: SpatialSource | null = null

  if (req.event) {
    const event = {
      ...req.event,
      h3_cell: session.h3_cell ?? req.event.h3_cell,
      candidate_place_ids: [
        ...new Set([...place_ids, ...req.event.candidate_place_ids]),
      ],
    }
    const rubric = deriveComposeRubric(
      vocab,
      req.event.event_ref,
      req.event.band,
      req.event.candidate_action_ids,
      label,
    )
    const geoTop = hits.slice(0, 8).map((h) => h.id)
    const composeEvent = narrowEventForLabel(event, rubric)
    const rulesOnly = shouldRulesOnlyCompose(
      req.compose?.rules_only,
      source,
      label,
      confidence,
    )
    intent = applyIntentComposePolicy(
      await compose(
        {
          vocab,
          event: composeEvent,
          resident_text: req.text,
          place_ranking: rankingHints(hits),
          question_label: label,
        },
        {
          llamaBaseUrl: options.llamaBaseUrl,
          timeoutMs: options.composeTimeoutMs,
          rulesOnlyForce: rulesOnly,
        },
      ),
      label,
      rubric,
      hits[0]?.id,
      geoTop,
    )
    composeSource = intent.source === 'rules_fallback' ? 'rules' : 'model'
    action_ids = [
      ...new Set(intent.per_actor.flatMap((row) => row.action_ids ?? [])),
    ]
  }

  const finalSource: SpatialSource = composeSource ?? source

  return {
    label,
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