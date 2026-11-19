import {
  loadConfig,
  loadUpstreamAiConfig,
  readLocalAiEnv,
  type ServiceConfig,
} from '@local-hosting/local-ai'
import { readSpatialAiEnv } from '../runtime/read-env.js'

/** Spatial mesh gateway config: local-ai `ServiceConfig` plus spatial defaults. */
export type SpatialServiceConfig = ServiceConfig

function parseBindHost(raw: string | undefined): ServiceConfig['bindHost'] {
  const value = raw?.trim()
  if (value === '0.0.0.0') return '0.0.0.0'
  if (value === '127.0.0.1') return '127.0.0.1'
  return '127.0.0.1'
}

export function loadSpatialConfig(env: NodeJS.ProcessEnv = process.env): SpatialServiceConfig {
  const base = loadConfig(env)
  const port = Number(env.PORT ?? readSpatialAiEnv('PORT', env) ?? 8092)
  const spatialBind =
    readSpatialAiEnv('BIND_HOST', env) ?? readLocalAiEnv('BIND_HOST', env)
  const spatialApiKey =
    readSpatialAiEnv('API_KEY', env) ?? readLocalAiEnv('API_KEY', env)
  const spatialBoot =
    readSpatialAiEnv('BOOT_MODE', env) ?? readLocalAiEnv('BOOT_MODE', env)

  return {
    ...base,
    ...loadUpstreamAiConfig(env),
    bindHost: parseBindHost(spatialBind),
    port,
    serviceId: readSpatialAiEnv('SERVICE_ID', env) || 'spatial-ai',
    serviceVersion:
      readSpatialAiEnv('VERSION', env) ||
      base.serviceVersion,
    apiKey: spatialApiKey,
    bootMode: spatialBoot,
  }
}