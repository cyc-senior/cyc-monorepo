import { UserStory } from '../../generated/prisma/client'
import { LlmClient } from './llm.client'
import { parseDraftPrompt, PromptDrafter } from './prompt-drafter'

type StructuredOptions = Parameters<LlmClient['structured']>[0]

describe('parseDraftPrompt', () => {
  const answer = {
    goal: 'Pay in two taps',
    problem: 'Checkout takes too long',
    mustUse: 'shadcn, WCAG 2.2 AA',
    comparisonQuestion: 'Which one is faster to pay with?',
    variantA: { name: 'Direct', description: 'Everything on one page' },
    variantB: { name: 'Guided', description: 'One step at a time' },
  }

  it('returns a valid answer, trimmed', () => {
    const parsed = parseDraftPrompt(
      JSON.stringify({ ...answer, goal: '  Pay in two taps ' }),
      'stop',
    )
    expect(parsed.goal).toBe('Pay in two taps')
    expect(parsed.variantB.name).toBe('Guided')
  })

  it('rejects an answer that was cut off', () => {
    expect(() => parseDraftPrompt('{"goal":"Pa', 'length')).toThrow('cut off')
  })

  it('rejects an answer that is not JSON', () => {
    expect(() => parseDraftPrompt('Sure! Here is', 'stop')).toThrow(
      'valid prompt',
    )
  })

  it('rejects an answer with a missing or blank field', () => {
    expect(() =>
      parseDraftPrompt(JSON.stringify({ ...answer, goal: ' ' }), 'stop'),
    ).toThrow('goal')
    const withoutB: Partial<typeof answer> = { ...answer }
    delete withoutB.variantB
    expect(() => parseDraftPrompt(JSON.stringify(withoutB), 'stop')).toThrow(
      'variantB',
    )
  })
})

describe('PromptDrafter', () => {
  const answer = {
    goal: 'Pay in two taps',
    problem: 'Checkout takes too long',
    mustUse: 'shadcn, WCAG 2.2 AA',
    comparisonQuestion: 'Which one is faster to pay with?',
    variantA: { name: 'Direct', description: 'Everything on one page' },
    variantB: { name: 'Guided', description: 'One step at a time' },
  }
  const story = {
    title: 'Pay with a saved card',
    description: null,
    problemStatement: null,
    acceptanceCriteria: null,
  } as unknown as UserStory

  it('drafts with the analysis model, grounded in story defaults', async () => {
    const llm = {
      configured: true,
      analysisModel: 'analysis-model',
      structured: jest.fn(async (options: StructuredOptions) => {
        options.onThoughtDelta?.('Plan', 'Plan')
        return {
          content: JSON.stringify(answer),
          finishReason: 'stop',
          usage: { promptTokens: 1, completionTokens: 1 },
        }
      }),
    }
    const onThought = jest.fn()
    const drafter = new PromptDrafter(llm as unknown as LlmClient)

    await expect(
      drafter.draft({ story, intent: null, persona: null }, { onThought }),
    ).resolves.toEqual(answer)

    const options = llm.structured.mock.calls[0][0]
    expect(options.model).toBe('analysis-model')
    const user = JSON.parse(options.messages[1].content as string) as {
      defaults: { goal: string; mustUse: string }
    }
    expect(user.defaults.goal).toBe('Pay with a saved card')
    expect(user.defaults.mustUse).toContain('shadcn')
    expect(onThought).toHaveBeenCalledWith('Plan')
  })
})
