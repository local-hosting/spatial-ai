import { describe, expect, it } from 'vitest'
import { resolveSessionVocab } from '@local-hosting/local-ai'
import { resolveSpatialSession } from '../src/spatial/session-resolve.js'
import { applyLabelGeotypeToSession } from '../src/spatial/geotype-from-label.js'
import { sliceVocabForAnchor } from '../src/spatial/vocab-h3-slice.js'
import { placesNear } from '../src/spatial/places-near.js'

describe('placesNear resilience pack', () => {
  it('returns places for where_to_go at mesh H3', () => {
    const vocab = resolveSessionVocab({ pack_mode: 'resilience' })
    expect(vocab).toBeTruthy()
    const session = resolveSpatialSession(
      applyLabelGeotypeToSession({ h3_cell: '88283472b3fffff' }, 'where_to_go'),
    )
    const hits = placesNear(sliceVocabForAnchor(vocab!, session.h3_cell), session)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((h) => h.id === 'P_shelter' || h.id === 'P_lobby')).toBe(true)
  })
})