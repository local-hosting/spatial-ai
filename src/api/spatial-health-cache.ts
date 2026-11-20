import { buildHealthReport, type HealthReport } from '@local-hosting/local-ai'
import type { SpatialServiceConfig } from './config.js'
import { readSpatialAiEnv } from '../runtime/read-env.js'

const DEFAULT_TTL_MS = 5_000

type CacheSlot = {
  report: HealthReport
  at: number
}

let slot: CacheSlot | null = null

function readHealthCacheTtlMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = readSpatialAiEnv('HEALTH_CACHE_MS', env)
  if (!raw) return DEFAULT_TTL_MS
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_TTL_MS
  return n
}

export function healthAutoRulesOnly(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = readSpatialAiEnv('HEALTH_AUTO_RULES_ONLY', env)?.toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  return true
}

export async function cachedSpatialHealthReport(
  config: SpatialServiceConfig,
  loadedVocabVersion: string | null,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HealthReport> {
  const ttl = readHealthCacheTtlMs(env)
  const now = Date.now()
  if (slot && now - slot.at < ttl) {
    return slot.report
  }
  const report = await buildHealthReport({
    llamaBaseUrl: config.llamaBaseUrl,
    glinerBaseUrl: config.glinerBaseUrl,
    loadedVocabVersion,
  })
  slot = { report, at: now }
  return report
}