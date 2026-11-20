import type { SpatialChatRequest } from '../types/spatial.js'
import type { SpatialSessionAnchorMeta } from '../types/session-anchor.js'
import { readSessionH3ResolutionCap } from './session-h3-policy.js'
import { resolveSpatialSession } from './session-resolve.js'
import type { SessionAnchorStore } from './session-anchor-store.js'

function sessionHasGeoInput(session: SpatialChatRequest['session']): boolean {
  if (!session) return false
  if (session.h3_cell?.trim()) return true
  return session.lat != null && session.lon != null
}

export function applyRequestSessionAnchor(
  req: SpatialChatRequest,
  store: SessionAnchorStore,
  env: NodeJS.ProcessEnv = process.env,
): { request: SpatialChatRequest; meta: SpatialSessionAnchorMeta } {
  const sessionId = store.ensureSessionId(req.session_id)
  const cap = readSessionH3ResolutionCap(env)

  if (sessionHasGeoInput(req.session)) {
    const normalized = resolveSpatialSession(req.session ?? {}, env)
    if (normalized.h3_cell) {
      store.recordObservation(sessionId, normalized.h3_cell)
    }
  }

  const anchor_h3 = store.anchorH3(sessionId, cap)
  const base = req.session ?? {}
  const mergedSession = anchor_h3
  ? resolveSpatialSession(
        {
          h3_cell: anchor_h3,
          geotype: base.geotype,
          limit: base.limit,
          h3_resolution: cap,
        },
        env,
      )
    : resolveSpatialSession(base, env)

  const meta: SpatialSessionAnchorMeta = {
    session_id: sessionId,
    anchor_h3: mergedSession.h3_cell ?? null,
    observation_count: store.observationCount(sessionId),
    boot_h3: store.meshH3,
    region_h3: store.regionH3,
  }

  return {
    request: {
      ...req,
      session_id: sessionId,
      session: mergedSession.h3_cell || mergedSession.geotype
        ? mergedSession
        : undefined,
    },
    meta,
  }
}