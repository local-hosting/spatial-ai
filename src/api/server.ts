import http from 'node:http'
import {
  assertLoopbackHost,
  readJsonBody,
  writeJson,
} from '@local-hosting/local-ai'
import type { SpatialServiceConfig } from './config.js'
import { runSpatialChat } from '../spatial/spatial-chat.js'
import { spatialChatRequestSchema } from '../spatial/schemas.js'

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
      writeJson(res, 400, { error: 'bad request' })
      return
    }

    const url = new URL(req.url, `http://${config.host}:${config.port}`)

    if (req.method === 'GET' && url.pathname === '/health') {
      writeJson(res, 200, {
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
        writeJson(res, status, payload)
      } catch (e) {
        writeJson(res, 500, {
          error: e instanceof Error ? e.message : 'spatial chat failed',
        })
      }
      return
    }

    writeJson(res, 404, { error: 'not found' })
  })
}

export function startSpatialServer(config: SpatialServiceConfig): http.Server {
  assertLoopbackHost(config.host)
  const server = createSpatialServer(config)
  server.listen(config.port, config.host, () => {
    console.log(`spatial-ai listening on http://${config.host}:${config.port}`)
  })
  return server
}
