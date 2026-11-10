import { Injectable } from '@nestjs/common'

import { LlmClient, LlmMessage } from '../generation/llm.client'
import {
  storiesJsonSchema,
  storiesResultSchema,
  StoriesResult,
} from './analysis-schema'
import { AiProgress } from './ai.constants'

/** The brief a drafting job works from (snapshotted on the job). */
export interface StoryDraftInput {
  project: {
    name: string
    clientOrProduct: string
    description: string | null
    platforms: string[]
  }
  designIntent: string | null
  toneOfVoice: string | null
  personas: Array<{ name: string; shortDescription: string; goals: string[] }>
  existingStories: string[]
  instruction: string | null
  count: number
}

const SYSTEM_PROMPT = `You are a product designer writing user stories for a UI design project.

For each story give: a short title; a description in the form "As a <persona>, I want <goal> so that <benefit>"; acceptance criteria (a short list in plain text); and a problem statement (the user's problem the story addresses, one or two sentences).

Rules:
- Ground every story in the project brief and persona. Do not invent features unrelated to the brief.
- Stories must be distinct from each other and from the existing ones.
- Write in the language of the brief.
- You draft; a designer reviews and edits every story before it is used.`

/** Drafts user stories and problem statements from the project's design brief. */
@Injectable()
export class StoryDrafter {
  constructor(private readonly llm: LlmClient) {}

  async draft(
    input: StoryDraftInput,
    hooks: {
      signal?: AbortSignal
      progress?: (progress: AiProgress) => void
    } = {},
  ): Promise<{
    stories: StoriesResult['stories']
    usage: { promptTokens: number; completionTokens: number }
  }> {
    hooks.progress?.({ stage: 'drafting' })
    const completion = await this.llm.structured({
      messages: this.messages(input),
      schemaName: 'user_stories',
      schema: storiesJsonSchema,
      model: this.llm.analysisModel,
      temperature: 0.6,
      signal: hooks.signal,
      onDelta: (receivedChars) =>
        hooks.progress?.({ stage: 'drafting', receivedChars }),
    })
    hooks.progress?.({ stage: 'validating' })
    if (completion.finishReason === 'length') {
      throw new Error('The draft was cut off by the model; retrying.')
    }
    let json: unknown
    try {
      json = JSON.parse(completion.content)
    } catch {
      throw new Error('The draft was not valid JSON; retrying.')
    }
    const parsed = storiesResultSchema.safeParse(json)
    if (!parsed.success) {
      throw new Error(
        `The draft did not match the schema (${parsed.error.issues[0]?.message ?? 'invalid'}); retrying.`,
      )
    }

    return {
      // Never more than were asked for, whatever the model returned.
      stories: parsed.data.stories.slice(0, input.count),
      usage: completion.usage,
    }
  }

  private messages(input: StoryDraftInput): LlmMessage[] {
    const lines = [
      `Project: ${input.project.name} for ${input.project.clientOrProduct}${input.project.description ? ` — ${input.project.description}` : ''}`,
      `Platforms: ${input.project.platforms.join(', ')}`,
      input.designIntent && `Design intent: ${input.designIntent}`,
      input.toneOfVoice && `Tone of voice: ${input.toneOfVoice}`,
      input.personas.length > 0 &&
        `User personas:\n${input.personas.map((p) => `- ${p.name}: ${p.shortDescription}${p.goals.length ? ` (goals: ${p.goals.join('; ')})` : ''}`).join('\n')}`,
      input.existingStories.length > 0 &&
        `Existing stories (do not repeat):\n${input.existingStories.map((t) => `- ${t}`).join('\n')}`,
      input.instruction && `Designer's guidance: ${input.instruction}`,
      `Write ${input.count} user ${input.count === 1 ? 'story' : 'stories'}.`,
    ]

    return [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: lines.filter(Boolean).join('\n') },
    ]
  }
}
