import { ConfigService } from '@nestjs/config'

import { EnvironmentVariables } from '../../config/env.validation'
import { GeneratedDesign } from '../design/document/design-document'
import { UI_KITS } from '../design/document/ui-kits'
import { DesignGenerator } from './design-generator.service'
import { GenerationInput } from './design-prompts'
import { LlmClient, LlmMessage } from './llm.client'

const input: GenerationInput = {
  project: { name: 'Checkout', description: null },
  design: {
    designIntent: 'Pay in one tap',
    uiLibrary: 'SHADCN',
    targetPersona: {},
    designGuidelines: {},
    brandIdentity: {},
    toneOfVoice: {},
    designTokens: {},
    designVersion: 1,
  },
  stories: [],
  prompt: null,
}

const design = (
  field: Record<string, string>,
  textColor = '#0A0A0A',
  icon?: Record<string, string>,
): GeneratedDesign => ({
  name: 'One tap',
  lang: 'en',
  description: 'Saved card first',
  screens: [
    {
      id: 'a',
      type: 'FRAME',
      name: 'Checkout – Pay',
      layoutMode: 'VERTICAL',
      fills: [{ type: 'SOLID', color: '#FFFFFF' }],
      children: [
        {
          id: 'b',
          type: 'TEXT',
          name: 'Title',
          characters: 'Pay',
          style: { fontSize: 16, fontWeight: 600 },
          fills: [{ type: 'SOLID', color: textColor }],
          a11y: { role: 'heading', headingLevel: 1 },
        },
        {
          id: 'c',
          type: 'INSTANCE',
          name: 'Email',
          componentKey: 'Input',
          componentProperties: field,
        },
        ...(icon
          ? [
              {
                id: 'd',
                type: 'INSTANCE' as const,
                name: 'Card icon',
                componentKey: 'Icon',
                componentProperties: icon,
              },
            ]
          : []),
      ],
    },
  ],
})

describe('DesignGenerator', () => {
  const structured = jest.fn()
  const llm = { structured } as unknown as LlmClient
  const config = (repairs: number) =>
    ({ get: () => repairs }) as unknown as ConfigService<
      EnvironmentVariables,
      true
    >
  const answer = (value: unknown, finishReason = 'stop') => ({
    content: typeof value === 'string' ? value : JSON.stringify(value),
    finishReason,
    usage: { promptTokens: 100, completionTokens: 50 },
  })
  const request = {
    kit: UI_KITS.SHADCN,
    input,
    index: 1,
    total: 1,
    previous: [],
  }

  beforeEach(() => structured.mockReset())

  it('constrains the model with the kit schema and accepts a passing design', async () => {
    structured.mockResolvedValue(
      answer(design({ label: 'Email', type: 'email' })),
    )

    const result = await new DesignGenerator(llm, config(2)).generate(request)

    expect(result).toMatchObject({ passed: true, attempts: 1 })
    const call = structured.mock.calls[0][0]
    expect(call.schemaName).toBe('ui_design')
    expect(JSON.stringify(call.schema)).toContain('"RadioGroup"')
    expect(call.messages[0].content).toContain('WCAG 2.0 level AA')
  })

  it('sends failing designs back with their issues until they pass', async () => {
    structured
      .mockResolvedValueOnce(
        answer(design({ label: 'Email' }, undefined, { name: 'credit-card' })),
      )
      .mockResolvedValueOnce(
        answer(
          design({ label: 'Email' }, undefined, {
            name: 'credit-card',
            label: 'Card',
          }),
        ),
      )

    const result = await new DesignGenerator(llm, config(2)).generate(request)

    expect(result).toMatchObject({ passed: true, attempts: 2 })
    const repair: LlmMessage[] = structured.mock.calls[1][0].messages
    expect(repair.map((m) => m.role)).toEqual([
      'system',
      'user',
      'assistant',
      'user',
    ])
    expect(repair[3].content).toContain('[node 1:3] WCAG 1.1.1')
    expect(result.usage).toEqual({ promptTokens: 200, completionTokens: 100 })
  })

  it('fixes leftover text contrast itself after the repairs', async () => {
    structured.mockResolvedValue(answer(design({ label: 'Email' }, '#C0C0C0')))

    const result = await new DesignGenerator(llm, config(1)).generate(request)

    expect(structured).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({
      passed: true,
      autoFixed: ['1:1: text color set to #0A0A0A (1.4.3)'],
    })
  })

  it('gives up on a design that cannot pass', async () => {
    structured.mockResolvedValue(
      answer(design({ label: 'Email' }, undefined, { name: 'credit-card' })),
    )

    const result = await new DesignGenerator(llm, config(1)).generate(request)

    expect(result).toMatchObject({ passed: false, attempts: 2 })
    expect('issues' in result && result.issues[0].criterion).toBe('1.1.1')
  })

  it('treats a component without its required props as invalid output', async () => {
    structured
      .mockResolvedValueOnce(answer(design({ type: 'email' })))
      .mockResolvedValueOnce(answer(design({ label: 'Email' })))

    const result = await new DesignGenerator(llm, config(2)).generate(request)

    expect(result).toMatchObject({ passed: true, attempts: 2 })
  })

  it('asks again from scratch after a cut-off or invalid answer', async () => {
    structured
      .mockResolvedValueOnce(answer('{"name": "x"', 'length'))
      .mockResolvedValueOnce(answer(design({ label: 'Email' })))

    const result = await new DesignGenerator(llm, config(2)).generate(request)

    expect(result.passed).toBe(true)
    expect(structured.mock.calls[1][0].messages).toHaveLength(2)
  })
})
