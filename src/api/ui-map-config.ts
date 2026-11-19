import { readSpatialAiEnv } from '../runtime/read-env.js'

export type UiMapConfig = {
  provider: 'maptiler' | 'mapbox' | 'protomaps'
  maptilerKey: string | null
  mapboxToken: string | null
  protomapsKey: string | null
}

function pickEnv(env: NodeJS.ProcessEnv, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim()
    if (value) return value
  }
  return undefined
}

export function loadUiMapConfig(env: NodeJS.ProcessEnv = process.env): UiMapConfig {
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

  const forced = pickEnv(env, 'GEOKIT_MAP_PROVIDER', 'SPATIAL_AI_MAP_PROVIDER') as
    | UiMapConfig['provider']
    | undefined

  let provider: UiMapConfig['provider'] = 'maptiler'
  if (forced === 'maptiler' || forced === 'mapbox' || forced === 'protomaps') {
    provider = forced
  } else if (mapboxToken) {
    // Mapbox tokens usually allow loopback Referer; MapTiler keys are often URL-locked.
    provider = 'mapbox'
  } else if (maptilerKey) {
    provider = 'maptiler'
  } else if (protomapsKey) {
    provider = 'protomaps'
  }

  const hasKeyForProvider =
    (provider === 'maptiler' && Boolean(maptilerKey)) ||
    (provider === 'mapbox' && Boolean(mapboxToken)) ||
    (provider === 'protomaps' && Boolean(protomapsKey))

  if (!hasKeyForProvider) {
    if (maptilerKey) provider = 'maptiler'
    else if (mapboxToken) provider = 'mapbox'
    else if (protomapsKey) provider = 'protomaps'
  }

  return {
    provider,
    maptilerKey: maptilerKey ?? null,
    mapboxToken: mapboxToken ?? null,
    protomapsKey: protomapsKey ?? null,
  }
}

export function uiMapConfigPublicBody(config: UiMapConfig): Record<string, unknown> {
  return {
    provider: config.provider,
    maptilerKey: config.maptilerKey,
    mapboxToken: config.mapboxToken,
    protomapsKey: config.protomapsKey,
    configured: Boolean(
      config.maptilerKey || config.mapboxToken || config.protomapsKey,
    ),
  }
}