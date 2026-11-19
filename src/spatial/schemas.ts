import { z } from 'zod'
import {
  SUPPORTED_LANGUAGES,
  eventSummarySchema,
  vocabularySchema,
} from '@local-hosting/local-ai'

const langEnum = z.enum(SUPPORTED_LANGUAGES)

const spatialSessionSchema = z.object({
  h3_cell: z.string().optional(),
  lat: z.number().finite().optional(),
  lon: z.number().finite().optional(),
  h3_resolution: z.number().int().min(0).max(15).optional(),
  geotype: z.string().optional(),
  limit: z.number().int().positive().max(64).optional(),
})

const packModeSchema = z.enum(['daily', 'resilience'])

export const spatialChatRequestSchema = z
  .object({
    text: z.string().min(1),
    lang: langEnum,
    vocab: vocabularySchema.optional(),
    vocab_tip: z.string().min(1).optional(),
    pack_mode: packModeSchema.optional(),
    session: spatialSessionSchema.optional(),
    event: eventSummarySchema.optional(),
    compose: z
      .object({
        rules_only: z.boolean().optional(),
      })
      .optional(),
  })
  .refine(
    (data) =>
      data.vocab !== undefined ||
      data.vocab_tip !== undefined ||
      data.pack_mode !== undefined,
    { message: 'vocab, vocab_tip, or pack_mode required' },
  )