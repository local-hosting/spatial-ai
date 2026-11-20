import { describe, expect, it } from 'vitest'
import { composeWords } from '@local-hosting/compose'
import { readMessageCorpus } from '@local-hosting/compose/messages'
import { mapQuestionLexicon } from '@local-hosting/local-ai'
import { labels, table } from '../../compose/test/fixtures.js'
import { deriveComposeRubric } from '../src/spatial/compose-rubric.js'
import { resilienceEvalVocabulary } from '../eval/resilience-eval-vocab.js'

const DOMAIN_CORPORA = ['everyday', 'resilience'] as const
const CANDIDATES = ['A_EVAC', 'A_SHELTER', 'A_STAY', 'A_HIGHER'] as const

describe.each(DOMAIN_CORPORA)('composeWords (%s corpus)', (corpusId) => {
  const doc = readMessageCorpus(corpusId)

  it(`loads ${doc.expected_count} rows`, () => {
    expect(doc.messages).toHaveLength(doc.expected_count)
  })

  for (const row of doc.messages) {
    it(`${row.id} (${row.lang})`, () => {
      const result = composeWords(row.text, table, labels, row.lang)
      expect(result.ok).toBe(row.expect?.compose_ok ?? true)
    })
  }
})

describe.each(DOMAIN_CORPORA)('map + rubric on questions (%s corpus)', (corpusId) => {
  const vocab = resilienceEvalVocabulary()
  const questions = readMessageCorpus(corpusId).messages.filter((m) => m.kind === 'question')

  for (const row of questions) {
    it(row.id, () => {
      const mapped = mapQuestionLexicon(row.text, row.lang)
      const rubric = deriveComposeRubric(
        vocab,
        'E_FLOOD',
        3,
        [...CANDIDATES],
        mapped.label,
      )
      expect(rubric.acceptable_action_ids.length).toBeGreaterThan(0)
    })
  }
})
