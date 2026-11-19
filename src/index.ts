/** Spatial layer — re-export basic local AI, then spatial helpers. */
export * from '@local-hosting/local-ai'

export { placesNear, type PlaceNearHit } from './spatial/places-near.js'
export { runSpatial, runSpatialChat, type SpatialChatOptions } from './spatial/spatial-chat.js'
export { resolveSpatialSession } from './spatial/session-resolve.js'
export { resolveSessionGeotype } from './spatial/geotype-filter.js'
export { labelToIllocution, replyForLabel } from './spatial/crosswalk.js'
export { spatialChatRequestSchema } from './spatial/schemas.js'
export { createSpatialServer, startSpatialServer } from './api/server.js'
export { loadSpatialConfig, type SpatialServiceConfig } from './api/config.js'
export type {
  SpatialSession,
  SpatialRequest,
  SpatialResult,
  SpatialChatRequest,
  SpatialChatResult,
  SpatialSource,
  SpatialComposeOptions,
} from './types/spatial.js'