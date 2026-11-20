import { resolveSessionGeotype } from './geotype-filter.js'
import type { SpatialSession } from '../types/spatial.js'

/**
 * Offline place `type` slugs in community packs (not geotypes catalog ids).
 * Keys are session geotype hints from map labels.
 */
const GEOTYPE_PLACE_TYPES: Record<string, readonly string[]> = {
  shelter: [
    'shelter',
    'campground',
    'hospital',
    'train_station',
    'public_park',
  ],
  kids: ['school', 'university', 'hospital', 'public_park'],
  place: [
    'place',
    'public_park',
    'campground',
    'hospital',
    'cafe',
    'grocery_store',
    'train_station',
  ],
}

export function placeTypesForGeotypeHint(hint: string): readonly string[] {
  const key = hint.trim().toLowerCase()
  return GEOTYPE_PLACE_TYPES[key] ?? [key]
}

export function resolveSessionPlaceTypes(
  session: SpatialSession,
): readonly string[] | undefined {
  const raw = session.geotype?.trim()
  if (!raw) return undefined
  const hint = resolveSessionGeotype(session) ?? raw.toLowerCase()
  return placeTypesForGeotypeHint(hint)
}