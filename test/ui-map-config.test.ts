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
  })
})