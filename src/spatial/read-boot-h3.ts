import { getResolution, isValidCell } from 'h3-js'
import { expandH3CellId, normalizeH3CellToResolution } from '@local-hosting/geokit/h3'
import { readSpatialAiEnv } from '../runtime/read-env.js'
import { readSessionH3ResolutionCap } from './session-h3-policy.js'

export function readDefaultH3CellRaw(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return (
    readSpatialAiEnv('DEFAULT_H3_CELL', env) ??
    readSpatialAiEnv('DEFAULT_H3', env)
  )
}

export function normalizeBootH3Cell(
  raw: string,
  resolution: number,
): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const expanded = expandH3CellId(trimmed)
  if (!isValidCell(expanded)) return null
  try {
    getResolution(expanded)
  } catch {
    return null
  }
  return normalizeH3CellToResolution(expanded, resolution)
}

/** Local mesh anchor — coarsened to `SPATIAL_AI_SESSION_H3_RESOLUTION`. */
export function readBootH3Cell(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = readDefaultH3CellRaw(env)
  if (!raw) return null
  return normalizeBootH3Cell(raw, readSessionH3ResolutionCap(env))
}