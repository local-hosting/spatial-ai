import http from 'node:http'
import {
  assertAllowedBindHost,
  buildHealthReport,
  createLocalAiRouteContext,
  handleLocalAiRoutes,
  isAuthorized,
  manifestVerificationErrors,
  readJsonBody,
  writeJson,
} from '@local-hosting/local-ai'
import type { SpatialServiceConfig } from './config.js'
import { runSpatialChat } from '../spatial/spatial-chat.js'
import { spatialChatRequestSchema } from '../spatial/schemas.js'
import { spatialServiceInfoBody } from './spatial-service-info.js'
import {
  loadChatUiHtml,
  requestPrefersHtml,
  resolveUiStaticGet,
  writeHtml,
  writeUiFile,
} from './static-ui.js'
import { loadUiMapConfig, uiMapConfigPublicBody } from './ui-map-config.js'

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
  const startupErrors = manifestVerificationErrors()
  const ctx = createLocalAiRouteContext(startupErrors)

  return http.createServer(async (req, res) => {
    if (!req.url || !req.method) {
      writeJson(res, 400, { error: 'bad request' })
      return
    }

    const url = new URL(req.url, `http://${config.bindHost}:${config.port}`)

    if (req.method === 'GET') {
      if (url.pathname === '/ui/map-config.json') {
        writeJson(res, 200, uiMapConfigPublicBody(loadUiMapConfig()))
        return
      }
      const uiStatic = resolveUiStaticGet(url.pathname)
      if (uiStatic) {
        writeUiFile(res, 200, uiStatic)
        return
      }
      if (url.pathname === '/' && requestPrefersHtml(req)) {
        try {
          writeHtml(res, 200, loadChatUiHtml())
        } catch (e) {
          writeJson(res, 503, {
            error: e instanceof Error ? e.message : 'chat UI unavailable',
          })
        }
        return
      }
    }

    if (!isAuthorized(req, config.apiKey)) {
      writeJson(res, 401, { error: 'unauthorized' })
      return
    }

    if (req.method === 'GET' && url.pathname === '/') {
      writeJson(res, 200, spatialServiceInfoBody(config))
      return
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      const report = await buildHealthReport({
        llamaBaseUrl: config.llamaBaseUrl,
        glinerBaseUrl: config.glinerBaseUrl,
        loadedVocabVersion: ctx.loadedVocabVersion,
      })
      const status = report.llama_reachable ? 200 : 503
      writeJson(res, status, {
        ok: report.llama_reachable,
        service: config.serviceId,
        version: config.serviceVersion,
        layer: '@local-hosting/spatial-ai',
        superset: true,
        ...report,
        manifest_verification_errors: startupErrors,
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

    const handled = await handleLocalAiRoutes(req, res, url, config, ctx, {
      includeRoot: false,
      includeHealth: false,
    })
    if (handled) {
      return
    }

    writeJson(res, 404, { error: 'not found' })
  })
}

export function startSpatialServer(config: SpatialServiceConfig): http.Server {
  assertAllowedBindHost(config.bindHost)
  if (process.env.SPATIAL_AI_ENFORCE_MANIFEST === '1') {
    const errors = manifestVerificationErrors()
    if (errors.length > 0) {
      throw new Error(`manifest verification failed: ${errors.join('; ')}`)
    }
  }
  const server = createSpatialServer(config)
  server.listen(config.port, config.bindHost, () => {
    console.log(
      `spatial-ai (local-ai superset) on http://${config.bindHost}:${config.port}`,
    )
  })
  return server
}