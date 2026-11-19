/** Spatial layer — re-export basic local AI, then spatial helpers. */
export * from '@local-hosting/ai'

export { placesNear, type PlaceNearHit } from './spatial/places-near.js'
export { runSpatial } from './spatial/run-spatial.js'
export type {
  SpatialSession,
  SpatialRequest,
  SpatialResult,
} from './types/spatial.js'
