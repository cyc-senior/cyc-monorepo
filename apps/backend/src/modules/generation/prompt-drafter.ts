import { Injectable } from '@nestjs/common'
import { z } from 'zod'

import { llmJsonSchema } from '../../common/json-schema'
import {
  DesignIntent,
  UserPersona,
  UserStory,
} from '../../generated/prisma/client'
import { LlmClient, LlmMessage } from './llm.client'

const text = (max: number, description: string) =>
  z.string().trim().min(1).max(max).describe(description)

const variantSchema = (description: string) =>
  z
    .object({
      name: text(120, 'Short name of the variant'),
      description: text(2000, description),
    })
    .strict()

/** What the model must answer when drafting a structured prompt. */
const draftPromptSchema = z
  .object({
    goal: text(2000, 'A clear, concise user goal to achieve in the interface'),
    problem: text(2000, 'The core user problem or friction being addressed'),
    mustUse: text(
      2000,
      'Design system, accessibility standards, brand colors, and guidelines',
    ),
    comparisonQuestion: text(
      500,
      'The evaluation question testers answer when comparing Variant A vs Variant B',
    ),
    variantA: variantSchema(
      'One clear design thesis or UX strategy for Variant A',
    ),
    variantB: variantSchema(
      'A distinct, contrasting UX strategy for Variant B',
    ),
  })
  .strict()

export type DraftPromptResult = z.infer<typeof draftPromptSchema>

const DRAFT_PROMPT_JSON_SCHEMA = llmJsonSchema(draftPromptSchema)

const SYSTEM_PROMPT =
  'You are an expert UX design strategist. Your task is to draft a structured prompt for A/B UI variant generation based on the user story, design intent, and persona. Keep Variant A and B differing in exactly one key dimension (e.g. single-page direct flow vs staged guided flow).'

/** What a structured prompt is drafted from. */
export interface DraftPromptInput {
  story: UserStory
  intent: DesignIntent | null
  persona: UserPersona | null
}

export interface DraftPromptHooks {
  signal?: AbortSignal
  /** The model's reasoning so far. */
  onThought?: (thought: string) => void
  /** Characters of the answer received so far. */
  onDelta?: (receivedChars: number) => void
}

/**
 * Validates the model's answer. Throws a message fit to show the designer
 * when it was cut off, is not JSON, or misses a field.
 */
export function parseDraftPrompt(
  content: string,
  finishReason: string | null,
): DraftPromptResult {
  if (finishReason === 'length') {
    throw new Error('The drafted prompt was cut off by the model. Try again.')
  }
  let json: unknown
  try {
    json = JSON.parse(content)
  } catch {
    throw new Error('The model did not return a valid prompt. Try again.')
  }
  const parsed = draftPromptSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(
      `The drafted prompt was incomplete (${issue ? `${issue.path.join('.')}: ${issue.message}` : 'invalid'}). Try again.`,
    )
  }

  return parsed.data
}

/** The conversation that asks the model for a structured prompt. */
export function draftPromptConversation({
  story,
  intent,
  persona,
}: DraftPromptInput): LlmMessage[] {
  const designSystem = intent?.designSystem === 'MUI' ? 'Material UI' : 'shadcn'
  const standard = intent?.designStandards?.[0] || 'WCAG 2.2 AA'
  const color = intent?.primaryColor || '#F2652A'

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: JSON.stringify({
        userStory: {
          title: story.title,
          description: story.description,
          problemStatement: story.problemStatement,
          acceptanceCriteria: story.acceptanceCriteria,
        },
        designIntent: intent
          ? {
              statement: intent.statement,
              designSystem: intent.designSystem,
              designStandards: intent.designStandards,
              primaryColor: intent.primaryColor,
              secondaryColor: intent.secondaryColor,
              accentColor: intent.accentColor,
              brandGuidelines: intent.brandGuidelines,
              toneOfVoice: intent.toneOfVoice,
            }
          : null,
        persona: persona
          ? {
              name: persona.name,
              age: persona.age,
              shortDescription: persona.shortDescription,
              frustrations: persona.frustrations,
              goals: persona.goals,
            }
          : null,
        defaults: {
          goal:
            story.acceptanceCriteria ||
            story.title ||
            'Complete the primary user workflow successfully.',
          problem:
            story.problemStatement ||
            'Users need a more efficient way to accomplish this task.',
          mustUse: `Use ${designSystem} components only and meet ${standard}. Use ${color} for primary actions. Keep copy plain and friendly, and provide clear user feedback.`,
        },
      }),
    },
  ]
}

/**
 * Drafts the structured A/B prompt for a user story with the text model
 * (`LLM_ANALYSIS_MODEL`). The answer is validated before it is returned.
 */
@Injectable()
export class PromptDrafter {
  constructor(private readonly llm: LlmClient) {}

  get configured(): boolean {
    return this.llm.configured
  }

  async draft(
    input: DraftPromptInput,
    hooks: DraftPromptHooks = {},
  ): Promise<DraftPromptResult> {
    // Throws LlmNotConfiguredError without LLM_BASE_URL / LLM_API_KEY.
    const completion = await this.llm.structured({
      schemaName: 'StructuredPromptReview',
      schema: DRAFT_PROMPT_JSON_SCHEMA,
      signal: hooks.signal,
      model: this.llm.analysisModel,
      messages: draftPromptConversation(input),
      onThoughtDelta: (_chunk, totalThought) => hooks.onThought?.(totalThought),
      onDelta: (receivedChars) => hooks.onDelta?.(receivedChars),
    })

    return parseDraftPrompt(completion.content, completion.finishReason)
  }
}
