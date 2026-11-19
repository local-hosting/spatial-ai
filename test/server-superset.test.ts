import http from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSpatialServer } from '../src/api/server.js'
import { loadSpatialConfig } from '../src/api/config.js'
import { LOCAL_AI_HTTP_ROUTES, SPATIAL_HTTP_ROUTES } from '../src/api/spatial-service-info.js'

function request(
  port: number,
  method: string,
  path: string,
  headers?: http.OutgoingHttpHeaders,
): Promise<{ status: number; body: unknown; raw?: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, method, path, headers },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let body: unknown = text
          try {
            body = JSON.parse(text) as unknown
          } catch {
            // plain text
          }
          resolve({ status: res.statusCode ?? 0, body, raw: text })
        })
      },
    )
    req.on('error', reject)
    req.end()
  })
}

describe('spatial server local-ai superset', () => {
  const config = { ...loadSpatialConfig(), port: 0 }
  const server = createSpatialServer(config)
  let port = 0

  beforeAll(
    () =>
      new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address()
          if (addr && typeof addr === 'object') {
            port = addr.port
          }
          resolve()
        })
      }),
  )

  afterAll(() => {
    server.close()
  })

  it('GET / advertises superset routes', async () => {
    const { status, body } = await request(port, 'GET', '/')
    expect(status).toBe(200)
    expect(body).toMatchObject({
      ok: true,
      service: 'spatial-ai',
      superset: true,
      routes: {
        spatial: [...SPATIAL_HTTP_ROUTES],
        local_ai: [...LOCAL_AI_HTTP_ROUTES],
      },
    })
  })

  it('POST /generate returns 400 without body fields', async () => {
    const { status, body } = await request(port, 'POST', '/generate')
    expect(status).toBe(400)
    expect(body).toMatchObject({ error: 'invalid body' })
  })

  it('unknown route is 404', async () => {
    const { status } = await request(port, 'GET', '/nope')
    expect(status).toBe(404)
  })

  it('GET / returns HTML chat UI when Accept is text/html', async () => {
    const { status, raw } = await request(port, 'GET', '/', {
      Accept: 'text/html',
    })
    expect(status).toBe(200)
    expect(raw).toContain('Spatial AI')
    expect(raw).toContain('/ui/assets/')
    expect(raw).toContain('stylesheet')
  })

  it('GET /ui always returns HTML', async () => {
    const { status, raw } = await request(port, 'GET', '/ui')
    expect(status).toBe(200)
    expect(raw).toContain('<!doctype html>')
  })
})