import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { loadUiMapConfig } from '../src/api/ui-map-config.js'
import { loadSpatialDotEnv } from '../src/runtime/load-dotenv.js'

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)

describe('loadSpatialDotEnv', () => {
  const env = { ...process.env }

  afterEach(() => {
    process.env = { ...env }
  })

  it('loads MAPTILER_KEY from sibling geokit/.env when present', () => {
    const geokitEnv = path.join(PACKAGE_ROOT, '..', 'geokit', '.env')
    if (!existsSync(geokitEnv)) {
      return
    }
    const isolated: NodeJS.ProcessEnv = { NODE_ENV: 'test' }
    loadSpatialDotEnv(isolated)
    const configured = loadUiMapConfig(isolated)
    if (isolated.MAPTILER_KEY?.trim()) {
      expect(configured.maptilerKey).toBe(isolated.MAPTILER_KEY.trim())
    }
  })
})