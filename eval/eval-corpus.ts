import type { MessageCorpusId } from '@local-hosting/compose/messages'

const BENCH_CORPORA: MessageCorpusId[] = [
  'resilience-synthetic',
  'resilience-crisislex',
  'everyday-spatial',
]

export function evalBenchCorpusId(): MessageCorpusId {
  const raw = process.env.LOCAL_AI_EVAL_CORPUS?.trim() as MessageCorpusId | undefined
  if (raw && BENCH_CORPORA.includes(raw)) return raw
  return 'resilience-synthetic'
}