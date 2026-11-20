import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { coordinatesToH3, normalizeH3CellToResolution } from '@local-hosting/geokit/h3'
import {
  createSessionAnchorStore,
  createSpatialServer,
} from '../src/api/server.js'
import { loadSpatialConfig } from '../src/api/config.js'

function postJson(
  port: number,
  path: string,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        method: 'POST',
        path,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve({
            status: res.statusCode ?? 0,
            body: JSON.parse(text) as Record<string, unknown>,
          })
        })
      },
    )
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

describe('POST /chat session H3 anchor', () => {
  const boot = normalizeH3CellToResolution(
    coordinatesToH3(7)([40.7128, -74.006]),
    7,
  )
  const store = createSessionAnchorStore({
    ...process.env,
    SPATIAL_AI_DEFAULT_H3_CELL: boot,
  })
  const config = { ...loadSpatialConfig(), port: 0 }
  const server = createSpatialServer(config, { sessionAnchor: store })
  let port = 0

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address()
          if (addr && typeof addr === 'object') port = addr.port
          resolve()
        })
      }),
  )

  afterAll(
    () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
      }),
  )

  it('returns boot anchor on first message without geo', async () => {
    const res = await postJson(port, '/chat', {
      text: 'where is shelter',
      lang: 'en',
      pack_mode: 'daily',
      compose: { rules_only: true },
    })
    expect(res.status).toBe(200)
    const session = res.body.session as Record<string, unknown>
    expect(session.anchor_h3).toBe(boot)
    expect(session.session_id).toBeTruthy()
  })
})