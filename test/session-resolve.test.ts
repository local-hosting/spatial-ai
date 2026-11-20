import { describe, expect, it } from 'vitest'
import { getResolution } from 'h3-js'
import { coordinatesToH3 } from '@local-hosting/geokit/h3'
import { resolveSpatialSession } from '../src/spatial/session-resolve.js'

const NYC: [number, number] = [40.7128, -74.006]

describe('resolveSpatialSession (privacy H3)', () => {
  it('derives res-7 cell by default and snaps to centroid', () => {
    const session = resolveSpatialSession({ lat: NYC[0], lon: NYC[1] })
    expect(session.h3_cell).toBeTruthy()
    expect(getResolution(session.h3_cell!)).toBe(7)
    expect(session.lat).not.toBe(NYC[0])
    expect(session.lon).not.toBe(NYC[1])
  })

  it('snaps mesh boot cell centroid near source (compact id safe)', () => {
    const session = resolveSpatialSession({ h3_cell: '88283472b3fffff' })
    expect(session.lat).toBeGreaterThan(36)
    expect(session.lat).toBeLessThan(38)
    expect(session.lon).toBeLessThan(-121)
    expect(session.lon).toBeGreaterThan(-123)
  })

  it('coarsens a finer client h3_cell', () => {
    const fine = coordinatesToH3(9)(NYC)
    const session = resolveSpatialSession({ h3_cell: fine })
    expect(getResolution(session.h3_cell!)).toBeLessThanOrEqual(7)
  })

  it('honors SPATIAL_AI_SESSION_H3_RESOLUTION cap', () => {
    const session = resolveSpatialSession(
      { lat: NYC[0], lon: NYC[1], h3_resolution: 9 },
      { SPATIAL_AI_SESSION_H3_RESOLUTION: '6' },
    )
    expect(getResolution(session.h3_cell!)).toBe(6)
  })
})