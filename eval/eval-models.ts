import {
  composerGgufPath,
  composerLlamaAlias,
  listComposerModels,
  readManifest,
} from '@local-hosting/local-ai'

export type EvalModelSpec = { name: string; gguf: string; alias: string }

/** Compose-only GGUFs derived from `local-ai/models/MANIFEST.json` (single source of truth). */
export function loadEvalComposeModels(): EvalModelSpec[] {
  return listComposerModels(readManifest()).map((entry) => ({
    name: entry.name,
    gguf: composerGgufPath(entry),
    alias: composerLlamaAlias(entry),
  }))
}

/** Snapshot at import — prefer `evalComposeModels()` so env filters apply. */
export const EVAL_COMPOSE_MODELS: EvalModelSpec[] = loadEvalComposeModels()

/** Optional subset: `LOCAL_AI_EVAL_COMPOSE_MODELS=qwen3-0.6b-instruct,qwen3-1.7b-instruct` */
export function evalComposeModels(): EvalModelSpec[] {
  const all = loadEvalComposeModels()
  const raw = process.env.LOCAL_AI_EVAL_COMPOSE_MODELS?.trim()
  if (!raw) return all
  const want = new Set(
    raw
      .split(/,\s*/)
      .map((s) => s.trim())
      .filter(Boolean),
  )
  const picked = all.filter((m) => want.has(m.name))
  return picked.length > 0 ? picked : all
}

export function evalCounterfactualEnabled(): boolean {
  return process.env.LOCAL_AI_EVAL_COUNTERFACTUAL === '1'
}

export function evalDeviceTarget(): 'pi' | 'phone' | 'desktop' {
  const raw = process.env.LOCAL_AI_EVAL_DEVICE_TARGET?.trim().toLowerCase()
  if (raw === 'pi' || raw === 'phone' || raw === 'desktop') return raw
  return 'pi'
}

export function evalP95BudgetMs(device: 'pi' | 'phone' | 'desktop'): number {
  const fromEnv = Number(process.env.LOCAL_AI_EVAL_P95_BUDGET_MS)
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv
  switch (device) {
    case 'desktop':
      return 8000
    case 'phone':
      return 4500
    default:
      return 3500
  }
}
