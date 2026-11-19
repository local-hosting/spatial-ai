import { mapQuestionLexicon } from '@local-hosting/ai'
import type { SpatialRequest, SpatialResult } from '../types/spatial.js'
import { placesNear } from './places-near.js'

/**
 * Offline spatial path (mode B baseline): lexicon map + local place filter.
 * Neural map/compose stay on `@local-hosting/ai` loopback; this layer adds place grounding.
 */
export function runSpatial(req: SpatialRequest): SpatialResult {
  const session = req.session ?? {}
  const spatial = Boolean(session.h3_cell || session.geotype || (session.lat != null && session.lon != null))
  const mapped = mapQuestionLexicon(req.text, req.lang)
  const hits = placesNear(req.vocab, session)

  return {
    label: mapped.label,
    place_ids: hits.map((h) => h.id),
    source: 'spatial_lexicon',
    spatial,
  }
}
