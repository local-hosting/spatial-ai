import '@local-hosting/geokit/ui/theme.css'
import {
  buildMapProviderPlan,
  credentialForProvider,
  mapProviderConfigured,
  type MapProvider,
  type MapProviderKeys,
} from '../src/map/map-provider-policy.ts'

type SessionMapOpts = {
  latEl: HTMLInputElement
  lonEl: HTMLInputElement
}

type MapElementLike = HTMLElement & {
  flyTo?: (lat: number, lng: number, zoom?: number) => void
  setCenter?: (lat: number, lng: number) => void
  setZoom?: (zoom: number) => void
}

type SessionMapElements = {
  mapEl: MapElementLike
  pointEl: HTMLElement
  h3El: HTMLElement
}

const DEFAULT_ZOOM = 12
const MAP_READY_TIMEOUT_MS = 12_000

/** Lat/lon from the Spatial AI form (never treat 0 as “missing”). */
function readSessionCoords(
  latEl: HTMLInputElement,
  lonEl: HTMLInputElement,
): { lat: number; lon: number } | null {
  const lat = parseFloat(latEl.value)
  const lon = parseFloat(lonEl.value)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  return { lat, lon }
}

function sessionH3ResolutionFromConfig(config: UiMapConfigResponse): number {
  const n = config.sessionH3Resolution
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 15) {
    return Math.trunc(n)
  }
  return 7
}

function applyCoordsToMapTree(
  tree: SessionMapElements,
  coords: { lat: number; lon: number },
  zoom = DEFAULT_ZOOM,
  h3Resolution = 7,
): void {
  const lat = String(coords.lat)
  const lon = String(coords.lon)
  tree.mapEl.setAttribute('lat', lat)
  tree.mapEl.setAttribute('lng', lon)
  tree.mapEl.setAttribute('zoom', String(zoom))
  tree.pointEl.setAttribute('lat', lat)
  tree.pointEl.setAttribute('lng', lon)
  tree.h3El.setAttribute('lat', lat)
  tree.h3El.setAttribute('lng', lon)
  tree.h3El.setAttribute('resolution', String(h3Resolution))
  tree.h3El.removeAttribute('h3-index')
  tree.mapEl.flyTo?.(coords.lat, coords.lon, zoom)
}

type UiMapConfigResponse = MapProviderKeys & {
  provider: MapProvider
  fallbackProviders?: MapProvider[]
  configured?: boolean
  /** Server privacy cap for session H3 overlay (matches `resolveSpatialSession`). */
  sessionH3Resolution?: number
}

function keysFromViteEnv(): MapProviderKeys {
  const maptilerKey =
    import.meta.env.VITE_MAPTILER_KEY ?? import.meta.env.MAPTILER_KEY ?? null
  const mapboxToken =
    import.meta.env.VITE_MAPBOX_TOKEN ?? import.meta.env.MAPBOX_TOKEN ?? null
  const protomapsKey =
    import.meta.env.VITE_PROTOMAPS_KEY ?? import.meta.env.PROTOMAPS_KEY ?? null
  return {
    maptilerKey: maptilerKey || null,
    mapboxToken: mapboxToken || null,
    protomapsKey: protomapsKey || null,
  }
}

