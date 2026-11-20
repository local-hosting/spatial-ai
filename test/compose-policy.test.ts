import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { ComposeIntent } from '@local-hosting/local-ai'
import {
  applyIntentComposePolicy,
  narrowEventForLabel,
} from '../src/spatial/compose-policy.js'
import type { ComposeRubric } from '../src/spatial/compose-rubric.js'

describe('compose-policy', () => {
  const rubric: ComposeRubric = {
    acceptable_action_ids: ['A_SHELTER', 'A_EVAC'],
    required_any_action_ids: ['A_SHELTER'],
  }

  beforeEach(() => {
    process.env.SPATIAL_AI_COMPOSE_POLICY = '1'
    process.env.SPATIAL_AI_COMPOSE_PLACE_REPAIR = '1'
  })

  afterEach(() => {
    delete process.env.SPATIAL_AI_COMPOSE_POLICY
    delete process.env.SPATIAL_AI_COMPOSE_PLACE_REPAIR
    delete process.env.SPATIAL_AI_COMPOSE_ACTION_CAP
  })

  it('narrows candidate_action_ids to the label pool', () => {
    const event = {
      event_id: 'e1',
      event_ref: 'E_FLOOD',
      h3_cell: 'x',
      band: 3 as const,
      trend: 'rising' as const,
      sensors_agreeing: 1,
      started_utc: '2026-01-01T00:00:00Z',
      reports: [],
      candidate_action_ids: ['A_EVAC', 'A_SHELTER', 'A_STAY', 'A_HIGHER'],
      candidate_place_ids: ['P_1'],
      candidate_resource_ids: [],
      actors: ['PR_1'],
    }
    const narrowed = narrowEventForLabel(event, rubric)
    expect(narrowed.candidate_action_ids).toEqual(['A_SHELTER', 'A_EVAC'])
  })

  it('filters stray actions and repairs empty where_to_go places', () => {
    const intent: ComposeIntent = {
      event_id: 'e1',
      event_ref: 'E_FLOOD',
      per_actor: [
        {
          actor_id: 'PR_1',
          severity: 3,
          action_ids: ['A_EVAC', 'A_SHELTER', 'A_STAY'],
          place_ids: [],
        },
      ],
      source: 'model',
      model: null,
      vocab_version: 't',
      vocab_tip: 't',
      latency_ms: 1,
    }
    const out = applyIntentComposePolicy(
      intent,
      'where_to_go',
      rubric,
      'P_RANK1',
      ['P_RANK1', 'P_OTHER'],
    )
    expect(out.per_actor[0]!.action_ids).toEqual(['A_EVAC', 'A_SHELTER'])
    expect(out.per_actor[0]!.place_ids).toEqual(['P_RANK1'])
  })

  it('prepends rank-1 when model picked only off-geo places', () => {
    const intent: ComposeIntent = {
      event_id: 'e1',
      event_ref: 'E_FLOOD',
      per_actor: [
        {
          actor_id: 'PR_1',
          severity: 3,
          action_ids: ['A_SHELTER'],
          place_ids: ['P_OFF'],
        },
      ],
      source: 'model',
      model: null,
      vocab_version: 't',
      vocab_tip: 't',
      latency_ms: 1,
    }
    const out = applyIntentComposePolicy(
      intent,
      'where_to_go',
      rubric,
      'P_RANK1',
      ['P_RANK1'],
    )
    expect(out.per_actor[0]!.place_ids[0]).toBe('P_RANK1')
  })
})