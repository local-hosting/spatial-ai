import { describe, expect, it } from 'vitest'
import { readMessageCorpus } from '@local-hosting/compose/messages'
import { mapQuestionLexicon } from '@local-hosting/local-ai'

describe('everyday-spatial corpus', () => {
  const doc = readMessageCorpus('everyday-spatial')

  it('loads 8 geo-annotated questions', () => {
    expect(doc.messages).toHaveLength(8)
    for (const row of doc.messages) {
      expect(row.kind).toBe('question')
      expect(row.session).toBeDefined()
      expect(row.geo_rank1_id).toMatch(/^P_DIS_/)
      expect(row.expected_map_label).toBeDefined()
    }
  })

  for (const row of doc.messages) {
    it(`${row.id} lexicon matches expected_map_label`, () => {
      const mapped = mapQuestionLexicon(row.text, row.lang)
      expect(mapped.label).toBe(row.expected_map_label)
    })
  }
})