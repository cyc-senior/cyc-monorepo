import { DesignIssue } from '../design/document/check-design'
import { GeneratedDesign } from '../design/document/design-document'
import { describeKit, UiKit } from '../design/document/ui-kits'
import { LlmMessage } from './llm.client'

/** The inputs a job generates from (stored on the job as `inputSnapshot`). */
export interface GenerationInput {
  project: { name: string; description: string | null }
  design: {
    designIntent: string
    uiLibrary: string
    targetPersona: unknown
    designGuidelines: unknown
    brandIdentity: unknown
    toneOfVoice: unknown
    designTokens: unknown
    designVersion: number
  }
  stories: Array<{
    id: string
    title: string
    description: string | null
    acceptanceCriteria: string | null
    problemStatement: string | null
  }>
  prompt: string | null
}

export function systemPrompt(kit: UiKit): string {
  return `You are a senior product designer. You design UI screens as a Figma-like JSON document (never code) that a developer will build with ${kit.name}.

Document rules:
- Output only the JSON object required by the schema: name, lang (BCP 47, e.g. "en"), description (your rationale: how the design serves the intent), screens.
- Each screen is a top-level FRAME whose name is a descriptive page title (e.g. "Checkout – Payment"), with a solid background fill and auto layout (layoutMode, itemSpacing, padding*). Typical width: 390 (mobile) or 1440 (desktop).
- FRAME groups and lays out children. TEXT holds copy (characters + style). RECTANGLE is a shape or image placeholder (IMAGE fill with imageDescription).
- Every interactive or form element must be an INSTANCE of a ${kit.name} component below, configured only through its componentProperties. Never draw buttons or inputs with frames, never invent components or props.
- Fonts: ${kit.fonts.join(', ')}. Icons: ${kit.iconSet} names.
- Colors are hex. Default page background ${kit.theme.background}, default text ${kit.theme.foreground}, secondary text ${kit.theme.mutedForeground}.

${kit.name} components (* = required prop):
${describeKit(kit)}

Accessibility: the design must meet WCAG 2.0 level AA.
- 1.4.3 Contrast: text needs at least 4.5:1 against what it sits on (3:1 for text ≥ 24px, or ≥ 18.66px bold). Check component text too: e.g. a ghost/text/outlined button or a field label is drawn on its parent's background. Never put text directly on an image.
- 1.1.1 Text alternatives: images need a11y.label (or a11y.decorative: true); icons need a label prop or a11y.decorative; avatars need alt.
- 1.3.1 / 3.3.2 Labels and structure: every form control has a visible label prop. Every screen has exactly one level-1 heading: a TEXT with a11y { role: "heading", headingLevel: 1 }; section titles are level 2, then 3, never skipping a level.
- 2.4.2 Each screen name is a meaningful title. 2.4.4 Button and link labels say what they do (no "click here").
- 4.1.2 Every control has an accessible name.`
}

export function userPrompt(
  input: GenerationInput,
  variant: { index: number; total: number; previous: GeneratedDesign[] },
): string {
  const json = (value: unknown) =>
    value && typeof value === 'object' && Object.keys(value).length > 0
      ? JSON.stringify(value)
      : undefined
  const { design } = input
  const lines = [
    `Project: ${input.project.name}${input.project.description ? ` — ${input.project.description}` : ''}`,
    `Design intent: ${design.designIntent}`,
    json(design.targetPersona) &&
      `Target persona: ${json(design.targetPersona)}`,
    json(design.designGuidelines) &&
      `Design guidelines: ${json(design.designGuidelines)}`,
    json(design.brandIdentity) &&
      `Brand identity: ${json(design.brandIdentity)}`,
    json(design.toneOfVoice) && `Tone of voice: ${json(design.toneOfVoice)}`,
    json(design.designTokens) &&
      `Design tokens (use these colors/spacing where they keep contrast): ${json(design.designTokens)}`,
  ]
  if (input.stories.length > 0) {
    lines.push('User stories to satisfy:')
    for (const story of input.stories) {
      lines.push(
        `- ${story.title}${story.problemStatement ? ` | problem: ${story.problemStatement}` : ''}${story.acceptanceCriteria ? ` | acceptance: ${story.acceptanceCriteria}` : ''}`,
      )
    }
  }
  if (input.prompt) {
    lines.push(`Request: ${input.prompt}`)
  }
  lines.push(`This is design alternative ${variant.index} of ${variant.total}.`)
  if (variant.previous.length > 0) {
    lines.push(
      'Make it a clearly different approach (layout, flow or emphasis) from the alternatives already made:',
      ...variant.previous.map((p) => `- ${p.name}: ${p.description}`),
    )
  }

  return lines.filter(Boolean).join('\n')
}

const RULE_NAMES: Record<DesignIssue['rule'], string> = {
  structure: 'Schema',
  'ui-kit': 'UI kit',
  wcag: 'WCAG',
}

/** Asks for a corrected design, listing what failed. */
export function repairPrompt(issues: DesignIssue[]): string {
  const listed = issues.slice(0, 25).map((issue) => {
    const where = issue.nodeId ? `[node ${issue.nodeId}] ` : ''
    const what = issue.criterion
      ? `WCAG ${issue.criterion}`
      : RULE_NAMES[issue.rule]

    return `- ${where}${what}: ${issue.message}`
  })

  return [
    'The design above fails these checks. Return the complete corrected design JSON, keeping everything else as it is:',
    ...listed,
    issues.length > 25
      ? `- …and ${issues.length - 25} more of the same kinds.`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function asConversation(
  kit: UiKit,
  input: GenerationInput,
  variant: { index: number; total: number; previous: GeneratedDesign[] },
): LlmMessage[] {
  return [
    { role: 'system', content: systemPrompt(kit) },
    { role: 'user', content: userPrompt(input, variant) },
  ]
}
