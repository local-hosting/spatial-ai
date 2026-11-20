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
import { uiSessionAnchorPublicBody } from './ui-session-anchor.js'
import { uiSpatialConfigPublicBody } from './ui-spatial-config.js'
import { applyRequestSessionAnchor } from '../spatial/apply-request-session-anchor.js'
import {
  readSessionObservationsMax,
  SessionAnchorStore,
} from '../spatial/session-anchor-store.js'
import { readBootH3Cell } from '../spatial/read-boot-h3.js'
import { readRegionH3Cell } from '../spatial/read-region-h3.js'
import { cachedSpatialHealthReport } from './spatial-health-cache.js'

export type SpatialServerDeps = {
  sessionAnchor: SessionAnchorStore
}

export function createSessionAnchorStore(
  env: NodeJS.ProcessEnv = process.env,
): SessionAnchorStore {
  return new SessionAnchorStore(
    readBootH3Cell(env),
    readRegionH3Cell(env),
    readSessionObservationsMax(env),
  )
}

async function handleSpatial(
  body: unknown,
  config: SpatialServiceConfig,
  deps: SpatialServerDeps,
  loadedVocabVersion: string | null,
): Promise<{ status: number; payload: unknown }> {
  const parsed = spatialChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return { status: 400, payload: { error: 'invalid body', details: parsed.error.flatten() } }
  }
  const { request, meta } = applyRequestSessionAnchor(
    parsed.data,
    deps.sessionAnchor,
  )
  const health = await cachedSpatialHealthReport(config, loadedVocabVersion)
  const result = await runSpatialChat(request, {
    llamaBaseUrl: config.llamaBaseUrl,
    glinerBaseUrl: config.glinerBaseUrl,
    composeTimeoutMs: config.composeTimeoutMs,
    mapTimeoutMs: config.mapTimeoutMs,
    llamaReachable: health.llama_reachable,
    glinerReachable: health.gliner_reachable,
  })
  return {
    status: 200,
    payload: { ...result, session: meta },
  }
}

export function createSpatialServer(
  config: SpatialServiceConfig,
  deps: SpatialServerDeps = {
    sessionAnchor: createSessionAnchorStore(),
  },
): http.Server {
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
      if (url.pathname === '/ui/session-anchor.json') {
        writeJson(res, 200, uiSessionAnchorPublicBody())
        return
      }
      if (url.pathname === '/ui/spatial-config.json') {
        writeJson(res, 200, uiSpatialConfigPublicBody())
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
        const { status, payload } = await handleSpatial(
          body,
          config,
          deps,
          ctx.loadedVocabVersion,
        )
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