async function loadMapConfig(): Promise<UiMapConfigResponse> {
  try {
    const res = await fetch('/ui/map-config.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`map-config HTTP ${res.status}`)
    const body = (await res.json()) as UiMapConfigResponse
    const keys: MapProviderKeys = {
      maptilerKey: body.maptilerKey,
      mapboxToken: body.mapboxToken,
      protomapsKey: body.protomapsKey,
    }
    const fallbackPlan = buildMapProviderPlan(keys)
    const primary = isMapProvider(body.provider) ? body.provider : fallbackPlan.provider
    return {
      ...keys,
      provider: primary,
      fallbackProviders: normalizeFallbackChain(keys, body.fallbackProviders, primary),
      configured: body.configured ?? mapProviderConfigured(keys),
    }
  } catch {
    const keys = keysFromViteEnv()
    const plan = buildMapProviderPlan(keys)
    return {
      ...keys,
      ...plan,
      configured: mapProviderConfigured(keys),
    }
  }
}

function isMapProvider(value: unknown): value is MapProvider {
  return value === 'maptiler' || value === 'mapbox' || value === 'protomaps'
}

function normalizeFallbackChain(
  keys: MapProviderKeys,
  fromServer: MapProvider[] | undefined,
  primary: MapProvider,
): MapProvider[] {
  if (fromServer && fromServer.length > 0) {
    return fromServer.filter((p) => credentialForProvider(keys, p) !== null)
  }
  return buildMapProviderPlan(keys).fallbackProviders
}

function resolveFallbackChain(config: UiMapConfigResponse): MapProvider[] {
  const keys: MapProviderKeys = {
    maptilerKey: config.maptilerKey,
    mapboxToken: config.mapboxToken,
    protomapsKey: config.protomapsKey,
  }
  const chain =
    config.fallbackProviders && config.fallbackProviders.length > 0
      ? config.fallbackProviders
      : buildMapProviderPlan(keys).fallbackProviders
  return chain.filter((p) => credentialForProvider(keys, p) !== null)
}

function showMapPlaceholder(host: HTMLElement): void {
  host.classList.add('session-map-unconfigured')
  host.innerHTML = `
    <div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p class="text-sm font-medium text-slate-200">Map tiles need a provider key</p>
      <p class="max-w-xs text-xs leading-relaxed text-slate-400">
        Set <code class="text-sky-300">MAPTILER_KEY</code> (or
        <code class="text-sky-300">MAPBOX_TOKEN</code> /
        <code class="text-sky-300">PROTOMAPS_KEY</code>) in the server environment or
        <code class="text-sky-300">spatial-ai/.env</code>, then restart
        <code class="text-sky-300">yarn start</code>.
      </p>
      <p class="text-xs text-slate-500">GET <code class="text-slate-400">/ui/map-config.json</code> → configured: true</p>
    </div>
  `
}

function showMapLoadFailed(host: HTMLElement, tried: MapProvider[]): void {
  host.classList.add('session-map-unconfigured')
  const triedLabel = tried.join(' → ')
  host.innerHTML = `
    <div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
      <p class="text-sm font-medium text-slate-200">Map could not load</p>
      <p class="max-w-sm text-xs leading-relaxed text-slate-400">
        Tried providers: <code class="text-sky-300">${triedLabel}</code>.
        Check keys and network, or set <code class="text-sky-300">GEOKIT_MAP_PROVIDER</code>
        to force a provider.
      </p>
    </div>
  `
}

function createSessionMapTree(
  opts: SessionMapOpts,
  config: UiMapConfigResponse,
  provider: MapProvider,
): SessionMapElements | null {
  const keys: MapProviderKeys = {
    maptilerKey: config.maptilerKey,
    mapboxToken: config.mapboxToken,
    protomapsKey: config.protomapsKey,
  }
  const creds = credentialForProvider(keys, provider)
  if (!creds) return null

  const mapEl = document.createElement('gk-map') as MapElementLike
  mapEl.id = 'session-map'
  mapEl.className = 'block h-full w-full min-h-0'
  mapEl.setAttribute('provider', creds.provider)
  mapEl.setAttribute('theme', 'dark')
  mapEl.setAttribute(
    'map-style',
    creds.provider === 'mapbox' ? 'streets' : 'streets-v2',
  )
  mapEl.setAttribute('hide-attribution', 'true')
  mapEl.removeAttribute('access-token')
  mapEl.removeAttribute('api-key')
  if (creds.provider === 'mapbox') {
    mapEl.setAttribute('access-token', creds.apiKey)
  } else {
    mapEl.setAttribute('api-key', creds.apiKey)
  }

  const sessionCoords = readSessionCoords(opts.latEl, opts.lonEl)
  if (!sessionCoords) {
    return null
  }

  const lat = String(sessionCoords.lat)
  const lon = String(sessionCoords.lon)
  mapEl.setAttribute('zoom', String(DEFAULT_ZOOM))
  mapEl.setAttribute('lat', lat)
  mapEl.setAttribute('lng', lon)

  const pointEl = document.createElement('gk-point')
  pointEl.id = 'session-point'
  pointEl.setAttribute('lat', lat)
  pointEl.setAttribute('lng', lon)
  pointEl.setAttribute('point-id', 'session')
  pointEl.setAttribute('point-name', 'Session')
  pointEl.setAttribute('color', '#38bdf8')
  pointEl.setAttribute('size', '3')

  const h3Res = sessionH3ResolutionFromConfig(config)
  const h3El = document.createElement('gk-h3')
  h3El.id = 'session-h3'
  h3El.setAttribute('lat', lat)
  h3El.setAttribute('lng', lon)
  h3El.setAttribute('resolution', String(h3Res))
  h3El.setAttribute('ring-k', '1')
  h3El.setAttribute('color', '#38bdf8')
  h3El.setAttribute('opacity', '0.12')
  h3El.setAttribute('stroke-width', '1')

  mapEl.append(pointEl, h3El)
  return { mapEl, pointEl, h3El }
}

function waitForMapMount(mapEl: HTMLElement): Promise<'ready' | 'failed' | 'timeout'> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: 'ready' | 'failed' | 'timeout') => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      mapEl.removeEventListener('gk-map-ready', onReady)
      mapEl.removeEventListener('gk-map-failed', onFailed)
      resolve(result)
    }
    const onReady = () => finish('ready')
    const onFailed = () => finish('failed')
    const timer = window.setTimeout(() => finish('timeout'), MAP_READY_TIMEOUT_MS)
    mapEl.addEventListener('gk-map-ready', onReady, { once: true })
    mapEl.addEventListener('gk-map-failed', onFailed, { once: true })
  })
}

