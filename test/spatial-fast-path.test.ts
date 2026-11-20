import { describe, expect, it } from 'vitest'
import { demoVocabFixture } from '@local-hosting/local-ai'
import { trySpatialFastPathIntent } from '../src/spatial/spatial-fast-path.js'
import { deriveComposeRubric } from '../src/spatial/compose-rubric.js'

const event = {
  event_id: 'e1',
  event_ref: 'E_1',
  h3_cell: '88283472b3fffff',
  band: 3 as const,
  trend: 'rising' as const,
  sensors_agreeing: 2,
  started_utc: '2026-01-01T00:00:00Z',
  reports: [],
  candidate_action_ids: ['A_SHELTER', 'A_EVAC', 'A_STAY'],
  candidate_place_ids: ['P_1', 'P_2', 'P_3'],
  candidate_resource_ids: [],
  actors: ['PR_1'],
}

describe('trySpatialFastPathIntent', () => {
  it('returns rules intent when rubric and rank-1 align', () => {
    const rubric = deriveComposeRubric(
      demoVocabFixture,
      'E_1',
      3,
      event.candidate_action_ids,
      'where_to_go',
    )
    const intent = trySpatialFastPathIntent(
      demoVocabFixture,
      event,
      rubric,
      'where_to_go',
      'spatial_lexicon',
      0.9,
      'P_1',
      ['P_1', 'P_2'],
    )
    expect(intent?.source).toBe('rules_fallback')
    expect(intent?.per_actor[0]?.place_ids).toContain('P_1')
  })
})