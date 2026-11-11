import { z } from 'zod'

import { llmJsonSchema } from '../../common/json-schema'

export const FEEDBACK_CATEGORIES = [
  'USABILITY',
  'VISUAL_DESIGN',
  'CONTENT',
  'ACCESSIBILITY',
  'PERFORMANCE',
  'FUNCTIONALITY',
  'OTHER',
] as const

export const FEEDBACK_SEVERITIES = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const

export const MAX_THEMES = 15

/** What the model must return for a feedback analysis. */
export const analysisResultSchema = z
  .object({
    summary: z.string().min(1).max(3000),
    insights: z.array(z.string().min(1).max(500)).max(10),
    themes: z
      .array(
        z
          .object({
            title: z.string().min(1).max(160),
            summary: z.string().min(1).max(1500),
            category: z.enum(FEEDBACK_CATEGORIES),
            severity: z.enum(FEEDBACK_SEVERITIES),
            labels: z.array(z.string().min(1).max(40)).max(6),
            /** References such as "f3" to the numbered feedback items. */
            feedbackRefs: z.array(z.string().min(1).max(12)).min(1).max(300),
          })
          .strict(),
      )
      .min(1)
      .max(MAX_THEMES),
  })
  .strict()

export type AnalysisResult = z.infer<typeof analysisResultSchema>

export const analysisJsonSchema = llmJsonSchema(analysisResultSchema)

/** What the model must return when drafting user stories. */
export const storiesResultSchema = z
  .object({
    stories: z
      .array(
        z
          .object({
            title: z.string().min(1).max(200),
            description: z.string().min(1).max(2000),
            acceptanceCriteria: z.string().min(1).max(2000),
            problemStatement: z.string().min(1).max(1000),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()

export type StoriesResult = z.infer<typeof storiesResultSchema>

export const storiesJsonSchema = llmJsonSchema(storiesResultSchema)
