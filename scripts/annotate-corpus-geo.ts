/**
 * Fill geo_rank1_id, geo_rank2_ids, expected_place_id, expect_compose on a bench YAML.
 *
 *   node --import tsx scripts/annotate-corpus-geo.ts everyday-spatial
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { MessageCorpusDocument, MessageCorpusId } from '@local-hosting/compose/messages'
import { messageCorpusYamlPath } from '@local-hosting/compose/messages'
import type { QuestionLabel } from '@local-hosting/local-ai'
import { CANDIDATE_ACTION_IDS } from '../eval/resilience-question-bench.js'
import { resilienceEvalVocabulary } from '../eval/resilience-eval-vocab.js'
import { deriveComposeRubric } from '../src/spatial/compose-rubric.js'
import { placesNear } from '../src/spatial/places-near.js'
import { resolveSpatialSession } from '../src/spatial/session-resolve.js'

function expectComposeForRow(
  mapLabel: QuestionLabel | 'other',
  eventRef: string,
  band: number,
  geoRank1: string,
): NonNullable<MessageCorpusDocument['messages'][0]['expect_compose']> {
  const vocab = resilienceEvalVocabulary()
  const rubric = deriveComposeRubric(
    vocab,
    eventRef,
    band,
    [...CANDIDATE_ACTION_IDS],
    mapLabel,
  )
  const must =
    mapLabel === 'where_to_go' || mapLabel === 'is_it_safe_for_kids'
      ? [geoRank1]
      : mapLabel === 'is_it_safe_outside'
        ? [geoRank1]
        : undefined
  return {
    acceptable_action_ids: [rubric.acceptable_action_ids],
    ...(must ? { must_include_place_ids: must } : {}),
  }
}

function annotateDoc(doc: MessageCorpusDocument): MessageCorpusDocument {
  const vocab = resilienceEvalVocabulary()
  const messages = doc.messages.map((row) => {
    if (!row.session) return row
    const hits = placesNear(vocab, resolveSpatialSession(row.session))
    const geo_rank1_id = hits[0]?.id
    if (!geo_rank1_id) return row
    const next = {
      ...row,
      geo_rank1_id,
      geo_rank2_ids: hits.slice(0, 2).map((h) => h.id),
      expected_place_id: geo_rank1_id,
    }
    if (
      row.kind === 'question' &&
      row.expected_map_label &&
      row.event_ref &&
      row.band != null
    ) {
      next.expect_compose = expectComposeForRow(
        row.expected_map_label as QuestionLabel,
        row.event_ref,
        row.band,
        geo_rank1_id,
      )
    }
    return next
  })
  return { ...doc, messages }
}

const corpusId = (process.argv[2] ?? 'everyday-spatial') as MessageCorpusId
const file = messageCorpusYamlPath(corpusId)
const raw = parseYaml(readFileSync(file, 'utf8')) as MessageCorpusDocument
const next = annotateDoc(raw)
writeFileSync(file, stringifyYaml(next, { lineWidth: 0 }))
console.error(`Annotated ${file} (${next.messages.length} rows)`)