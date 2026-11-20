import { describe, expect, it } from 'vitest'
import { resilienceEvalVocabulary } from '../eval/resilience-eval-vocab.js'
import { filterPlacesInH3Disk } from '../src/spatial/vocab-h3-slice.js'
import { RESILIENCE_EVAL_CENTROID } from '../eval/resilience-eval-vocab.js'

describe('filterPlacesInH3Disk', () => {
  it('keeps places inside k-ring of anchor', () => {
    const vocab = resilienceEvalVocabulary()
    const sliced = filterPlacesInH3Disk(
      vocab.places,
      RESILIENCE_EVAL_CENTROID.h3_cell,
      1,
      9,
    )
    expect(sliced.length).toBeGreaterThan(0)
    expect(sliced.length).toBeLessThanOrEqual(vocab.places.length)
  })
})