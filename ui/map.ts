import '@local-hosting/geokit/ui/theme.css'

type SessionMapOpts = {
  latEl: HTMLInputElement
  lonEl: HTMLInputElement
}

type MapElementLike = HTMLElement & {
  flyTo?: (opts: { center: [number, number]; zoom?: number; duration?: number }) => void
}

type UiMapConfigResponse = {
  provider: 'maptiler' | 'mapbox' | 'protomaps'
  maptilerKey: string | null
  mapboxToken: string | null
  protomapsKey: string | null
  configured?: boolean
}

const DEFAULT_ZOOM = 12

async function loadMapConfig(): Promise<UiMapConfigResponse> {
  try {
    const res = await fetch('/ui/map-config.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`map-config HTTP ${res.status}`)
    return (await res.json()) as UiMapConfigResponse
  } catch {
    const maptilerKey =
      import.meta.env.VITE_MAPTILER_KEY ?? import.meta.env.MAPTILER_KEY ?? null
    const mapboxToken =
      import.meta.env.VITE_MAPBOX_TOKEN ?? import.meta.env.MAPBOX_TOKEN ?? null
    const protomapsKey =
      import.meta.env.VITE_PROTOMAPS_KEY ?? import.meta.env.PROTOMAPS_KEY ?? null
    return {
      provider: maptilerKey
        ? 'maptiler'
        : mapboxToken
          ? 'mapbox'
          : protomapsKey
            ? 'protomaps'
            : 'maptiler',
      maptilerKey,
      mapboxToken,
      protomapsKey,
      configured: Boolean(maptilerKey || mapboxToken || protomapsKey),
    }
  }
}

function resolveMapCredentials(
  config: UiMapConfigResponse,
): { provider: UiMapConfigResponse['provider']; apiKey: string } | null {
  if (config.configured === false) return null
  if (config.provider === 'mapbox') {
    const token = config.mapboxToken?.trim()
    return token ? { provider: 'mapbox', apiKey: token } : null
  }
  if (config.provider === 'protomaps') {
    const key = config.protomapsKey?.trim()
    return key ? { provider: 'protomaps', apiKey: key } : null
  }
  const key = config.maptilerKey?.trim()
  return key ? { provider: 'maptiler', apiKey: key } : null
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

export async function initSessionMap(opts: SessionMapOpts): Promise<{
  syncFromInputs: () => void
  applyChatLocation: (lat: number, lon: number, h3Cell: string | null) => void
}> {
  const host = document.getElementById('session-map-host')
  if (!host) {
    throw new Error('session-map-host element missing')
  }

  const mapConfig = await loadMapConfig()
  const creds = resolveMapCredentials(mapConfig)

  if (!creds) {
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
  mapEl.setAttribute('zoom', String(DEFAULT_ZOOM))
  mapEl.setAttribute('lat', opts.latEl.value || '40.7128')
  mapEl.setAttribute('lng', opts.lonEl.value || '-74.006')
  if (creds.provider === 'mapbox') {
    mapEl.setAttribute('access-token', creds.apiKey)
  } else {
    mapEl.setAttribute('api-key', creds.apiKey)
  }

  const pointEl = document.createElement('gk-point')
  pointEl.id = 'session-point'
  pointEl.setAttribute('lat', opts.latEl.value || '40.7128')
  pointEl.setAttribute('lng', opts.lonEl.value || '-74.006')
  pointEl.setAttribute('point-id', 'session')
  pointEl.setAttribute('point-name', 'Session')
  pointEl.setAttribute('color', '#38bdf8')
  pointEl.setAttribute('size', '3')

  const h3El = document.createElement('gk-h3')
  h3El.id = 'session-h3'
  h3El.setAttribute('lat', opts.latEl.value || '40.7128')
  h3El.setAttribute('lng', opts.lonEl.value || '-74.006')
  h3El.setAttribute('resolution', '9')
  h3El.setAttribute('ring-k', '1')
  h3El.setAttribute('color', '#38bdf8')
  h3El.setAttribute('opacity', '0.12')
  h3El.setAttribute('stroke-width', '1')

  mapEl.append(pointEl, h3El)
  host.append(mapEl)

  const resizeObserver = new ResizeObserver(() => {
    window.dispatchEvent(new Event('resize'))
  })
  resizeObserver.observe(host)

  function readCoords(): { lat: number; lon: number } | null {
    const lat = parseFloat(opts.latEl.value)
    const lon = parseFloat(opts.lonEl.value)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    return { lat, lon }
  }

  function syncFromInputs(): void {
    const c = readCoords()
    if (!c) return
    const lat = String(c.lat)
    const lon = String(c.lon)
    mapEl.setAttribute('lat', lat)
    mapEl.setAttribute('lng', lon)
    pointEl.setAttribute('lat', lat)
    pointEl.setAttribute('lng', lon)
    h3El.setAttribute('lat', lat)
    h3El.setAttribute('lng', lon)
    h3El.setAttribute('resolution', '9')
    h3El.removeAttribute('h3-index')
    mapEl.flyTo?.({
      center: [c.lon, c.lat],
      zoom: DEFAULT_ZOOM,
      duration: 600,
    })
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
  opts.latEl.addEventListener('change', syncFromInputs)
  opts.lonEl.addEventListener('change', syncFromInputs)

  return { syncFromInputs, applyChatLocation }
}