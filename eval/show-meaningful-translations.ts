/**
 * Print text → structured outputs (composeWords, map lexicon, optional live compose).
 *
 *   yarn workspace @local-hosting/spatial-ai eval:show-translations
 *   SHOW_LIVE_COMPOSE=1 …  # needs llama on :8080
 */
import {
  composeWords,
  englishLabel,
  vocabularyToLabelPack,
  vocabularyToSymbolTable,
} from '@local-hosting/compose'
import { readMessageCorpus } from '@local-hosting/compose/messages'
import { compose, mapQuestionLexicon } from '@local-hosting/local-ai'
import { resilienceEvalVocabulary } from './resilience-eval-vocab.js'
import { labels, table } from '../../compose/test/fixtures.js'
import { placesNear } from '../src/spatial/places-near.js'
import { resolveSpatialSession } from '../src/spatial/session-resolve.js'
import type { EventSummary } from '@local-hosting/local-ai'

const SYMBOL_NAME: Record<number, string> = {
  1: 'intent',
  2: 'reading',
  4: 'query',
  8: 'ack',
  16: 'report',
  32: 'verify',
}

function printSection(title: string): void {
  console.log('\n' + '='.repeat(72))
  console.log(title)
  console.log('='.repeat(72))
}

function frameSummary(
  result: ReturnType<typeof composeWords>,
): Record<string, unknown> | { error: string } {
  if (!result.ok) return { error: result.reason, unmatched: result.unmatched }
  const f = result.frame
  return {
    symbol: SYMBOL_NAME[f.symbol] ?? f.symbol,
    band: f.fields?.band,
    report_polarity:
      f.fields?.offer === 1 ? 'demand' : f.fields?.offer === 2 ? 'offer' : undefined,
    codes: f.codes,
    matched_vocab: result.matched.map((m) => ({
      id: m.id,
      kind: m.kind,
      label: m.label,
    })),
  }
}

function mapRow(text: string, lang: string): Record<string, unknown> {
  const m = mapQuestionLexicon(text, lang as 'en')
  return { label: m.label, confidence: m.confidence, source: 'lexicon' }
}

async function liveCompose(event: EventSummary): Promise<Record<string, unknown>> {
  const vocab = resilienceEvalVocabulary()
  const base = process.env.LOCAL_AI_LLAMA_BASE_URL ?? 'http://127.0.0.1:8080'
  try {
    const intent = await compose(
      { vocab, event },
      {
        llamaBaseUrl: base,
        timeoutMs: Number(process.env.LOCAL_AI_EVAL_TIMEOUT_MS ?? 45_000),
        rulesOnlyForce: false,
      },
    )
    return {
      source: intent.source,
      latency_ms: intent.latency_ms,
      per_actor: intent.per_actor.map((row) => ({
        actor_id: row.actor_id,
        severity: row.severity,
        actions: row.action_ids.map(
          (id) => `${id}: ${englishLabel(vocab, id) ?? id}`,
        ),
        places: (row.place_ids ?? []).map(
          (id) => `${id}: ${englishLabel(vocab, id) ?? id}`,
        ),
      })),
    }
  } catch (e) {
    return { error: String(e) }
  }
}

async function main(): Promise<void> {
  const fieldVocab = resilienceEvalVocabulary()
  const fieldTable = vocabularyToSymbolTable(fieldVocab)
  const fieldLabels = vocabularyToLabelPack(fieldVocab)

  printSection('Everyday → composeWords (family fixture lexicon)')
  for (const row of readMessageCorpus('everyday').messages.slice(0, 3)) {
    console.log(
      JSON.stringify(
        { id: row.id, text: row.text, structured: frameSummary(composeWords(row.text, table, labels, row.lang)) },
        null,
        2,
      ),
    )
  }

  printSection('Resilience (short corpus) → composeWords')
  for (const row of readMessageCorpus('resilience').messages.slice(0, 3)) {
    console.log(
      JSON.stringify(
        { id: row.id, text: row.text, structured: frameSummary(composeWords(row.text, table, labels, row.lang)) },
        null,
        2,
      ),
    )
  }

  printSection('Resilience bench (synthetic) → map + composeWords + geo places')
  for (const row of readMessageCorpus('resilience-synthetic').messages.slice(0, 4)) {
    const out: Record<string, unknown> = { id: row.id, text: row.text, kind: row.kind }
    out.map = mapRow(row.text, row.lang)
    if (row.expected_map_label) {
      out.expected_map_label = row.expected_map_label
      out.map_label_match = (out.map as { label: string }).label === row.expected_map_label
    }
    out.compose_words = frameSummary(composeWords(row.text, fieldTable, fieldLabels, row.lang))
    if (row.session) {
      const hits = placesNear(fieldVocab, resolveSpatialSession(row.session))
      out.geo_places_near = hits.slice(0, 3).map((h) => ({
        id: h.id,
        label: englishLabel(fieldVocab, h.id),
        distance_m: h.distance_m,
      }))
    }
    console.log(JSON.stringify(out, null, 2))
  }

  printSection('CrisisLex social text → map + composeWords')
  for (const row of readMessageCorpus('resilience-crisislex').messages.slice(0, 3)) {
    console.log(
      JSON.stringify(
        {
          id: row.id,
          text: row.text.slice(0, 100) + (row.text.length > 100 ? '…' : ''),
          map: mapRow(row.text, row.lang),
          compose_words: frameSummary(composeWords(row.text, fieldTable, fieldLabels, row.lang)),
        },
        null,
        2,
      ),
    )
  }

  if (process.env.SHOW_LIVE_COMPOSE === '1') {
    printSection('Live llama compose (vocab IDs → labeled actions/places)')
    const questions = readMessageCorpus('resilience-synthetic').messages
      .filter((m) => m.kind === 'question')
      .slice(0, Number(process.env.LOCAL_AI_EVAL_MAX_ROWS ?? 2))
    for (const row of questions) {
      if (!row.session || !row.event_ref || row.band == null) continue
      const geo = placesNear(fieldVocab, resolveSpatialSession(row.session)).map((h) => h.id)
      const event: EventSummary = {
        event_id: row.id,
        event_ref: row.event_ref,
        h3_cell: '88283472b3fffff',
        band: row.band as 1 | 2 | 3 | 4,
        trend: 'rising',
        sensors_agreeing: 2,
        started_utc: '2026-08-14T12:00:00Z',
        reports: [],
        candidate_action_ids: ['A_EVAC', 'A_SHELTER', 'A_STAY', 'A_HIGHER'],
        candidate_place_ids: geo.length > 0 ? geo : ['P_DIS_01'],
        candidate_resource_ids: ['R_KIT'],
        actors: ['PR_RESIDENT'],
      }
      console.log(
        JSON.stringify(
          {
            id: row.id,
            text: row.text,
            map: mapRow(row.text, row.lang),
            llama_compose: await liveCompose(event),
          },
          null,
          2,
        ),
      )
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})