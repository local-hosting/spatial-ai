import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type http from 'node:http'

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
)

export const UI_DIST_DIR = path.join(PACKAGE_ROOT, 'ui', 'dist')

const MIME_BY_EXT: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

let cachedChatUiHtml: string | null = null

export function chatUiBuildHint(): string {
  return 'Run `yarn workspace @local-hosting/spatial-ai build:ui` (or `yarn start`, which builds UI first).'
}

export function loadChatUiHtml(): string {
  if (cachedChatUiHtml) {
    return cachedChatUiHtml
  }
  const built = path.join(UI_DIST_DIR, 'index.html')
  if (!existsSync(built)) {
    throw new Error(`spatial-ai chat UI is not built. ${chatUiBuildHint()}`)
  }
  cachedChatUiHtml = readFileSync(built, 'utf8')
  return cachedChatUiHtml
}

export function isPublicUiGet(pathname: string): boolean {
  return (
    pathname === '/ui' ||
    pathname === '/ui/' ||
    pathname === '/ui/map-config.json' ||
    pathname.startsWith('/ui/assets/')
  )
}

export type UiStaticFile = {
  filePath: string
  contentType: string
  cacheControl: string
}

export function resolveUiStaticGet(pathname: string): UiStaticFile | null {
  if (pathname === '/ui' || pathname === '/ui/') {
    const index = path.join(UI_DIST_DIR, 'index.html')
    if (!existsSync(index)) return null
    return {
      filePath: index,
      contentType: 'text/html; charset=utf-8',
      cacheControl: 'no-store',
    }
  }
  if (!pathname.startsWith('/ui/assets/')) {
    return null
  }
  const rel = pathname.slice('/ui/'.length)
  const filePath = path.normalize(path.join(UI_DIST_DIR, rel))
  const distWithSep = UI_DIST_DIR.endsWith(path.sep)
    ? UI_DIST_DIR
    : `${UI_DIST_DIR}${path.sep}`
  if (!filePath.startsWith(distWithSep) || !existsSync(filePath)) {
    return null
  }
  const ext = path.extname(filePath)
  return {
    filePath,
    contentType: MIME_BY_EXT[ext] ?? 'application/octet-stream',
    cacheControl: 'public, max-age=31536000, immutable',
  }
}

export function requestPrefersHtml(req: http.IncomingMessage): boolean {
  const accept = (req.headers.accept ?? '').toLowerCase()
  if (!accept) {
    return false
  }
  if (accept.includes('text/html')) {
    return true
  }
  const parts = accept.split(',').map((p) => p.trim().split(';')[0])
  return parts[0] === '*/*'
}

export function writeHtml(res: http.ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

export function writeUiFile(res: http.ServerResponse, status: number, file: UiStaticFile): void {
  const body = readFileSync(file.filePath)
  res.writeHead(status, {
    'Content-Type': file.contentType,
    'Cache-Control': file.cacheControl,
  })
  res.end(body)
}