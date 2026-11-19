export { placesNear, type PlaceNearHit } from './spatial/places-near.js'
export { runSpatialChat, type SpatialChatOptions } from './spatial/spatial-chat.js'
export { resolveSpatialSession } from './spatial/session-resolve.js'
export { resolveSessionGeotype } from './spatial/geotype-filter.js'
export { labelToIllocution, replyForLabel } from './spatial/crosswalk.js'
export { spatialChatRequestSchema } from './spatial/schemas.js'
export { createSpatialServer, startSpatialServer } from './api/server.js'
export { loadSpatialConfig, type SpatialServiceConfig } from './api/config.js'
export type {
  SpatialSession,
  SpatialChatRequest,
  SpatialChatResult,
  SpatialSource,
  SpatialComposeOptions,
} from './types/spatial.js'
