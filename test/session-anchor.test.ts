import { describe, expect, it } from 'vitest'
import { coordinatesToH3, normalizeH3CellToResolution } from '@local-hosting/geokit/h3'
import { triangulateH3Anchor } from '../src/spatial/triangulate-h3.js'
import { SessionAnchorStore } from '../src/spatial/session-anchor-store.js'
import { readRegionH3Cell } from '../src/spatial/read-region-h3.js'
import { applyRequestSessionAnchor } from '../src/spatial/apply-request-session-anchor.js'

const NYC: [number, number] = [40.7128, -74.006]

describe('triangulateH3Anchor', () => {
  it('returns single cell unchanged at resolution', () => {
    const cell = coordinatesToH3(7)(NYC)
    expect(triangulateH3Anchor([cell], 7)).toBe(
      normalizeH3CellToResolution(cell, 7),
    )
  })

  it('averages two distinct cells', () => {
    const a = coordinatesToH3(7)(NYC)
    const b = coordinatesToH3(7)([40.82, -74.08])
    expect(a).not.toBe(b)
    const merged = triangulateH3Anchor([a, b], 7)
    expect(merged).toBeTruthy()
    expect(merged).not.toBe(a)
  })
})

describe('SessionAnchorStore', () => {
  const boot = normalizeH3CellToResolution(coordinatesToH3(7)(NYC), 7)

  it('uses boot H3 when no observations', () => {
    const store = new SessionAnchorStore(boot, null, 8)
    const id = store.ensureSessionId(undefined)
    expect(store.anchorH3(id, 7)).toBe(boot)
  })

  it('falls back to region H3 when mesh unset', () => {
    const region = readRegionH3Cell({ SPATIAL_AI_REGION_DEFAULT_US: '1' })
    expect(region).toBeTruthy()
    const store = new SessionAnchorStore(null, region, 8)
    const id = store.ensureSessionId('r1')
    expect(store.anchorH3(id, 5)).toBe(region)
  })

  it('triangulates after observations', () => {
    const store = new SessionAnchorStore(boot, null, 8)
    const id = store.ensureSessionId('t1')
    const a = coordinatesToH3(7)(NYC)
    const b = coordinatesToH3(7)([40.82, -74.08])
    store.recordObservation(id, a)
    store.recordObservation(id, b)
    expect(store.observationCount(id)).toBe(2)
    expect(store.anchorH3(id, 7)).toBeTruthy()
  })
})

describe('applyRequestSessionAnchor', () => {
  const boot = normalizeH3CellToResolution(coordinatesToH3(7)(NYC), 7)

  it('anchors to boot H3 without client geo', () => {
    const store = new SessionAnchorStore(boot, null, 8)
    const { request, meta } = applyRequestSessionAnchor(
      { text: 'hello', lang: 'en', pack_mode: 'daily' },
      store,
    )
    expect(meta.anchor_h3).toBe(boot)
    expect(request.session?.h3_cell).toBe(boot)
    expect(meta.session_id).toBeTruthy()
  })

  it('records client h3 and reuses session id', () => {
    const store = new SessionAnchorStore(null, null, 8)
    const cell = coordinatesToH3(7)([40.75, -73.99])
    const first = applyRequestSessionAnchor(
      {
        text: 'q1',
        lang: 'en',
        pack_mode: 'daily',
        session: { h3_cell: cell },
      },
      store,
    )
    const second = applyRequestSessionAnchor(
      {
        text: 'q2',
        lang: 'en',
        pack_mode: 'daily',
        session_id: first.meta.session_id,
        session: { h3_cell: cell },
      },
      store,
    )
    expect(second.meta.session_id).toBe(first.meta.session_id)
    expect(second.meta.observation_count).toBeGreaterThan(0)
  })
})