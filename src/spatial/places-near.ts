import type { Vocabulary, VocabPlace } from '@local-hosting/ai'
import type { SpatialSession } from '../types/spatial.js'

export type PlaceNearHit = {
  id: string
  h3: string
  type: string
  /** Lower is closer / better match when ranked. */
  rank: number
}

/**
 * Local place candidates from vocab only (no cloud).
 * Prefers H3 prefix match when `session.h3_cell` is set; optional `geotype` filters `VocabPlace.type`.
 */
export function placesNear(
  vocab: Vocabulary,
  session: SpatialSession = {},
): PlaceNearHit[] {
  const limit = session.limit ?? 8
  const cell = session.h3_cell?.trim()
  const geotype = session.geotype?.trim().toLowerCase()

  let places: VocabPlace[] = vocab.places
  if (geotype) {
    places = places.filter((p) => p.type.toLowerCase() === geotype)
  }

  const scored: PlaceNearHit[] = places.map((p) => {
    let rank = 1000
    if (cell && p.h3) {
      const shared = sharedH3PrefixLen(cell, p.h3)
      rank = Math.max(0, 15 - shared)
    }
    return { id: p.id, h3: p.h3, type: p.type, rank }
  })

  scored.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
  return scored.slice(0, limit)
}

function sharedH3PrefixLen(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a[i] === b[i]) i += 1
  return i
}
