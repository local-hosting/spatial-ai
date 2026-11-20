import { coordinatesToH3 } from '@local-hosting/geokit/h3'
import { readSpatialAiEnv } from '../runtime/read-env.js'
import { normalizeBootH3Cell, readDefaultH3CellRaw } from './read-boot-h3.js'

/** Contiguous US geographic center (static prior; no cloud geocode). */
export const US_CENTER_LAT_LON: readonly [number, number] = [39.8283, -98.5795]

const REGION_RES_MIN = 0
const REGION_RES_MAX = 15
const DEFAULT_REGION_RESOLUTION = 5

export function readRegionH3Resolution(env: NodeJS.ProcessEnv = process.env): number {
  const raw = readSpatialAiEnv('REGION_H3_RESOLUTION', env)
  if (!raw) return DEFAULT_REGION_RESOLUTION
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < REGION_RES_MIN || n > REGION_RES_MAX) {
    return DEFAULT_REGION_RESOLUTION
  }
  return n
}

export function readRegionH3CellRaw(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit =
    readSpatialAiEnv('REGION_H3_CELL', env) ??
    readSpatialAiEnv('REGION_H3', env)
  if (explicit?.trim()) return explicit.trim()

  const useUs =
    readSpatialAiEnv('REGION_DEFAULT_US', env)?.toLowerCase() ??
    readSpatialAiEnv('REGION_US', env)?.toLowerCase()
  if (useUs === '1' || useUs === 'true' || useUs === 'on') {
    const res = readRegionH3Resolution(env)
    return coordinatesToH3(res)(US_CENTER_LAT_LON)
  }
  return undefined
}

/** Regional prior — normalized at `SPATIAL_AI_REGION_H3_RESOLUTION` (default 5). */
export function readRegionH3Cell(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = readRegionH3CellRaw(env)
  if (!raw) return null
  return normalizeBootH3Cell(raw, readRegionH3Resolution(env))
}