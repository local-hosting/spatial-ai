import { readDefaultSpatialMode, resilienceAutoEventEnabled } from '../spatial/spatial-mode.js'

export function uiSpatialConfigPublicBody(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  const mode = readDefaultSpatialMode(env)
  return {
    mode,
    resilience_auto_event: resilienceAutoEventEnabled(env),
    modes: ['everyday', 'resilience'] as const,
  }
}