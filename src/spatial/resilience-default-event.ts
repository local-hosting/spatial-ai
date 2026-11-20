import { randomUUID } from 'node:crypto'
import type { EventSummary } from '@local-hosting/local-ai'

const DEFAULT_H3 = '88283472b3fffff'

export function defaultResilienceEvent(h3_cell?: string | null): EventSummary {
  return {
    event_id: randomUUID(),
    event_ref: 'E_FLOOD',
    h3_cell: h3_cell?.trim() || DEFAULT_H3,
    band: 3,
    trend: 'rising',
    sensors_agreeing: 3,
    started_utc: '2026-08-14T02:10:00Z',
    reports: [],
    candidate_action_ids: ['A_EVAC', 'A_SHELTER', 'A_STAY', 'A_HIGHER'],
    candidate_place_ids: [],
    candidate_resource_ids: [],
    actors: ['PR_1'],
  }
}