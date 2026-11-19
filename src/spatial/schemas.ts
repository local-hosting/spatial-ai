import { z } from 'zod'
import { composeRequestSchema, vocabularySchema } from '@local-hosting/ai'
import { SUPPORTED_LANGUAGES } from '@local-hosting/compose'

const langEnum = z.enum(SUPPORTED_LANGUAGES)

const spatialSessionSchema = z.object({
  h3_cell: z.string().optional(),
  lat: z.number().finite().optional(),
  lon: z.number().finite().optional(),
  h3_resolution: z.number().int().min(0).max(15).optional(),
  geotype: z.string().optional(),
  limit: z.number().int().positive().max(64).optional(),
})

export const spatialChatRequestSchema = z.object({
  text: z.string().min(1),
  lang: langEnum,
  vocab: vocabularySchema,
  session: spatialSessionSchema.optional(),
  event: composeRequestSchema.shape.event.optional(),
  compose: z
    .object({
      rules_only: z.boolean().optional(),
    })
    .optional(),
})