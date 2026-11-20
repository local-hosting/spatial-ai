/**
 * CrisisLex generalization: lexicon slice (all rows) + live compose on questions.
 *
 *   yarn workspace @local-hosting/spatial-ai eval:crisislex-live
 *   LOCAL_AI_EVAL_COUNTERFACTUAL=1 LOCAL_AI_EVAL_MAX_ROWS=15 …
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { scoreCorpusLexicon } from './corpus-lexicon-slice.js'
import { evalComposeModels, evalCounterfactualEnabled } from './eval-models.js'
import { runLiveComposeModel, type LiveComposeRowEval } from './live-compose-model.js'
import { pairedCompareRows, type PairedRowSlice } from './paired-compare.js'
import {
  buildQuestionContexts,
  corpusBaseline,
  loadBenchQuestions,
} from './resilience-question-bench.js'
import { buildScorecard, type ModelEvalHeadline } from './scorecard.js'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function toPairedSlice(rows: LiveComposeRowEval[]): PairedRowSlice[] {
  return rows.map((r) => ({
    id: r.id,
    source: r.source,
    action_ids: r.action_ids,
    place_ids: r.place_ids,
    model_picked_expected_place: r.picks_geo_rank1,
    action_acceptable: r.action_acceptable,
    required_actions_met: r.required_actions_met,
    places_subset_of_geo: null,
  }))
}

async function main(): Promise<void> {
  const lexiconMax = Number(process.env.LOCAL_AI_EVAL_CRISISLEX_LEX_ROWS ?? 200)
  const questionMax = Number(process.env.LOCAL_AI_EVAL_MAX_ROWS ?? 15)
  const port = Number(process.env.LOCAL_AI_LLAMA_PORT ?? 8080)
  const timeoutMs = Number(process.env.LOCAL_AI_EVAL_TIMEOUT_MS ?? 60_000)
  const counterfactual = evalCounterfactualEnabled()

  const lexicon = scoreCorpusLexicon('resilience-crisislex', lexiconMax)
  const rows = loadBenchQuestions(questionMax, 'resilience-crisislex')
  const contexts = buildQuestionContexts(rows)

  const results: Record<string, unknown>[] = []
  for (const model of evalComposeModels()) {
    console.error(`\n=== crisislex live compose: ${model.name} (${rows.length} questions) ===`)
    const summary = await runLiveComposeModel(
      model,
      contexts,
      port,
      timeoutMs,
      counterfactual,
    )
    results.push(summary)
    const { row_evals, ...headline } = summary
    console.error(JSON.stringify(headline, null, 2))
    void row_evals
  }

  let paired_compare = null
  if (
    results.length === 2 &&
    results.every((r) => Array.isArray(r.row_evals) && !r.skipped)
  ) {
    paired_compare = pairedCompareRows(
      String(results[0]!.model),
      String(results[1]!.model),
      toPairedSlice(results[0]!.row_evals as LiveComposeRowEval[]),
      toPairedSlice(results[1]!.row_evals as LiveComposeRowEval[]),
    )
  }

  const headlines: ModelEvalHeadline[] = results.map((r) => {
    const { row_evals: _rows, ...h } = r
    void _rows
    return h as ModelEvalHeadline
  })

  const payload = {
    profile: 'crisislex-live',
    corpus: 'resilience-crisislex',
    path: 'lexicon-slice + compose+resident_text+place_ranking',
    ran_at: new Date().toISOString(),
    question_count: rows.length,
    lexicon_max_rows: lexiconMax,
    lexicon,
    corpus_baseline: corpusBaseline(contexts),
    paired_compare,
    scorecard: buildScorecard(headlines, paired_compare),
    results: results.map(({ row_evals, ...headline }) => headline),
    detail: results.map((r) => ({ model: r.model, row_evals: r.row_evals })),
  }

  const outPath = path.join(repoRoot, 'eval', 'crisislex-live.json')
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`)
  console.log(JSON.stringify(payload, null, 2))
  console.error(`Wrote ${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})