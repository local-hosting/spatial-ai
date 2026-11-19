import { cellToLatLng, latLngToCell } from 'h3-js'

type LatLon = readonly [number, number]

/** H3 helpers (h3-js, same backend as @local-hosting/geokit/h3). */
export function coordinatesToH3(
  resolution = 9,
): (coordinates: LatLon) => string {
  return ([lat, lon]) => latLngToCell(lat, lon, resolution)
}

export function h3ToCoordinates(h3Index: string): [number, number] {
  const [lat, lon] = cellToLatLng(h3Index)
  return [lat, lon]
}