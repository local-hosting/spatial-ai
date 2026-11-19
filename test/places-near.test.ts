import { describe, expect, it } from 'vitest'
import { demoVocabFixture, mapQuestionLexicon } from '@local-hosting/local-ai'
import { placesNear } from '../src/spatial/places-near.js'
import { resolveSpatialSession } from '../src/spatial/session-resolve.js'

describe('placesNear', () => {
  it('ranks by H3 prefix when session cell is set', () => {
    const cell = demoVocabFixture.places[0]?.h3
    expect(cell).toBeTruthy()
    const hits = placesNear(demoVocabFixture, { h3_cell: cell, limit: 3 })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]?.id).toBe(demoVocabFixture.places[0]?.id)
  })

  it('filters by geotype / place type', () => {
    const type = demoVocabFixture.places[0]?.type
    const hits = placesNear(demoVocabFixture, { geotype: type })
    expect(hits.every((h) => h.type === type)).toBe(true)
  })
})

describe('spatial lexicon + places', () => {
  it('maps where-to-go and returns place ids', () => {
    const session = resolveSpatialSession({
      h3_cell: demoVocabFixture.places[0]?.h3,
    })
    const mapped = mapQuestionLexicon('where can I go that is safe?', 'en')
    const hits = placesNear(demoVocabFixture, session)
    expect(mapped.label).toBe('where_to_go')
    expect(Boolean(session.h3_cell)).toBe(true)
    expect(hits.length).toBeGreaterThan(0)
  })
})
