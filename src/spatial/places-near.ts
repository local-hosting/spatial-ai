import { haversineMeters } from '@local-hosting/geokit/core'
import {
  expandH3CellId,
  h3Neighbors,
  h3ToCoordinates,
  normalizeH3CellToResolution,
} from '@local-hosting/geokit/h3'
import type { Vocabulary, VocabPlace } from '@local-hosting/local-ai'
import type { SpatialSession } from '../types/spatial.js'
import { resolveSessionPlaceTypes } from './geotype-place-types.js'
import { resolveSpatialSession } from './session-resolve.js'
import { readPlacesRingK } from './vocab-h3-slice.js'
import { readSessionH3ResolutionCap } from './session-h3-policy.js'

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

function buildDiskRingMap(
  anchorCell: string,
  ringK: number,
  resolution: number,
): Map<string, number> {
  const center = normalizeH3CellToResolution(
    expandH3CellId(anchorCell),
    resolution,
  )
  const disk = h3Neighbors(center, ringK)
  const rings = new Map<string, number>()
  for (let i = 0; i < disk.length; i += 1) {
    const key = normalizeH3CellToResolution(disk[i]!, resolution)
    if (!rings.has(key)) {
      rings.set(key, i === 0 ? 0 : 1)
    }
  }
  return rings
}

function rankPlace(
  place: VocabPlace,
  cell: string | undefined,
  origin: Readonly<[number, number]> | null,
  diskRings: Map<string, number> | null,
  resolution: number,
): { rank: number; distance_m?: number } {
  let rank = 1000
  let distance_m: number | undefined

  if (diskRings && place.h3) {
    const placeCell = normalizeH3CellToResolution(
      expandH3CellId(place.h3),
      resolution,
    )
    const diskRank = diskRings.get(placeCell)
    if (diskRank != null) {
      return { rank: diskRank, distance_m: undefined }
    }
  }

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
  env: NodeJS.ProcessEnv = process.env,
): PlaceNearHit[] {
  const resolved = resolveSpatialSession(session, env)
  const limit = resolved.limit ?? 8
  const cell = resolved.h3_cell?.trim()
  const placeTypes = resolveSessionPlaceTypes(resolved)
  const resolution = readSessionH3ResolutionCap(env)
  const ringK = readPlacesRingK(env)
  const diskRings = cell ? buildDiskRingMap(cell, ringK, resolution) : null

  let places: VocabPlace[] = vocab.places
  if (placeTypes && placeTypes.length > 0) {
    const allowed = new Set(placeTypes.map((t) => t.toLowerCase()))
    const filtered = places.filter((p) => allowed.has(p.type.toLowerCase()))
    if (filtered.length > 0) {
      places = filtered
    }
  }

  /** Prefer H3 containment when a session cell exists (privacy-snapped centroids are not GPS). */
  const origin =
    !cell && resolved.lat != null && resolved.lon != null
      ? ([resolved.lat, resolved.lon] as const)
      : null

  const scored: PlaceNearHit[] = places.map((p) => {
    const { rank, distance_m } = rankPlace(
      p,
      cell,
      origin,
      diskRings,
      resolution,
    )
    return { id: p.id, h3: p.h3, type: p.type, rank, distance_m }
  })

  scored.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id))
  return scored.slice(0, limit)
}