import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type EvalModelSpec = { name: string; gguf: string; alias: string }

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localAiRoot = path.resolve(repoRoot, '../local-ai')

export const EVAL_COMPOSE_MODELS: EvalModelSpec[] = [
  {
    name: 'gemma-4-e2b',
    gguf: path.join(localAiRoot, 'models/gemma-4-e2b-q4_k_m.gguf'),
    alias: 'gemma-4-e2b',
  },
  {
    name: 'qwen3-1.7b-instruct',
    gguf: path.join(localAiRoot, 'models/qwen3-1.7b-instruct-q4_k_m.gguf'),
    alias: 'qwen3-1.7b',
  },
]

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