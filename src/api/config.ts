import {
  loadUpstreamAiConfig,
  type UpstreamAiConfig,
} from '@local-hosting/local-ai'

export type SpatialServiceConfig = {
  host: '127.0.0.1'
  port: number
} & UpstreamAiConfig

export function loadSpatialConfig(): SpatialServiceConfig {
  return {
    host: '127.0.0.1',
    port: Number(process.env.TF_SPATIAL_AI_PORT ?? 8092),
    ...loadUpstreamAiConfig(),
  }
}
