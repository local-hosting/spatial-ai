import { randomUUID } from 'node:crypto'
import { triangulateH3Anchor } from './triangulate-h3.js'

export type SessionAnchorRecord = {
  observations: string[]
}

const DEFAULT_MAX_OBSERVATIONS = 12

export function readSessionObservationsMax(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = env.SPATIAL_AI_SESSION_OBSERVATIONS_MAX?.trim()
  if (!raw) return DEFAULT_MAX_OBSERVATIONS
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MAX_OBSERVATIONS
  return Math.min(n, 64)
}

export class SessionAnchorStore {
  private readonly sessions = new Map<string, SessionAnchorRecord>()

  constructor(
    /** Local mesh (`SPATIAL_AI_DEFAULT_H3_CELL`). */
    readonly meshH3: string | null,
    /** Regional prior (`SPATIAL_AI_REGION_*`). */
    readonly regionH3: string | null,
    private readonly maxObservations: number,
  ) {}

  /** @deprecated use meshH3 */
  get bootH3(): string | null {
    return this.meshH3
  }

  ensureSessionId(existing: string | undefined): string {
    const trimmed = existing?.trim()
    if (trimmed) {
      if (!this.sessions.has(trimmed)) {
        this.sessions.set(trimmed, { observations: [] })
      }
      return trimmed
    }
    const id = randomUUID()
    this.sessions.set(id, { observations: [] })
    return id
  }

  recordObservation(sessionId: string, h3_cell: string): void {
    const cell = h3_cell.trim()
    if (!cell) return
    let record = this.sessions.get(sessionId)
    if (!record) {
      record = { observations: [] }
      this.sessions.set(sessionId, record)
    }
    const prev = record.observations
    const without = prev.filter((c) => c !== cell)
    record.observations = [...without, cell].slice(-this.maxObservations)
  }

  observationCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.observations.length ?? 0
  }

  anchorH3(sessionId: string, resolution: number): string | null {
    const obs = this.sessions.get(sessionId)?.observations ?? []
    const fromObs = triangulateH3Anchor(obs, resolution)
    if (fromObs) return fromObs
    if (this.meshH3) return this.meshH3
    return this.regionH3
  }
}