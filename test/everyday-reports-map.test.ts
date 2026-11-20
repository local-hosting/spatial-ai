import { describe, expect, it } from 'vitest'
import { readMessageCorpus } from '@local-hosting/compose/messages'
import { mapReportComposeFirst, mapReportLexicon } from '@local-hosting/local-ai'
import { resilienceEvalVocabulary } from '../eval/resilience-eval-vocab.js'

describe('everyday-reports map gold', () => {
  const vocab = resilienceEvalVocabulary()
  const doc = readMessageCorpus('everyday-reports')

  it(`loads ${doc.expected_count} rows with geo`, () => {
    expect(doc.messages.every((r) => r.geo_rank1_id)).toBe(true)
  })

  for (const row of doc.messages) {
    it(`${row.id} map expectations`, () => {
      const exp = row.expect_map
      expect(exp).toBeDefined()
      const lexicon = mapReportLexicon(row.text, row.lang, vocab)
      if (exp?.report_type) {
        expect(lexicon.report_type).toBe(exp.report_type)
      }
      if (exp?.compose_first) {
        const overlay = mapReportComposeFirst(row.text, row.lang, vocab)
        expect(overlay).not.toBeNull()
        if (exp.event_ref !== undefined) {
          expect(overlay!.event_ref).toBe(exp.event_ref)
        }
        if (exp.place_id !== undefined) {
          expect(overlay!.place_id).toBe(exp.place_id)
        }
      }
    })
  }
})

describe.each(['everyday', 'resilience'] as const)(
  'everyday/resilience report sessions (%s)',
  (corpusId) => {
    const reports = readMessageCorpus(corpusId).messages.filter((m) => m.kind === 'report')
    it('reports carry session when listed in corpus', () => {
      for (const row of reports) {
        expect(row.session?.lat).toBeDefined()
        expect(row.expect_map?.report_type).toBeDefined()
      }
    })
  },
)