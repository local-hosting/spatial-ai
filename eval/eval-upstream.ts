import { loadUpstreamAiConfig } from '@local-hosting/local-ai'

export type EvalUpstreamSnapshot = {
  llamaBaseUrl: string
  glinerBaseUrl: string
  composeTimeoutMs: number
  mapTimeoutMs: number
  gliner_reachable: boolean
  gliner_probe_error?: string
}

export function loadEvalUpstreamConfig(): Omit<
  EvalUpstreamSnapshot,
  'gliner_reachable' | 'gliner_probe_error'
> {
  return loadUpstreamAiConfig()
}

/** Production defaults (8091); failures fall back to lexicon inside `mapQuestion`. */
export async function probeGlinerHealth(baseUrl: string): Promise<{
  reachable: boolean
  error?: string
}> {
  try {
    const root = baseUrl.replace(/\/$/, '')
    const res = await fetch(`${root}/health`, { signal: AbortSignal.timeout(1500) })
    if (!res.ok) return { reachable: false, error: `HTTP ${res.status}` }
    return { reachable: true }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { reachable: false, error: message }
  }
}

export async function snapshotEvalUpstream(): Promise<EvalUpstreamSnapshot> {
  const upstream = loadEvalUpstreamConfig()
  const probe = await probeGlinerHealth(upstream.glinerBaseUrl)
  return {
    ...upstream,
    gliner_reachable: probe.reachable,
    gliner_probe_error: probe.error,
  }
}