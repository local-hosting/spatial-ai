import { afterEach, describe, expect, it } from 'vitest'
import { loadSpatialConfig } from '../src/api/config.js'

describe('loadSpatialConfig', () => {
  const env = { ...process.env }

  afterEach(() => {
    process.env = { ...env }
  })

  it('defaults to loopback 8092', () => {
    delete process.env.SPATIAL_AI_BIND_HOST
    delete process.env.PORT
    const config = loadSpatialConfig()
    expect(config.bindHost).toBe('127.0.0.1')
    expect(config.port).toBe(8092)
    expect(config.serviceId).toBe('spatial-ai')
  })

  it('honors SPATIAL_AI_BIND_HOST and PORT', () => {
    process.env.SPATIAL_AI_BIND_HOST = '0.0.0.0'
    process.env.PORT = '9000'
    const config = loadSpatialConfig()
    expect(config.bindHost).toBe('0.0.0.0')
    expect(config.port).toBe(9000)
  })
})