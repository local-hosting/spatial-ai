import { SUPPORTED_LANGUAGES, type Vocabulary } from '@local-hosting/local-ai'

/** Centroid ≈ demo fixture cell (SF bay area sample res-9). */
export const RESILIENCE_EVAL_CENTROID = {
  lat: 37.7749,
  lon: -122.4194,
  h3_cell: '88283472b3fffff',
} as const

const H3_NEAR = [
  '88283472b3fffff',
  '88283472b5fffff',
  '88283472b7fffff',
  '88283472b1fffff',
  '88283472b9fffff',
  '88283472bbfffff',
  '88283472bdfffff',
  '88283470b3fffff',
  '88283470b5fffff',
  '88283470b7fffff',
  '88283472affffff',
  '88283472abfffff',
  '88283472adfffff',
  '88283472a3fffff',
  '88283472a5fffff',
  '88283472a7fffff',
  '88283472a9fffff',
  '88283472a1fffff',
  '8828347283fffff',
  '8828347285fffff',
  '8828347287fffff',
  '8828347289fffff',
  '8828347281fffff',
  '882834728bfffff',
] as const

const PLACE_TYPES = ['shelter', 'hospital', 'school', 'place'] as const

function placeLabel(id: number, type: string): Vocabulary['places'][0]['labels'] {
  const en =
    type === 'shelter'
      ? `Emergency shelter ${id}`
      : type === 'hospital'
        ? `Community hospital ${id}`
        : type === 'school'
          ? `School pickup zone ${id}`
          : `Evacuation hub ${id}`
  return {
    en,
    es: en,
    fr: en,
    ar: en,
    he: en,
    hi: en,
    it: en,
    nl: en,
    pt: en,
    ta: en,
    'zh-Hans': en,
    'zh-Hant': en,
  }
}

/**
 * Vocab sized like a locker mesh slice: many place IDs so geo pre-filter matters for tokens.
 */
export function resilienceEvalVocabulary(): Vocabulary {
  const places = H3_NEAR.map((h3, i) => {
    const type = PLACE_TYPES[i % PLACE_TYPES.length]!
    return {
      id: `P_DIS_${String(i + 1).padStart(2, '0')}`,
      code: 100 + i,
      type,
      h3,
      labels: placeLabel(i + 1, type),
    }
  })

  return {
    vocab_version: 'eval-resilience-0.1',
    languages: [...SUPPORTED_LANGUAGES],
    events: [
      {
        id: 'E_FLOOD',
        code: 1,
        labels: { en: 'Flood warning', es: 'Aviso de inundación', fr: 'Alerte inondation' },
      },
      {
        id: 'E_WILDFIRE',
        code: 2,
        labels: { en: 'Wildfire smoke', es: 'Humo de incendio', fr: 'Fumée d’incendie' },
      },
      {
        id: 'E_QUAKE',
        code: 3,
        labels: { en: 'Earthquake', es: 'Terremoto', fr: 'Séisme' },
      },
    ],
    actions: [
      {
        id: 'A_EVAC',
        code: 10,
        events: ['E_FLOOD', 'E_WILDFIRE'],
        labels: { en: 'Evacuate now', es: 'Evacuar ya', fr: 'Évacuer' },
      },
      {
        id: 'A_SHELTER',
        code: 11,
        events: ['E_FLOOD', 'E_WILDFIRE', 'E_QUAKE'],
        labels: { en: 'Go to shelter', es: 'Ir al refugio', fr: 'Aller au refuge' },
      },
      {
        id: 'A_STAY',
        code: 12,
        events: ['E_QUAKE'],
        labels: { en: 'Shelter in place', es: 'Quedarse', fr: 'Restez' },
      },
      {
        id: 'A_HIGHER',
        code: 13,
        events: ['E_FLOOD'],
        labels: { en: 'Move to higher ground', es: 'Subir terreno', fr: 'Terrains élevés' },
      },
    ],
    places,
    resources: [
      {
        id: 'R_KIT',
        code: 200,
        place_id: 'P_DIS_01',
        labels: { en: 'Go-bag pickup', es: 'Kit de emergencia', fr: 'Sac d’urgence' },
      },
    ],
    actors: [
      { id: 'PR_RESIDENT', code: 300, labels: { en: 'Resident', es: 'Residente', fr: 'Résident' } },
    ],
    defaults: {
      E_FLOOD: { '3': ['A_HIGHER', 'A_EVAC'], '4': ['A_EVAC', 'A_SHELTER'] },
      E_WILDFIRE: { '3': ['A_EVAC'], '4': ['A_EVAC', 'A_SHELTER'] },
      E_QUAKE: { '2': ['A_STAY'], '3': ['A_SHELTER'] },
    },
  }
}

export function allResiliencePlaceIds(vocab: Vocabulary): string[] {
  return vocab.places.map((p) => p.id)
}