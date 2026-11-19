import { haversineMeters } from '@local-hosting/geokit/core'
import { h3ToCoordinates } from './geokit-h3.js'
import type { Vocabulary, VocabPlace } from '@local-hosting/ai'
import type { SpatialSession } from '../types/spatial.js'
import { resolveSessionGeotype } from './geotype-filter.js'
import { resolveSpatialSession } from './session-resolve.js'

export type PlaceNearHit = {
  id: string
  h3: string
  type: string
  /** Lower is closer / better match when ranked. */
  rank: number
  distance_m?: number
}

function sharedH3PrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a[i] === b[i]) i += 1
  return i
}

function rankPlace(
  place: VocabPlace,
  cell: string | undefined,
  origin: Readonly<[number, number]> | null,
): { rank: number; distance_m?: number } {
  let rank = 1000
  let distance_m: number | undefined

  if (origin) {
    try {
      const center = h3ToCoordinates(place.h3)
      const [olat, olon] = origin
      const meters = haversineMeters([olat, olon])(center)
      distance_m = meters
      rank = Math.round(meters)
    } catch {
      rank = 5000
    }
  } else if (cell && place.h3) {
    const shared = sharedH3PrefixLen(cell, place.h3)
    rank = Math.max(0, 15 - shared)
  }

  return { rank, distance_m }
}

/**
 * Local place candidates from vocab only (no cloud).
 */
export function placesNear(
  vocab: Vocabulary,
  session: SpatialSession = {},
): PlaceNearHit[] {
  const resolved = resolveSpatialSession(session)
  const limit = resolved.limit ?? 8
  const cell = resolved.h3_cell?.trim()
  const geotype = resolveSessionGeotype(resolved)

  let places: VocabPlace[] = vocab.places
  if (geotype) {
    places = places.filter((p) => p.type.toLowerCase() === geotype)
  }

  const origin =
    resolved.lat != null && resolved.lon != null
      ? ([resolved.lat, resolved.lon] as const)
      : null

  const scored: PlaceNearHit[] = places.map((p) => {
    const { rank, distance_m } = rankPlace(p, cell, origin)
    return { id: p.id, h3: p.h3, type: p.type, rank, distance_m }
  })

  scored.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
  return scored.slice(0, limit)
}