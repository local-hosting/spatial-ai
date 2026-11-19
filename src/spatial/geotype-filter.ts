import { resolveGeotypeSlug } from '@local-hosting/geotypes'
import type { SpatialSession } from '../types/spatial.js'

/** Resolve session geotype slug via geotypes taxonomy (link, don’t merge). */
export function resolveSessionGeotype(session: SpatialSession): string | undefined {
  const raw = session.geotype?.trim()
  if (!raw) return undefined
  const fallback = raw.toLowerCase().replace(/\s+/g, '_')
  return resolveGeotypeSlug(raw, fallback)
}