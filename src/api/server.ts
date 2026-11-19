import http from 'node:http'
import type { SpatialServiceConfig } from './config.js'
import { runSpatialChat } from '../spatial/spatial-chat.js'
import { spatialChatRequestSchema } from '../spatial/schemas.js'

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) return {}
  return JSON.parse(raw) as unknown
}

async function handleSpatial(
  body: unknown,
  config: SpatialServiceConfig,
): Promise<{ status: number; payload: unknown }> {
  const parsed = spatialChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return { status: 400, payload: { error: 'invalid body', details: parsed.error.flatten() } }
  }
  const result = await runSpatialChat(parsed.data, {
    llamaBaseUrl: config.llamaBaseUrl,
    glinerBaseUrl: config.glinerBaseUrl,
    composeTimeoutMs: config.composeTimeoutMs,
    mapTimeoutMs: config.mapTimeoutMs,
  })
  return { status: 200, payload: result }
}

export function createSpatialServer(config: SpatialServiceConfig): http.Server {
  return http.createServer(async (req, res) => {
    if (!req.url || !req.method) {
      json(res, 400, { error: 'bad request' })
      return
    }

    const url = new URL(req.url, `http://${config.host}:${config.port}`)

    if (req.method === 'GET' && url.pathname === '/health') {
      json(res, 200, {
        ok: true,
        service: 'spatial-ai',
        layer: '@local-hosting/spatial-ai',
        basic_ai: 'http://127.0.0.1:8090',
      })
      return
    }

    if (
      req.method === 'POST' &&
      (url.pathname === '/spatial' || url.pathname === '/chat')
    ) {
      try {
        const body = await readJsonBody(req)
        const { status, payload } = await handleSpatial(body, config)
        json(res, status, payload)
      } catch (e) {
        json(res, 500, {
          error: e instanceof Error ? e.message : 'spatial chat failed',
        })
      }
      return
    }

    json(res, 404, { error: 'not found' })
  })
}

export function startSpatialServer(config: SpatialServiceConfig): http.Server {
  if (config.host !== '127.0.0.1') {
    throw new Error('must bind 127.0.0.1 only')
  }
  const server = createSpatialServer(config)
  server.listen(config.port, config.host, () => {
    console.log(`spatial-ai listening on http://${config.host}:${config.port}`)
  })
  return server
}