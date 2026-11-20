import { resolveSpatialSession } from '../spatial/session-resolve.js'
import { readBootH3Cell } from '../spatial/read-boot-h3.js'
import { readRegionH3Cell, readRegionH3Resolution } from '../spatial/read-region-h3.js'
import { readSessionH3ResolutionCap } from '../spatial/session-h3-policy.js'

export function uiSessionAnchorPublicBody(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  const meshH3 = readBootH3Cell(env)
  const regionH3 = readRegionH3Cell(env)
  const activeH3 = meshH3 ?? regionH3
  if (!activeH3) {
    return {
      configured: false,
      h3_cell: null,
      lat: null,
      lon: null,
      mesh_h3: null,
      region_h3: null,
    }
  }
  const res = meshH3
    ? readSessionH3ResolutionCap(env)
    : readRegionH3Resolution(env)
  const session = resolveSpatialSession(
    { h3_cell: activeH3, h3_resolution: res },
    env,
  )
  return {
    configured: true,
    h3_cell: session.h3_cell ?? activeH3,
    lat: session.lat ?? null,
    lon: session.lon ?? null,
    sessionH3Resolution: res,
    mesh_h3: meshH3,
    region_h3: regionH3,
    anchor_tier: meshH3 ? 'mesh' : 'region',
  }
}