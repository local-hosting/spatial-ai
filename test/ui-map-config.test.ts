import { describe, expect, it } from 'vitest'
import { loadUiMapConfig, uiMapConfigPublicBody } from '../src/api/ui-map-config.js'

describe('loadUiMapConfig', () => {
  it('reports configured false when no map keys', () => {
    const body = uiMapConfigPublicBody(
      loadUiMapConfig({
        NODE_ENV: 'test',
      }),
    )
    expect(body.configured).toBe(false)
    expect(body.fallbackProviders).toEqual([])
  })

  it('prefers mapbox when both maptiler and mapbox keys are set', () => {
    const body = uiMapConfigPublicBody(
      loadUiMapConfig({
        MAPTILER_KEY: 'tiler-key',
        MAPBOX_TOKEN: 'mapbox-token',
      }),
    )
    expect(body.configured).toBe(true)
    expect(body.provider).toBe('mapbox')
    expect(body.fallbackProviders).toEqual(['mapbox', 'maptiler'])
  })

  it('picks maptiler when only MAPTILER_KEY is set', () => {
    const body = uiMapConfigPublicBody(
      loadUiMapConfig({
        MAPTILER_KEY: 'test-key',
      }),
    )
    expect(body.configured).toBe(true)
    expect(body.provider).toBe('maptiler')
    expect(body.maptilerKey).toBe('test-key')
    expect(body.fallbackProviders).toEqual(['maptiler'])
  })

  it('honors GEOKIT_MAP_PROVIDER when key exists', () => {
    const body = uiMapConfigPublicBody(
      loadUiMapConfig({
        MAPTILER_KEY: 't',
        MAPBOX_TOKEN: 'b',
        GEOKIT_MAP_PROVIDER: 'maptiler',
      }),
    )
    expect(body.provider).toBe('maptiler')
    const fallbacks = body.fallbackProviders as string[]
    expect(fallbacks[0]).toBe('maptiler')
    expect(fallbacks).toContain('mapbox')
  })

  it('re-routes forced provider when matching key is missing', () => {
    const body = uiMapConfigPublicBody(
      loadUiMapConfig({
        MAPTILER_KEY: 't',
        GEOKIT_MAP_PROVIDER: 'mapbox',
      }),
    )
    expect(body.provider).toBe('maptiler')
  })
})