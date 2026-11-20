import {
  coordinatesToH3,
  expandH3CellId,
  h3ToCoordinates,
  normalizeH3CellToResolution,
} from '@local-hosting/geokit/h3'
import type { SpatialSession } from '../types/spatial.js'
import {
  effectiveSessionH3Resolution,
  readSessionH3ResolutionCap,
} from './session-h3-policy.js'

function snapSessionToH3Cell(
  session: SpatialSession,
  h3_cell: string,
): SpatialSession {
  const [lat, lon] = h3ToCoordinates(expandH3CellId(h3_cell))
  return {
    ...session,
    h3_cell,
    lat,
    lon,
    h3_resolution: session.h3_resolution,
  }
}

/**
 * Normalize session geo for place ranking: coarser H3 cap, cell centroid only
 * (no raw GPS precision on the ranking path).
 */
export function resolveSpatialSession(
  session: SpatialSession = {},
  env: NodeJS.ProcessEnv = process.env,
): SpatialSession {
  const cap = readSessionH3ResolutionCap(env)
  const resolution = effectiveSessionH3Resolution(session.h3_resolution, cap)
  const next = { ...session, h3_resolution: resolution }

  const trimmed = next.h3_cell?.trim()
  if (trimmed) {
    const coarsened = normalizeH3CellToResolution(trimmed, resolution)
    return snapSessionToH3Cell(next, coarsened)
  }

  const lat = next.lat
  const lon = next.lon
  if (lat == null || lon == null) {
    return next
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return next
  }

  const h3_cell = coordinatesToH3(resolution)([lat, lon])
  return snapSessionToH3Cell(next, h3_cell)
}