import { describe, expect, it } from 'vitest'
import { readMessageCorpus } from '@local-hosting/compose/messages'
import { mapQuestionLexicon } from '@local-hosting/local-ai'
import {
  actionsInAcceptableSet,
  deriveComposeRubric,
  placesSubsetOfGeo,
  requiredActionsSatisfied,
} from '../eval/compose-scoring.js'
import { resilienceEvalVocabulary } from '../eval/resilience-eval-vocab.js'

const DOMAIN_CORPORA = ['everyday', 'resilience'] as const

describe('compose-scoring helpers', () => {
  it('places must stay inside geo candidate list', () => {
    expect(placesSubsetOfGeo(['P_DIS_01', 'P_DIS_02'], ['P_DIS_01', 'P_DIS_02'])).toBe(
      true,
    )
    expect(placesSubsetOfGeo(['P_DIS_99'], ['P_DIS_01'])).toBe(false)
  })
})

describe.each(DOMAIN_CORPORA)('deriveComposeRubric (%s questions)', (corpusId) => {
  const vocab = resilienceEvalVocabulary()
  const candidates = ['A_EVAC', 'A_SHELTER', 'A_STAY', 'A_HIGHER']
  const questions = readMessageCorpus(corpusId).messages.filter((m) => m.kind === 'question')

  for (const row of questions) {
    it(`${row.id} (${mapQuestionLexicon(row.text, row.lang).label})`, () => {
      const label = mapQuestionLexicon(row.text, row.lang).label
      const rubric = deriveComposeRubric(vocab, 'E_FLOOD', 3, candidates, label)
      expect(rubric.acceptable_action_ids.length).toBeGreaterThan(0)
      expect(
        actionsInAcceptableSet(
          rubric.acceptable_action_ids.slice(0, 1),
          rubric.acceptable_action_ids,
        ),
      ).toBe(true)
    })
  }
})

describe('compose-scoring resilience rubric rules', () => {
  const vocab = resilienceEvalVocabulary()
  const candidates = ['A_EVAC', 'A_SHELTER', 'A_STAY', 'A_HIGHER']

  it('where_to_go requires shelter in acceptable pool', () => {
    const rubric = deriveComposeRubric(
      vocab,
      'E_FLOOD',
      3,
      candidates,
      'where_to_go',
    )
    expect(rubric.acceptable_action_ids).toContain('A_SHELTER')
    expect(
      requiredActionsSatisfied(['A_SHELTER'], rubric.required_any_action_ids),
    ).toBe(true)
    expect(
      requiredActionsSatisfied(['A_STAY'], rubric.required_any_action_ids),
    ).toBe(false)
  })

  it('how_long rejects evac outside pool', () => {
    const rubric = deriveComposeRubric(
      vocab,
      'E_QUAKE',
      2,
      candidates,
      'how_long',
    )
    expect(actionsInAcceptableSet(['A_STAY'], rubric.acceptable_action_ids)).toBe(true)
    expect(actionsInAcceptableSet(['A_EVAC'], rubric.acceptable_action_ids)).toBe(
      false,
    )
  })
})