import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { logEvent } from '../../common/logging/log-event'
import { EnvironmentVariables } from '../../config/env.validation'
import {
  AccessibilityReport,
  accessibilityReport,
  checkDesign,
  DesignIssue,
  applyFixes,
} from '../design/document/check-design'
import {
  DesignDocument,
  GeneratedDesign,
  generatedDesignJsonSchema,
  generatedDesignSchema,
  toDesignDocument,
  toGeneratedDesign,
} from '../design/document/design-document'
import { UiKit } from '../design/document/ui-kits'
import { asConversation, GenerationInput, repairPrompt } from './design-prompts'
import { GenerationProgress } from './generation.constants'
import { LlmClient, LlmMessage } from './llm.client'

export type VariantResult =
  | {
      passed: true
      document: DesignDocument
      accessibility: AccessibilityReport
      attempts: number
      autoFixed: string[]
      usage: Usage
    }
  | { passed: false; issues: DesignIssue[]; attempts: number; usage: Usage }

interface Usage {
  promptTokens: number
  completionTokens: number
}

export interface VariantRequest {
  kit: UiKit
  input: GenerationInput
  index: number
  total: number
  previous: GeneratedDesign[]
}

export interface GenerationHooks {
  signal?: AbortSignal
  progress?: (progress: Omit<GenerationProgress, 'variant' | 'of'>) => void
}

/**
 * Generates one design with the LLM, constrained by a JSON schema of the
 * project's UI kit, then checks it (UI kit guardrail + WCAG 2.0 AA). Failing
 * designs go back to the model with the list of issues, up to
 * `DESIGN_REPAIR_ATTEMPTS` times; text contrast left over after that is fixed
 * deterministically. A design that still fails is not returned.
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
    const { kit } = request
    const schema = generatedDesignJsonSchema(kit)
    const parser = generatedDesignSchema(kit)
    const messages: LlmMessage[] = asConversation(kit, request.input, request)
    const usage: Usage = { promptTokens: 0, completionTokens: 0 }
    let issues: DesignIssue[] = []
    let last: DesignDocument | undefined
    let autoFixed: string[] = []

    for (let attempt = 1; attempt <= this.repairs + 1; attempt++) {
      hooks.progress?.({
        stage: attempt === 1 ? 'generating' : 'repairing',
        attempt,
      })
      const completion = await this.llm.structured({
        messages,
        schemaName: 'ui_design',
        schema,
        signal: hooks.signal,
        // Repairs should change only what is wrong.
        temperature: attempt === 1 ? 0.7 : 0.2,
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
      const parsed = this.parse(
        completion.content,
        completion.finishReason,
        parser,
      )
      if (!parsed.design) {
        issues = parsed.issues
        last = undefined
        // A broken answer is no basis for a repair: ask again from scratch.
        messages.splice(2)
        this.logAttempt(request, attempt, issues)
        continue
      }

      // Unmarked headings are fixed mechanically: not worth a model round trip.
      const marked = applyFixes(toDesignDocument(parsed.design, kit), kit, [
        'headings',
      ])
      last = marked.document
      autoFixed = marked.fixed
      const check = checkDesign(last, kit)
      issues = check.issues.filter((issue) => issue.severity === 'error')
      this.logAttempt(request, attempt, issues)
      if (check.passed) {
        return {
          passed: true,
          document: last,
          accessibility: accessibilityReport(check, autoFixed),
          attempts: attempt,
          autoFixed,
          usage,
        }
      }
      hooks.progress?.({ stage: 'checking', attempt, errors: issues.length })
      messages.splice(
        2,
        messages.length,
        { role: 'assistant', content: JSON.stringify(toGeneratedDesign(last)) },
        { role: 'user', content: repairPrompt(issues) },
      )
    }

    if (last) {
      const { document, fixed } = applyFixes(last, kit, [
        'contrast',
        'headings',
      ])
      const check = checkDesign(document, kit)
      if (check.passed) {
        return {
          passed: true,
          document,
          accessibility: accessibilityReport(check, [...autoFixed, ...fixed]),
          attempts: this.repairs + 1,
          autoFixed: [...autoFixed, ...fixed],
          usage,
        }
      }
      issues = check.issues.filter((issue) => issue.severity === 'error')
    }

    return { passed: false, issues, attempts: this.repairs + 1, usage }
  }

  private parse(
    content: string,
    finishReason: string | null,
    parser: ReturnType<typeof generatedDesignSchema>,
  ): { design?: GeneratedDesign; issues: DesignIssue[] } {
    if (finishReason === 'length') {
      return {
        issues: [
          {
            rule: 'structure',
            severity: 'error',
            message: 'The design was cut off (too long); make it more compact.',
          },
        ],
      }
    }
    let json: unknown
    try {
      json = JSON.parse(content)
    } catch {
      return {
        issues: [
          {
            rule: 'structure',
            severity: 'error',
            message: 'Output is not valid JSON.',
          },
        ],
      }
    }
    const result = parser.safeParse(json)
    if (!result.success) {
      return {
        issues: result.error.issues.slice(0, 20).map((issue) => ({
          rule: 'structure' as const,
          severity: 'error' as const,
          message: `${issue.path.join('.')}: ${issue.message}`,
        })),
      }
    }

    return { design: result.data, issues: [] }
  }

  private logAttempt(
    request: VariantRequest,
    attempt: number,
    issues: DesignIssue[],
  ) {
    const count = (rule: DesignIssue['rule']) =>
      issues.filter((i) => i.rule === rule).length
    this.logger.log(
      logEvent('design.checked', {
        variant: request.index,
        attempt,
        passed: issues.length === 0,
        structure: count('structure'),
        uiKit: count('ui-kit'),
        wcag: count('wcag'),
      }),
    )
  }
}
