import { describe, expect, it } from 'vitest'
import {
  packModeForSpatialMode,
  prepareSpatialChatRequest,
  resolveSpatialMode,
} from '../src/spatial/spatial-mode.js'

describe('spatial mode', () => {
  it('defaults to everyday', () => {
    expect(resolveSpatialMode({}, {})).toBe('everyday')
  })

  it('maps pack_mode resilience', () => {
    expect(resolveSpatialMode({ pack_mode: 'resilience' }, {})).toBe('resilience')
  })

  it('mode overrides pack_mode', () => {
    expect(
      resolveSpatialMode(
        { mode: 'everyday', pack_mode: 'resilience' },
        {},
      ),
    ).toBe('everyday')
  })

  it('prepare sets pack and resilience event', () => {
    const { request, mode } = prepareSpatialChatRequest(
      { text: 'help', lang: 'en', mode: 'resilience' },
      { SPATIAL_AI_RESILIENCE_AUTO_EVENT: '1' },
    )
    expect(mode).toBe('resilience')
    expect(request.pack_mode).toBe('resilience')
    expect(request.event?.event_ref).toBe('E_FLOOD')
  })

  it('everyday has no auto event', () => {
    const { request } = prepareSpatialChatRequest(
      { text: 'hi', lang: 'en', mode: 'everyday' },
      {},
    )
    expect(packModeForSpatialMode('everyday')).toBe('daily')
    expect(request.event).toBeUndefined()
  })
})