import {
  coordinatesToH3,
  h3ToCoordinates,
  normalizeH3CellToResolution,
} from '@local-hosting/geokit/h3'

/**
 * Center of multiple H3 observations at one resolution (mean centroid → snap).
 */
export function triangulateH3Anchor(
  cells: readonly string[],
  resolution: number,
): string | null {
  if (cells.length === 0) return null
  const normalized = cells.map((c) =>
    normalizeH3CellToResolution(c.trim(), resolution),
  )
  if (normalized.length === 1) {
    return normalized[0]!
  }

  let sumLat = 0
  let sumLon = 0
  for (const cell of normalized) {
    const [lat, lon] = h3ToCoordinates(cell)
    sumLat += lat
    sumLon += lon
  }
  const meanLat = sumLat / normalized.length
  const meanLon = sumLon / normalized.length
  return coordinatesToH3(resolution)([meanLat, meanLon])
}