import { coordinatesToH3 } from '@local-hosting/geokit/h3'
import type { SpatialSession } from '../types/spatial.js'

/** Fill `h3_cell` from lat/lon when missing (geokit, loopback-local). */
export function resolveSpatialSession(session: SpatialSession = {}): SpatialSession {
  const next = { ...session }
  if (next.h3_cell?.trim()) {
    return next
  }
  const lat = next.lat
  const lon = next.lon
  if (lat == null || lon == null) {
    return next
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return next
  }
  const res = next.h3_resolution ?? 9
  next.h3_cell = coordinatesToH3(res)([lat, lon])
  return next
}