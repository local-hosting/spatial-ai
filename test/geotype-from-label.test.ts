import { describe, expect, it } from 'vitest'
import {
  applyLabelGeotypeToSession,
  geotypeHintFromMapLabel,
} from '../src/spatial/geotype-from-label.js'

describe('geotype-from-label', () => {
  it('maps where_to_go to shelter intent', () => {
    expect(geotypeHintFromMapLabel('where_to_go')).toBe('shelter')
  })

  it('maps kid safety to kids intent', () => {
    expect(geotypeHintFromMapLabel('is_it_safe_for_kids')).toBe('kids')
  })

  it('does not override explicit session geotype', () => {
    const session = applyLabelGeotypeToSession(
      { geotype: 'hospital' },
      'where_to_go',
    )
    expect(session.geotype).toBe('hospital')
  })
})