async function mountSessionMapWithFallback(
  host: HTMLElement,
  opts: SessionMapOpts,
  config: UiMapConfigResponse,
): Promise<SessionMapElements | null> {
  const chain = resolveFallbackChain(config)
  if (chain.length === 0) return null

  const tried: MapProvider[] = []
  host.replaceChildren()
  host.classList.remove('session-map-unconfigured')

  for (const provider of chain) {
    tried.push(provider)
    const tree = createSessionMapTree(opts, config, provider)
    if (!tree) continue

    host.append(tree.mapEl)
    const outcome = await waitForMapMount(tree.mapEl)
    if (outcome === 'ready') {
      const coords = readSessionCoords(opts.latEl, opts.lonEl)
      if (coords) {
        applyCoordsToMapTree(
          tree,
          coords,
          DEFAULT_ZOOM,
          sessionH3ResolutionFromConfig(config),
        )
      }
      if (tried.length > 1) {
        console.info(
          '[spatial-ai] map loaded after provider fallback',
          tried.join(' → '),
        )
      }
      return tree
    }

    console.warn(
      `[spatial-ai] map provider ${provider} failed (${outcome}), trying next if any`,
    )
    host.replaceChildren()
  }

  showMapLoadFailed(host, tried)
  return null
}

export async function initSessionMap(opts: SessionMapOpts): Promise<{
  syncFromInputs: () => void
  applyChatLocation: (lat: number, lon: number, h3Cell: string | null) => void
}> {
  const host = document.getElementById('session-map-host')
  if (!host) {
    throw new Error('session-map-host element missing')
  }

  const mapConfig = await loadMapConfig()
  if (mapConfig.configured === false) {
    showMapPlaceholder(host)
    return {
      syncFromInputs: () => {},
      applyChatLocation: () => {},
    }
  }

  const { configure } = await import('@local-hosting/geokit/ui/elements-lite')

  configure({
    maptiler: { apiKey: mapConfig.maptilerKey ?? undefined },
    mapbox: { accessToken: mapConfig.mapboxToken ?? undefined },
    protomaps: { apiKey: mapConfig.protomapsKey ?? undefined },
  })

  await import('@local-hosting/geokit/ui/elements-lite/register')

  const mounted = await mountSessionMapWithFallback(host, opts, mapConfig)
  if (!mounted) {
    return {
      syncFromInputs: () => {},
      applyChatLocation: () => {},
    }
  }

  const { mapEl, pointEl, h3El } = mounted
  const sessionH3Res = sessionH3ResolutionFromConfig(mapConfig)

  const resizeObserver = new ResizeObserver(() => {
    window.dispatchEvent(new Event('resize'))
  })
  resizeObserver.observe(host)

  function syncFromInputs(): void {
    const c = readSessionCoords(opts.latEl, opts.lonEl)
    if (!c) return
    applyCoordsToMapTree({ mapEl, pointEl, h3El }, c, DEFAULT_ZOOM, sessionH3Res)
  }

  function applyChatLocation(lat: number, lon: number, h3Cell: string | null): void {
    opts.latEl.value = String(lat)
    opts.lonEl.value = String(lon)
    syncFromInputs()
    if (h3Cell) {
      h3El.setAttribute('h3-index', h3Cell)
      h3El.removeAttribute('lat')
      h3El.removeAttribute('lng')
    }
  }

  syncFromInputs()
  for (const el of [opts.latEl, opts.lonEl]) {
    el.addEventListener('input', syncFromInputs)
    el.addEventListener('change', syncFromInputs)
  }

  return { syncFromInputs, applyChatLocation }
}