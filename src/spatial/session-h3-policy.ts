import { readSpatialAiEnv } from '../runtime/read-env.js'

/** Default session index: res 7 ≈ 1.2 km edge (coarser than map UI res 9). */
export const DEFAULT_SESSION_H3_RESOLUTION = 7

const H3_RES_MIN = 0
const H3_RES_MAX = 15

export function readSessionH3ResolutionCap(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = readSpatialAiEnv('SESSION_H3_RESOLUTION', env)
  if (!raw) return DEFAULT_SESSION_H3_RESOLUTION
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < H3_RES_MIN || n > H3_RES_MAX) {
    return DEFAULT_SESSION_H3_RESOLUTION
  }
  return n
}

/** Finer than the cap is rolled up; coarser explicit values are allowed. */
export function effectiveSessionH3Resolution(
  requested: number | undefined,
  cap: number,
): number {
  const base = requested ?? cap
  return Math.min(base, cap)
}