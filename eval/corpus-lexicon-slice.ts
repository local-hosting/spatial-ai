import {
  composeWords,
  vocabularyToLabelPack,
  vocabularyToSymbolTable,
} from '@local-hosting/compose'
import { readMessageCorpus, type MessageCorpusId } from '@local-hosting/compose/messages'
import { mapQuestionLexicon } from '@local-hosting/local-ai'
import { pct } from './compose-scoring.js'
import { resilienceEvalVocabulary } from './resilience-eval-vocab.js'

export type CorpusLexiconSlice = {
  corpus: MessageCorpusId
  rows: number
  questions: number
  reports: number
  compose_words_ok_pct: number | null
  map_not_other_pct: number | null
}

/** Model-independent lexicon generalization (composeWords + mapQuestionLexicon). */
export function scoreCorpusLexicon(corpusId: MessageCorpusId, max: number): CorpusLexiconSlice {
  const doc = readMessageCorpus(corpusId)
  const messages = doc.messages.slice(0, max)
  const vocab = resilienceEvalVocabulary()
  const fieldTable = vocabularyToSymbolTable(vocab)
  const fieldLabels = vocabularyToLabelPack(vocab)

  let composeOk = 0
  let mapNotOther = 0
  let questions = 0
  let reports = 0

  for (const row of messages) {
    if (row.kind === 'question') questions += 1
    else reports += 1
    const cw = composeWords(row.text, fieldTable, fieldLabels, row.lang)
    if (cw.ok) composeOk += 1
    const mapped = mapQuestionLexicon(row.text, row.lang)
    if (mapped.label !== 'other') mapNotOther += 1
  }

  const n = messages.length
  return {
    corpus: corpusId,
    rows: n,
    questions,
    reports,
    compose_words_ok_pct: pct(composeOk, n),
    map_not_other_pct: pct(mapNotOther, n),
  }
}