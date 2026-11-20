import { describe, expect, it } from 'vitest'
import { evalComposeModels, loadEvalComposeModels } from '../eval/eval-models.js'

describe('evalComposeModels', () => {
  it('loads composers from local-ai MANIFEST', () => {
    delete process.env.LOCAL_AI_EVAL_COMPOSE_MODELS
    const models = loadEvalComposeModels()
    expect(models.map((m) => m.name)).toContain('qwen3-0.6b-instruct')
    expect(models[0]?.gguf.endsWith('.gguf')).toBe(true)
    expect(models.find((m) => m.name === 'qwen3-0.6b-instruct')?.alias).toBe(
      'qwen3-0.6b',
    )
  })

  it('returns full list when env unset', () => {
    delete process.env.LOCAL_AI_EVAL_COMPOSE_MODELS
    expect(evalComposeModels()).toEqual(loadEvalComposeModels())
  })

  it('filters by LOCAL_AI_EVAL_COMPOSE_MODELS', () => {
    process.env.LOCAL_AI_EVAL_COMPOSE_MODELS = 'qwen3-0.6b-instruct, gemma-4-e2b'
    const models = evalComposeModels()
    expect(models.map((m) => m.name)).toEqual(['qwen3-0.6b-instruct', 'gemma-4-e2b'])
    delete process.env.LOCAL_AI_EVAL_COMPOSE_MODELS
  })

  it('falls back to full list when filter matches nothing', () => {
    process.env.LOCAL_AI_EVAL_COMPOSE_MODELS = 'nope'
    expect(evalComposeModels()).toEqual(loadEvalComposeModels())
    delete process.env.LOCAL_AI_EVAL_COMPOSE_MODELS
  })
})