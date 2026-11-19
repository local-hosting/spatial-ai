import type { ServiceConfig } from '@local-hosting/local-ai'

export const LOCAL_AI_HTTP_ROUTES = [
  'GET /',
  'GET /health',
  'POST /generate',
  'POST /compose',
  'POST /map/question',
  'POST /map/report',
  'POST /vocab/session',
] as const

export const SPATIAL_HTTP_ROUTES = [
  'GET /ui',
  'POST /spatial',
  'POST /chat',
] as const

export function spatialServiceInfoBody(config: ServiceConfig) {
  return {
    ok: true as const,
    service: config.serviceId,
    version: config.serviceVersion,
    ...(config.bootMode ? { boot_mode: config.bootMode } : {}),
    superset: true,
    layers: ['@local-hosting/spatial-ai', '@local-hosting/local-ai'],
    routes: {
      spatial: [...SPATIAL_HTTP_ROUTES],
      local_ai: [...LOCAL_AI_HTTP_ROUTES],
    },
  }
}