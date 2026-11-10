import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { z } from 'zod'

import { llmJsonSchema } from '../../common/json-schema'
import { logEvent } from '../../common/logging/log-event'
import { EnvironmentVariables } from '../../config/env.validation'
import { checkHtml, HtmlIssue, HtmlReport } from '../design/html/check-html'
import { MAX_HTML_BYTES } from '../design/html/sanitize-html-design'
import {
  asConversation,
  GenerationInput,
  PersonaInput,
  repairPrompt,
} from './design-prompts'
import { GenerationProgress } from './generation.constants'
import { LlmClient, LlmMessage } from './llm.client'

const designSchema = z
  .object({
    title: z.string().min(1).max(160),
    rationale: z.string().min(1).max(2000),
    html: z.string().min(50).max(MAX_HTML_BYTES),
  })
  .strict()

const DESIGN_JSON_SCHEMA = llmJsonSchema(designSchema)

interface Usage {
  promptTokens: number
  completionTokens: number
}

export type VariantResult =
  | {
      passed: true
      title: string
      rationale: string
      /** Sanitized document. */
      html: string
      report: HtmlReport
      attempts: number
      usage: Usage
    }
  | { passed: false; issues: HtmlIssue[]; attempts: number; usage: Usage }

export interface VariantRequest {
  input: GenerationInput
  /** Personas to design for; the persona artifact of the prompt comes first. */
  personas: PersonaInput[]
  index: number
  total: number
  previous: Array<{ title: string; rationale: string }>
}

export interface GenerationHooks {
  signal?: AbortSignal
  progress?: (progress: Omit<GenerationProgress, 'variant' | 'of'>) => void
}

/**
 * Generates one high-fidelity HTML design with the LLM from the prompt
 * template (project, design intent, personas, stories, request), then
 * sanitizes and checks it (structure, WCAG 2.1 AA markup, brand colors,
 * platforms). A failing design goes back to the model with its issues, up to
 * `DESIGN_REPAIR_ATTEMPTS` times; one that still fails is not returned.
 */
@Injectable()
export class DesignGenerator {
  private readonly logger = new Logger(DesignGenerator.name)
  private readonly repairs: number

  constructor(
    private readonly llm: LlmClient,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.repairs = config.get('DESIGN_REPAIR_ATTEMPTS', { infer: true })
  }

  async generate(
    request: VariantRequest,
    hooks: GenerationHooks = {},
  ): Promise<VariantResult> {
    const { input } = request
    const messages: LlmMessage[] = asConversation(input, request.personas, {
      index: request.index,
      total: request.total,
      previous: request.previous,
    })
    const context = {
      platforms: input.project.platforms,
      brandColors: Object.values(input.intent.colors).filter(
        (color): color is string => Boolean(color),
      ),
    }
    const usage: Usage = { promptTokens: 0, completionTokens: 0 }
    let issues: HtmlIssue[] = []

    for (let attempt = 1; attempt <= this.repairs + 1; attempt++) {
      hooks.progress?.({
        stage: attempt === 1 ? 'generating' : 'repairing',
        attempt,
      })
      const completion = await this.llm.structured({
        messages,
        schemaName: 'html_design',
        schema: DESIGN_JSON_SCHEMA,
        temperature: attempt === 1 ? 0.8 : 0.4,
        signal: hooks.signal,
        onDelta: (receivedChars) =>
          hooks.progress?.({
            stage: attempt === 1 ? 'generating' : 'repairing',
            attempt,
            receivedChars,
          }),
      })
      usage.promptTokens += completion.usage.promptTokens
      usage.completionTokens += completion.usage.completionTokens

      hooks.progress?.({ stage: 'checking', attempt })
      const parsed = this.parse(completion.content, completion.finishReason)
      if ('issues' in parsed) {
        issues = parsed.issues
      } else {
        const check = checkHtml(parsed.html, context)
        this.logger.log(
          logEvent('design.checked', {
            variant: request.index,
            attempt,
            passed: check.report.passed,
            errors: check.report.errors,
            warnings: check.report.warnings,
            bytes: check.report.bytes,
          }),
        )
        if (check.report.passed) {
          return {
            passed: true,
            title: parsed.title,
            rationale: parsed.rationale,
            html: check.html,
            report: check.report,
            attempts: attempt,
            usage,
          }
        }
        issues = check.report.issues.filter(
          (issue) => issue.severity === 'error',
        )
      }
      hooks.progress?.({ stage: 'checking', attempt, errors: issues.length })
      messages.push(
        { role: 'assistant', content: completion.content },
        { role: 'user', content: repairPrompt(issues) },
      )
    }

    return { passed: false, issues, attempts: this.repairs + 1, usage }
  }

  private parse(
    content: string,
    finishReason: string | null,
  ): z.infer<typeof designSchema> | { issues: HtmlIssue[] } {
    const fail = (message: string) => ({
      issues: [
        { rule: 'structure' as const, severity: 'error' as const, message },
      ],
    })
    if (finishReason === 'length') {
      return fail(
        'The answer was cut off: make the document shorter (less repetition, simpler SVGs).',
      )
    }
    let json: unknown
    try {
      json = JSON.parse(content)
    } catch {
      return fail('The answer was not valid JSON.')
    }
    const parsed = designSchema.safeParse(json)

    return parsed.success
      ? parsed.data
      : fail(
          `The answer did not match the schema: ${parsed.error.issues[0]?.message ?? 'invalid'}.`,
        )
  }
}
