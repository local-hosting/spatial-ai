import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { demoVocabFixture } from '@local-hosting/ai'
import type { EventSummary } from '@local-hosting/ai'
import { runSpatialChat } from '../src/spatial/spatial-chat.js'
import { resolveSpatialSession } from '../src/spatial/session-resolve.js'

function smokeEvent(overrides: Partial<EventSummary> = {}): EventSummary {
  return {
    event_id: randomUUID(),
    event_ref: 'E_1',
    h3_cell: '88283472b3fffff',
    band: 3,
    trend: 'rising',
    sensors_agreeing: 3,
    started_utc: '2026-08-14T02:10:00Z',
    reports: [],
    candidate_action_ids: ['A_1', 'A_2', 'A_3', 'A_4'],
    candidate_place_ids: ['P_1', 'P_2'],
    candidate_resource_ids: ['R_1'],
    actors: ['PR_1', 'PR_2'],
    ...overrides,
  }
}

describe('resolveSpatialSession', () => {
  it('derives h3 from lat/lon', () => {
    const session = resolveSpatialSession({ lat: 40.7128, lon: -74.006 })
    expect(session.h3_cell?.length).toBeGreaterThan(10)
  })
})

describe('runSpatialChat', () => {
  it('rules-only compose when rules_only set', async () => {
    const cell = demoVocabFixture.places[0]?.h3
    const result = await runSpatialChat(
      {
        text: 'where can I go that is safe?',
        lang: 'en',
        vocab: demoVocabFixture,
        session: { h3_cell: cell, lat: 40.7128, lon: -74.006 },
        event: smokeEvent({ h3_cell: cell }),
        compose: { rules_only: true },
      },
      {
        llamaBaseUrl: 'http://127.0.0.1:1',
        glinerBaseUrl: 'http://127.0.0.1:1',
        composeTimeoutMs: 200,
        mapTimeoutMs: 200,
      },
    )
    expect(result.label).toBe('where_to_go')
    expect(result.place_ids.length).toBeGreaterThan(0)
    expect(result.intent?.source).toBe('rules_fallback')
    expect(result.source).toBe('rules')
  })
})