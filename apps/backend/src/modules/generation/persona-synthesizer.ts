import { Injectable, Logger } from '@nestjs/common'
import { z } from 'zod'

import { llmJsonSchema } from '../../common/json-schema'
import { logEvent } from '../../common/logging/log-event'
import {
  GenerationInput,
  PersonaInput,
  personaConversation,
} from './design-prompts'
import { LlmClient } from './llm.client'

const items = z.array(z.string().min(1).max(300)).min(1).max(8)

const personaSchema = z
  .object({
    name: z.string().min(1).max(120),
    age: z.number().int().min(1).max(120),
    shortDescription: z.string().min(1).max(2000),
    behavioralConsiderations: items,
    frustrations: items,
    goals: items,
    tasks: items,
  })
  .strict()

const PERSONA_JSON_SCHEMA = llmJsonSchema(personaSchema)

/**
 * Persona Artifact synthesis: turns the designer's prompt (and the project
 * context) into a user persona with the text model (`LLM_ANALYSIS_MODEL`).
 * The answer is validated before it is saved as a project persona.
 */
@Injectable()
export class PersonaSynthesizer {
  private readonly logger = new Logger(PersonaSynthesizer.name)

  constructor(private readonly llm: LlmClient) {}

  async synthesize(
    input: GenerationInput,
    signal?: AbortSignal,
  ): Promise<{
    persona: PersonaInput
    usage: { promptTokens: number; completionTokens: number }
  }> {
    const completion = await this.llm.structured({
      messages: personaConversation(input),
      schemaName: 'user_persona',
      schema: PERSONA_JSON_SCHEMA,
      model: this.llm.analysisModel,
      temperature: 0.5,
      signal,
    })
    if (completion.finishReason === 'length') {
      throw new Error('The persona was cut off by the model; retrying.')
    }
    let json: unknown
    try {
      json = JSON.parse(completion.content)
    } catch {
      throw new Error('The persona was not valid JSON; retrying.')
    }
    const parsed = personaSchema.safeParse(json)
    if (!parsed.success) {
      throw new Error(
        `The persona did not match the schema (${parsed.error.issues[0]?.message ?? 'invalid'}); retrying.`,
      )
    }
    this.logger.log(
      logEvent('persona.synthesized', { model: this.llm.analysisModel }),
    )

    return {
      persona: {
        ...parsed.data,
        name: parsed.data.name.trim(),
        shortDescription: parsed.data.shortDescription.trim(),
      },
      usage: completion.usage,
    }
  }
}
