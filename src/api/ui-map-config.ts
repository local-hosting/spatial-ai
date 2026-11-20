import { readSpatialAiEnv } from '../runtime/read-env.js'
import { readSessionH3ResolutionCap } from '../spatial/session-h3-policy.js'
import { readBootH3Cell } from '../spatial/read-boot-h3.js'
import {
  buildMapProviderPlan,
  mapProviderConfigured,
  type MapProvider,
  type MapProviderKeys,
} from '../map/map-provider-policy.js'

export type UiMapConfig = MapProviderKeys & {
  provider: MapProvider
  fallbackProviders: MapProvider[]
}

function pickEnv(env: NodeJS.ProcessEnv, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim()
    if (value) return value
  }
  return undefined
}

function loadMapProviderKeys(env: NodeJS.ProcessEnv): MapProviderKeys {
  const maptilerKey =
    pickEnv(env, 'MAPTILER_KEY', 'VITE_MAPTILER_KEY') ??
    readSpatialAiEnv('MAPTILER_KEY', env) ??
    pickEnv(env, 'GEOKIT_MAPTILER_KEY')
  const mapboxToken =
    pickEnv(env, 'MAPBOX_TOKEN', 'VITE_MAPBOX_TOKEN') ??
    readSpatialAiEnv('MAPBOX_TOKEN', env) ??
    pickEnv(env, 'GEOKIT_MAPBOX_TOKEN')
  const protomapsKey =
    pickEnv(env, 'PROTOMAPS_KEY', 'GEOKIT_PROTOMAPS_KEY', 'VITE_PROTOMAPS_KEY') ??
    readSpatialAiEnv('PROTOMAPS_KEY', env)

  return {
    maptilerKey: maptilerKey ?? null,
    mapboxToken: mapboxToken ?? null,
    protomapsKey: protomapsKey ?? null,
  }
}

export function loadUiMapConfig(env: NodeJS.ProcessEnv = process.env): UiMapConfig {
  const keys = loadMapProviderKeys(env)
  const forced = pickEnv(env, 'GEOKIT_MAP_PROVIDER', 'SPATIAL_AI_MAP_PROVIDER')
  const plan = buildMapProviderPlan(keys, forced)

  return {
    ...keys,
    provider: plan.provider,
    fallbackProviders: plan.fallbackProviders,
  }
}

export function uiMapConfigPublicBody(
  config: UiMapConfig,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  return {
    provider: config.provider,
    fallbackProviders: config.fallbackProviders,
    maptilerKey: config.maptilerKey,
    mapboxToken: config.mapboxToken,
    protomapsKey: config.protomapsKey,
    configured: mapProviderConfigured(config),
    sessionH3Resolution: readSessionH3ResolutionCap(env),
    bootH3Cell: readBootH3Cell(env),
  }
}