import { expandH3CellId, h3Neighbors, normalizeH3CellToResolution } from '@local-hosting/geokit/h3'
import type { Vocabulary, VocabPlace } from '@local-hosting/local-ai'
import { readSpatialAiEnv } from '../runtime/read-env.js'
import { readSessionH3ResolutionCap } from './session-h3-policy.js'

const DEFAULT_RING_K = 1
const MAX_RING_K = 3

export function readPlacesRingK(env: NodeJS.ProcessEnv = process.env): number {
  const raw = readSpatialAiEnv('PLACES_RING_K', env)
  if (!raw) return DEFAULT_RING_K
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_RING_K
  return Math.min(n, MAX_RING_K)
}

export function vocabH3SliceEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = readSpatialAiEnv('VOCAB_H3_SLICE', env)?.toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'off') return false
  return true
}

function anchorDiskCells(
  anchorH3: string,
  ringK: number,
  resolution: number,
): Set<string> {
  const expanded = expandH3CellId(anchorH3)
  const center = normalizeH3CellToResolution(expanded, resolution)
  const cells = h3Neighbors(center, ringK)
  return new Set(
    cells.map((cell) => normalizeH3CellToResolution(cell, resolution)),
  )
}

export function filterPlacesInH3Disk(
  places: VocabPlace[],
  anchorH3: string,
  ringK: number,
  resolution: number,
): VocabPlace[] {
  const disk = anchorDiskCells(anchorH3, ringK, resolution)
  return places.filter((place) => {
    const cell = normalizeH3CellToResolution(
      expandH3CellId(place.h3),
      resolution,
    )
    return disk.has(cell)
  })
}

export function sliceVocabForAnchor(
  vocab: Vocabulary,
  anchorH3: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): Vocabulary {
  if (!anchorH3?.trim() || !vocabH3SliceEnabled(env)) {
    return vocab
  }
  const resolution = readSessionH3ResolutionCap(env)
  const ringK = readPlacesRingK(env)
  const sliced = filterPlacesInH3Disk(
    vocab.places,
    anchorH3,
    ringK,
    resolution,
  )
  if (sliced.length === 0) {
    return vocab
  }
  return { ...vocab, places: sliced }
}