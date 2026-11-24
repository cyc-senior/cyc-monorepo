import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import OpenAI from 'openai'

import { logEvent } from '../../common/logging/log-event'
import { EnvironmentVariables } from '../../config/env.validation'
import { LlmAbortedError } from './llm-aborted.error'
import { LlmNotConfiguredError } from './llm-not-configured.error'

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface StructuredCompletion {
  content: string
  thought?: string
  /** `length` means the output was cut off. */
  finishReason: string | null
  usage: { promptTokens: number; completionTokens: number }
}

/**
 * OpenAI-compatible chat client constrained to a JSON schema (structured
 * output). Streams the answer so callers can report progress and abort.
 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name)
  private readonly client?: OpenAI
  readonly model: string
  /** Model for analysis and drafting (the proposal's text model). */
  readonly analysisModel: string
  readonly provider: string
  private readonly maxTokens: number
  private readonly disableThinking: boolean

  constructor(config: ConfigService<EnvironmentVariables, true>) {
    const baseURL = config.get('LLM_BASE_URL', { infer: true })
    const apiKey = config.get('LLM_API_KEY', { infer: true })
    this.model = config.get('LLM_MODEL', { infer: true })
    this.analysisModel =
      config.get('LLM_ANALYSIS_MODEL', { infer: true }) ?? this.model
    this.maxTokens = config.get('LLM_MAX_TOKENS', { infer: true })
    this.disableThinking = config.get('LLM_DISABLE_THINKING', { infer: true })
    this.provider = baseURL ? new URL(baseURL).host : 'unconfigured'
    if (baseURL && apiKey) {
      this.client = new OpenAI({
        baseURL,
        apiKey,
        timeout: config.get('LLM_TIMEOUT_MS', { infer: true }),
        maxRetries: 2,
      })
    }
  }

  get configured(): boolean {
    return this.client !== undefined
  }

  async structured(options: {
    messages: LlmMessage[]
    schemaName: string
    schema: Record<string, unknown>
    temperature?: number
    /** Defaults to the design model (`LLM_MODEL`). */
    model?: string
    signal?: AbortSignal
    /** Called as output arrives, with the characters received so far. */
    onDelta?: (receivedChars: number) => void
    /** Called as reasoning/thinking tokens arrive. */
    onThoughtDelta?: (thoughtDelta: string, totalThought: string) => void
  }): Promise<StructuredCompletion> {
    if (!this.client) {
      throw new LlmNotConfiguredError()
    }
    const started = Date.now()
    const model = options.model ?? this.model
    const body = {
      model,
      messages: options.messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: this.maxTokens,
      stream: true as const,
      stream_options: { include_usage: true },
      response_format: {
        type: 'json_schema' as const,
        json_schema: {
          name: options.schemaName,
          strict: true,
          schema: options.schema,
        },
      },
      // vLLM chat-template switch: skip the reasoning phase.
      ...(this.disableThinking
        ? { chat_template_kwargs: { enable_thinking: false } }
        : {}),
    }
    const stream = await this.client.chat.completions.create(body, {
      signal: options.signal,
    })

    let content = ''
    let thought = ''
    let inThinkTag = false
    let finishReason: string | null = null
    const usage = { promptTokens: 0, completionTokens: 0 }

    for await (const chunk of stream) {
      const choice = chunk.choices[0]
      const delta = choice?.delta as
        | (typeof choice.delta & {
            reasoning_content?: string
            reasoning?: string
          })
        | undefined

      // Check for reasoning_content (vLLM / Qwen / DeepSeek-R1 / OpenAI format)
      const reasoningChunk = delta?.reasoning_content ?? delta?.reasoning
      if (reasoningChunk) {
        thought += reasoningChunk
        options.onThoughtDelta?.(reasoningChunk, thought)
      }

      // Check content, handling potential inline <think>...</think> tags
      if (delta?.content) {
        let chunkContent = delta.content
        if (inThinkTag) {
          const endIdx = chunkContent.indexOf('</think>')
          if (endIdx >= 0) {
            const thinkPart = chunkContent.slice(0, endIdx)
            thought += thinkPart
            options.onThoughtDelta?.(thinkPart, thought)
            inThinkTag = false
            chunkContent = chunkContent.slice(endIdx + 8) // '</think>'.length
          } else {
            thought += chunkContent
            options.onThoughtDelta?.(chunkContent, thought)
            chunkContent = ''
          }
        } else {
          const startIdx = chunkContent.indexOf('<think>')
          if (startIdx >= 0) {
            const beforeThink = chunkContent.slice(0, startIdx)
            content += beforeThink
            chunkContent = chunkContent.slice(startIdx + 7) // '<think>'.length
            inThinkTag = true
            const endIdx = chunkContent.indexOf('</think>')
            if (endIdx >= 0) {
              const thinkPart = chunkContent.slice(0, endIdx)
              thought += thinkPart
              options.onThoughtDelta?.(thinkPart, thought)
              inThinkTag = false
              chunkContent = chunkContent.slice(endIdx + 8)
            } else {
              thought += chunkContent
              options.onThoughtDelta?.(chunkContent, thought)
              chunkContent = ''
            }
          }
        }

        if (chunkContent) {
          content += chunkContent
          options.onDelta?.(content.length)
        }
      }

      finishReason = choice?.finish_reason ?? finishReason
      if (chunk.usage) {
        usage.promptTokens = chunk.usage.prompt_tokens
        usage.completionTokens = chunk.usage.completion_tokens
      }
    }
    // An aborted stream can end quietly; never return its partial output.
    if (options.signal?.aborted) {
      throw new LlmAbortedError()
    }
    this.logger.log(
      logEvent('llm.completion', {
        model,
        schema: options.schemaName,
        ms: Date.now() - started,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        finish: finishReason,
      }),
    )

    return {
      content,
      thought: thought.length > 0 ? thought : undefined,
      finishReason,
      usage,
    }
  }
}
