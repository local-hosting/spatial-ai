export type MapProvider = 'maptiler' | 'mapbox' | 'protomaps'

export type MapProviderKeys = {
  maptilerKey: string | null
  mapboxToken: string | null
  protomapsKey: string | null
}

export type MapProviderPlan = {
  provider: MapProvider
  /** Primary first, then alternates with credentials (loopback-friendly order). */
  fallbackProviders: MapProvider[]
}

/** Default try order when no provider is forced — Mapbox before MapTiler for loopback referrers. */
const DEFAULT_TRY_ORDER: MapProvider[] = ['mapbox', 'protomaps', 'maptiler']

function hasCredential(provider: MapProvider, keys: MapProviderKeys): boolean {
  switch (provider) {
    case 'mapbox':
      return Boolean(keys.mapboxToken?.trim())
    case 'maptiler':
      return Boolean(keys.maptilerKey?.trim())
    case 'protomaps':
      return Boolean(keys.protomapsKey?.trim())
    default: {
      const _exhaustive: never = provider
      return _exhaustive
    }
  }
}

function providersWithCredentials(
  keys: MapProviderKeys,
  order: readonly MapProvider[] = DEFAULT_TRY_ORDER,
): MapProvider[] {
  return order.filter((p) => hasCredential(p, keys))
}

function isMapProvider(value: string | undefined): value is MapProvider {
  return value === 'maptiler' || value === 'mapbox' || value === 'protomaps'
}

/**
 * Chooses primary provider and an ordered fallback chain (each entry has a key).
 */
export function buildMapProviderPlan(
  keys: MapProviderKeys,
  forcedProvider?: string | null,
): MapProviderPlan {
  const available = providersWithCredentials(keys)
  const forcedRaw = forcedProvider?.trim()
  const forced = isMapProvider(forcedRaw) ? forcedRaw : undefined

  let provider: MapProvider = 'maptiler'
  if (forced) {
    provider = hasCredential(forced, keys)
      ? forced
      : (available[0] ?? 'maptiler')
  } else {
    provider = available[0] ?? 'maptiler'
  }

  const fallbackProviders = hasCredential(provider, keys)
    ? [
        provider,
        ...DEFAULT_TRY_ORDER.filter((p) => p !== provider && hasCredential(p, keys)),
      ]
    : []

  return { provider, fallbackProviders }
}

export function mapProviderConfigured(keys: MapProviderKeys): boolean {
  return providersWithCredentials(keys).length > 0
}

export function credentialForProvider(
  keys: MapProviderKeys,
  provider: MapProvider,
): { provider: MapProvider; apiKey: string } | null {
  if (!hasCredential(provider, keys)) return null
  switch (provider) {
    case 'mapbox': {
      const token = keys.mapboxToken!.trim()
      return { provider: 'mapbox', apiKey: token }
    }
    case 'protomaps': {
      const key = keys.protomapsKey!.trim()
      return { provider: 'protomaps', apiKey: key }
    }
    case 'maptiler': {
      const key = keys.maptilerKey!.trim()
      return { provider: 'maptiler', apiKey: key }
    }
    default: {
      const _exhaustive: never = provider
      return _exhaustive
    }
  }
}