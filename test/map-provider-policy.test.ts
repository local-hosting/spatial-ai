import { describe, expect, it } from 'vitest'
import {
  buildMapProviderPlan,
  credentialForProvider,
  mapProviderConfigured,
} from '../src/map/map-provider-policy.js'

describe('buildMapProviderPlan', () => {
  it('returns empty-chain primary when no keys', () => {
    const plan = buildMapProviderPlan({
      maptilerKey: null,
      mapboxToken: null,
      protomapsKey: null,
    })
    expect(plan.provider).toBe('maptiler')
    expect(plan.fallbackProviders).toEqual([])
    expect(mapProviderConfigured({ maptilerKey: null, mapboxToken: null, protomapsKey: null })).toBe(
      false,
    )
  })

  it('prefers mapbox when mapbox and maptiler keys exist', () => {
    const keys = {
      maptilerKey: 't',
      mapboxToken: 'b',
      protomapsKey: null,
    }
    const plan = buildMapProviderPlan(keys)
    expect(plan.provider).toBe('mapbox')
    expect(plan.fallbackProviders).toEqual(['mapbox', 'maptiler'])
  })

  it('orders fallback mapbox → protomaps → maptiler when all keys set', () => {
    const keys = {
      maptilerKey: 't',
      mapboxToken: 'b',
      protomapsKey: 'p',
    }
    const plan = buildMapProviderPlan(keys)
    expect(plan.fallbackProviders).toEqual(['mapbox', 'protomaps', 'maptiler'])
  })

  it('respects forced provider when credential exists', () => {
    const keys = {
      maptilerKey: 't',
      mapboxToken: 'b',
      protomapsKey: null,
    }
    const plan = buildMapProviderPlan(keys, 'maptiler')
    expect(plan.provider).toBe('maptiler')
    expect(plan.fallbackProviders[0]).toBe('maptiler')
    expect(plan.fallbackProviders).toContain('mapbox')
  })

  it('falls back to first available when forced provider has no key', () => {
    const plan = buildMapProviderPlan(
      { maptilerKey: 't', mapboxToken: null, protomapsKey: null },
      'mapbox',
    )
    expect(plan.provider).toBe('maptiler')
  })
})

describe('credentialForProvider', () => {
  it('returns trimmed credential per provider', () => {
    expect(
      credentialForProvider(
        { maptilerKey: null, mapboxToken: ' tok ', protomapsKey: null },
        'mapbox',
      ),
    ).toEqual({ provider: 'mapbox', apiKey: 'tok' })
  })
})