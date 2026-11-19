import {
  compose,
  mapQuestion,
  mapQuestionLexicon,
  type QuestionLabel,
} from '@local-hosting/local-ai'
import type { SpatialChatRequest, SpatialChatResult, SpatialSource } from '../types/spatial.js'
import { labelToIllocution, replyForLabel } from './crosswalk.js'
import { placesNear } from './places-near.js'
import { resolveSpatialSession } from './session-resolve.js'

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
  if (process.env.TF_SPATIAL_RULES_ONLY === '1') return true
  if (source === 'spatial_lexicon' && label !== 'other' && confidence >= 0.85) {
    return true
  }
  return false
}

export async function runSpatialChat(
  req: SpatialChatRequest,
  options: SpatialChatOptions,
): Promise<SpatialChatResult> {
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

  const hits = placesNear(req.vocab, session)
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
    const rulesOnly = shouldRulesOnlyCompose(
      req.compose?.rules_only,
      source,
      label,
      confidence,
    )
    intent = await compose(
      { vocab: req.vocab, event },
      {
        llamaBaseUrl: options.llamaBaseUrl,
        timeoutMs: options.composeTimeoutMs,
        rulesOnlyForce: rulesOnly,
      },
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