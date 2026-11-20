/**
 * Stdin: JSON MessageRow[]. Stdout: JSON MessageRow[] with geo gold fields.
 */
import { readFileSync } from 'node:fs'
import type { MessageRow } from '@local-hosting/compose/messages'
import { resilienceEvalVocabulary } from '../eval/resilience-eval-vocab.js'
import { placesNear } from '../src/spatial/places-near.js'
import { resolveSpatialSession } from '../src/spatial/session-resolve.js'

function expectComposeWhereToGo(
  eventRef: string,
  geoRank1: string,
): NonNullable<MessageRow['expect_compose']> {
  const actions =
    eventRef === 'E_FLOOD'
      ? ['A_SHELTER', 'A_EVAC', 'A_HIGHER']
      : ['A_SHELTER', 'A_EVAC']
  return {
    acceptable_action_ids: [actions],
    must_include_place_ids: [geoRank1],
  }
}

function annotateMessage(message: MessageRow): MessageRow {
  if (!message.session) return message
  const vocab = resilienceEvalVocabulary()
  const hits = placesNear(vocab, resolveSpatialSession(message.session))
  const geo_rank1_id = hits[0]?.id
  if (!geo_rank1_id) return message

  const next: MessageRow = {
    ...message,
    geo_rank1_id,
    geo_rank2_ids: hits.slice(0, 2).map((h) => h.id),
    expected_place_id: geo_rank1_id,
  }
  if (message.expected_map_label === 'where_to_go' && message.event_ref) {
    next.expect_compose = expectComposeWhereToGo(message.event_ref, geo_rank1_id)
  }
  return next
}

const raw = readFileSync(0, 'utf8')
const messages = JSON.parse(raw) as MessageRow[]
process.stdout.write(`${JSON.stringify(messages.map(annotateMessage))}\n`)