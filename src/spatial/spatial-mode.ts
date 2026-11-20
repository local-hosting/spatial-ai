import type { PackMode } from '@local-hosting/compose'
import type { SpatialChatRequest } from '../types/spatial.js'
import type { SpatialMode } from '../types/spatial-mode.js'
import { readSpatialAiEnv } from '../runtime/read-env.js'
import { defaultResilienceEvent } from './resilience-default-event.js'

const MODES: readonly SpatialMode[] = ['everyday', 'resilience']

function isSpatialMode(value: string): value is SpatialMode {
  return (MODES as readonly string[]).includes(value)
}

export function readDefaultSpatialMode(
  env: NodeJS.ProcessEnv = process.env,
): SpatialMode {
  const raw = readSpatialAiEnv('MODE', env)?.toLowerCase()
  if (raw === 'everyday' || raw === 'resilience') return raw
  return 'everyday'
}

export function resilienceAutoEventEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const raw = readSpatialAiEnv('RESILIENCE_AUTO_EVENT', env)?.toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  return true
}

export function resolveSpatialMode(
  req: Pick<SpatialChatRequest, 'mode' | 'pack_mode'>,
  env: NodeJS.ProcessEnv = process.env,
): SpatialMode {
  const fromReq = req.mode?.trim().toLowerCase()
  if (fromReq && isSpatialMode(fromReq)) return fromReq
  if (req.pack_mode === 'resilience') return 'resilience'
  if (req.pack_mode === 'daily') return 'everyday'
  return readDefaultSpatialMode(env)
}

export function packModeForSpatialMode(mode: SpatialMode): PackMode {
  return mode === 'resilience' ? 'resilience' : 'daily'
}

/** Apply mode → vocab pack and resilience compose defaults. */
export function prepareSpatialChatRequest(
  req: SpatialChatRequest,
  env: NodeJS.ProcessEnv = process.env,
): { request: SpatialChatRequest; mode: SpatialMode } {
  const mode = resolveSpatialMode(req, env)
  const pack_mode = packModeForSpatialMode(mode)
  let event = req.event
  if (
    mode === 'resilience' &&
    !event &&
    resilienceAutoEventEnabled(env)
  ) {
    const h3 =
      req.session?.h3_cell ??
      (req.session?.lat != null && req.session?.lon != null
        ? undefined
        : undefined)
    event = defaultResilienceEvent(h3)
  }
  return {
    mode,
    request: {
      ...req,
      mode,
      pack_mode,
      ...(event ? { event } : {}),
    },
  }
}