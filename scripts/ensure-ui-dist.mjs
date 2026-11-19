#!/usr/bin/env node
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const indexHtml = path.join(pkgRoot, 'ui', 'dist', 'index.html')

if (existsSync(indexHtml)) {
  process.exit(0)
}

const result = spawnSync(
  'yarn',
  ['vite', 'build', '--config', 'ui/vite.config.ts'],
  { cwd: pkgRoot, stdio: 'inherit', env: process.env },
)

process.exit(result.status ?? 1)