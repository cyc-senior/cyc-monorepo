import { ConfigService } from '@nestjs/config'

import { EnvironmentVariables } from '../../config/env.validation'
import { LlmClient } from './llm.client'
import { LlmAbortedError } from './llm-aborted.error'
import { LlmNotConfiguredError } from './llm-not-configured.error'

const settings: Record<string, unknown> = {
  LLM_BASE_URL: 'https://llm.example.com/v1',
  LLM_API_KEY: 'sk-test',
  LLM_MODEL: 'qwen3.8-27b',
  LLM_TIMEOUT_MS: 1000,
  LLM_MAX_TOKENS: 2000,
  LLM_DISABLE_THINKING: true,
}
const config = (overrides: Record<string, unknown> = {}) =>
  ({
    get: (key: string) => ({ ...settings, ...overrides })[key],
  }) as unknown as ConfigService<EnvironmentVariables, true>

/** Replaces the SDK with a fake stream of chunks. */
function withStream(
  client: LlmClient,
  chunks: unknown[],
  onEach?: (i: number) => void,
) {
  const create = jest.fn(async () => ({
    async *[Symbol.asyncIterator]() {
      for (const [i, chunk] of chunks.entries()) {
        onEach?.(i)
        yield chunk
      }
    },
  }))
  ;(client as unknown as { client: unknown }).client = {
    chat: { completions: { create } },
  }

  return create
}

const delta = (content: string, finish: string | null = null) => ({
  choices: [{ delta: { content }, finish_reason: finish }],
})

describe('LlmClient', () => {
  const request = {
    messages: [{ role: 'user' as const, content: 'hi' }],
    schemaName: 'ui_design',
    schema: { type: 'object' },
  }

  it('streams a schema-constrained answer and reports usage', async () => {
    const client = new LlmClient(config())
    const create = withStream(client, [
      delta('{"a":'),
      delta('1}', 'stop'),
      { choices: [], usage: { prompt_tokens: 10, completion_tokens: 4 } },
    ])
    const seen: number[] = []

    const result = await client.structured({
      ...request,
      onDelta: (n) => seen.push(n),
    })

    expect(result).toEqual({
      content: '{"a":1}',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 4 },
    })
    expect(seen).toEqual([5, 7])
    const [body] = create.mock.calls[0] as unknown as [Record<string, unknown>]
    expect(body).toMatchObject({
      model: 'qwen3.8-27b',
      stream: true,
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'ui_design', strict: true },
      },
      chat_template_kwargs: { enable_thinking: false },
    })
  })

  it('throws instead of returning partial output when aborted', async () => {
    const client = new LlmClient(config())
    const abort = new AbortController()
    withStream(
      client,
      [delta('{"a":'), delta('1')],
      (i) => i === 1 && abort.abort(),
    )

    await expect(
      client.structured({ ...request, signal: abort.signal }),
    ).rejects.toBeInstanceOf(LlmAbortedError)
  })

  it('refuses to run without an endpoint and key', async () => {
    const client = new LlmClient(config({ LLM_API_KEY: undefined }))

    expect(client.configured).toBe(false)
    await expect(client.structured(request)).rejects.toBeInstanceOf(
      LlmNotConfiguredError,
    )
  })
})
