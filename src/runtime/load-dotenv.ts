import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)

function applyEnvLine(line: string, target: NodeJS.ProcessEnv): void {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const eq = trimmed.indexOf('=')
  if (eq <= 0) return
  const key = trimmed.slice(0, eq).trim()
  let value = trimmed.slice(eq + 1).trim()
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1)
  }
  if (target[key] === undefined || target[key] === '') {
    target[key] = value
  }
}

const DEFAULT_DOTENV_FILES = [
  '.env',
  '.env.local',
  path.join('..', 'geokit', '.env'),
]

/** Best-effort `.env` for local `start` (does not override existing process env). */
export function loadSpatialDotEnv(
  env: NodeJS.ProcessEnv = process.env,
  files: string[] = DEFAULT_DOTENV_FILES,
): void {
  for (const file of files) {
    const full = path.isAbsolute(file) ? file : path.join(PACKAGE_ROOT, file)
    if (!existsSync(full)) continue
    const text = readFileSync(full, 'utf8')
    for (const line of text.split('\n')) {
      applyEnvLine(line, env)
    }
  }
}