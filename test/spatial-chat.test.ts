import { describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { readMessageCorpus } from '@local-hosting/compose/messages'
import { demoVocabFixture } from '@local-hosting/local-ai'
import type { EventSummary } from '@local-hosting/local-ai'
import { runSpatialChat } from '../src/spatial/spatial-chat.js'
import { resolveSpatialSession } from '../src/spatial/session-resolve.js'

const DOMAIN_CORPORA = ['everyday', 'resilience'] as const

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

const chatOptions = {
  llamaBaseUrl: 'http://127.0.0.1:1',
  glinerBaseUrl: 'http://127.0.0.1:1',
  composeTimeoutMs: 200,
  mapTimeoutMs: 200,
}

describe('resolveSpatialSession', () => {
  it('derives h3 from lat/lon', () => {
    const session = resolveSpatialSession({ lat: 40.7128, lon: -74.006 })
    expect(session.h3_cell?.length).toBeGreaterThan(10)
  })
})

describe.each(DOMAIN_CORPORA)('runSpatialChat map (%s questions)', (corpusId) => {
  const questions = readMessageCorpus(corpusId).messages.filter((m) => m.kind === 'question')

  it(`has question fixtures (${questions.length})`, () => {
    expect(questions.length).toBeGreaterThan(0)
  })

  for (const row of questions) {
    it(`${row.id} rules-only`, async () => {
      const cell = demoVocabFixture.places[0]?.h3
      const result = await runSpatialChat(
        {
          text: row.text,
          lang: row.lang,
          vocab: demoVocabFixture,
          session: { h3_cell: cell, lat: 40.7128, lon: -74.006 },
          event: smokeEvent({ h3_cell: cell }),
          compose: { rules_only: true },
        },
        chatOptions,
      )
      expect(result.label).toBeDefined()
      expect(result.map_source).toMatch(/^spatial_/)
      expect(result.place_ids.length).toBeGreaterThan(0)
      expect(result.intent?.source).toBe('rules_fallback')
    })
  }
})

describe('runSpatialChat', () => {
  it('loads vocab by pack_mode daily (resilience-shaped question)', async () => {
    const cell = demoVocabFixture.places[0]?.h3
    const result = await runSpatialChat(
      {
        text: 'Is the shelter open right now?',
        lang: 'en',
        pack_mode: 'daily',
        session: { h3_cell: cell },
        compose: { rules_only: true },
      },
      chatOptions,
    )
    expect(result.label).toBeDefined()
    expect(result.place_ids.length).toBeGreaterThan(0)
  })
})