import { Platform, UiLibrary } from '../../generated/prisma/client'
import { HtmlIssue } from '../design/html/check-html'
import { LlmMessage } from './llm.client'

/** Version tag of the snapshot below; jobs with another shape are not run. */
export const GENERATION_INPUT_FORMAT = 'html-v1'

export interface PersonaInput {
  name: string
  age: number | null
  shortDescription: string
  behavioralConsiderations: string[]
  frustrations: string[]
  goals: string[]
  tasks: string[]
}

/**
 * Everything a job generates from, copied when the job is created (stored as
 * `inputSnapshot`): the project, its design intent, the user personas, the
 * user stories and the designer's prompt.
 */
export interface GenerationInput {
  format: typeof GENERATION_INPUT_FORMAT
  project: {
    name: string
    clientOrProduct: string
    description: string | null
    platforms: Platform[]
  }
  intent: {
    statement: string | null
    designSystem: UiLibrary
    designStandards: string[]
    designGuidelines: string | null
    colors: {
      primary: string | null
      secondary: string | null
      accent: string | null
    }
    brandGuidelines: string | null
    toneOfVoice: string | null
    version: number
  }
  /** Personas defined by designers (and any AI personas the designer picked). */
  personas: PersonaInput[]
  stories: Array<{
    id: string
    title: string
    description: string | null
    acceptanceCriteria: string | null
    problemStatement: string | null
  }>
  /** The designer's prompt: what to design now. */
  prompt: string
  /** Synthesize and save a persona artifact from this prompt before designing. */
  synthesizePersona: boolean
  /** Set when the job refines an existing variant. */
  baseDesign?: { variantId: string; name: string; html: string } | null
  /**
   * Designer-reviewed feedback themes the round was opened to address (never
   * raw participant text).
   */
  feedbackThemes?: Array<{
    title: string
    summary: string
    category: string
    severity: string
    designerNote: string | null
  }>
}

const DESIGN_SYSTEMS: Record<UiLibrary, string> = {
  SHADCN: `shadcn/ui look (Radix + Tailwind conventions, written as plain CSS):
- Font: "Inter", system-ui, sans-serif. Base size 14–16px, line-height 1.5.
- Neutral surfaces (white / #FAFAFA, borders #E4E4E7), 1px borders, radius 0.5rem (cards 0.75rem), subtle shadows only on overlays.
- Components: Button (default/secondary/outline/ghost/destructive, 36–40px high), Input/Select/Textarea with a visible label above, Card (header/content/footer), Badge, Tabs, Separator, Avatar, Alert, Table, Dialog/Sheet look when needed.
- Spacing on a 4px grid; generous whitespace; clear focus ring (2px outline offset 2px).`,
  MUI: `Material Design 3 / MUI look (written as plain CSS):
- Font: "Roboto", system-ui, sans-serif. Type scale: display/headline/title/body/label.
- Surfaces with elevation (soft shadows), radius 4–12px, 8px spacing grid.
- Components: contained/outlined/text Buttons (36–40px, uppercase optional), filled or outlined TextFields with floating-style labels kept visible, Cards, Chips, App bar, Navigation drawer / bottom navigation on mobile, Lists, Dialogs, Snackbars look when needed.
- Visible focus states; states for hover/active/disabled.`,
}

const PLATFORM_LAYOUT: Record<Platform, string> = {
  DESKTOP: 'desktop (design at 1440px wide, content max-width ~1200px)',
  TABLET: 'tablet (768–1024px)',
  MOBILE: 'mobile (390px wide, touch targets ≥ 44px)',
}

export function systemPrompt(designSystem: UiLibrary): string {
  return `You are a senior product designer who designs in code. You produce ONE high-fidelity, production-quality screen as a complete, self-contained HTML document that a developer and a usability tester will look at as the real product.

Output: only the JSON object required by the schema: "title" (the page title), "rationale" (how the design serves the intent, personas and request; 2–5 sentences) and "html" (the whole document).

HTML rules (the document is rendered in a sandboxed iframe without JavaScript):
- <!DOCTYPE html>, <html lang="..."> (language of the copy), <head> with <meta charset="utf-8">, <meta name="viewport" content="width=device-width, initial-scale=1">, a descriptive <title>, and ONE <style> element with all CSS.
- No JavaScript at all: no <script>, no on* attributes, no javascript: URLs. Interactive states are shown statically (e.g. a selected tab, an open menu) and with CSS :hover/:focus.
- No external resources except Google Fonts (<link rel="stylesheet" href="https://fonts.googleapis.com/...">). No external images: draw illustrations, icons and logos with inline <svg> or CSS, or use solid/gradient placeholders.
- Realistic content in the tone of voice: real-looking names, numbers and copy, never lorem ipsum.
- Responsive layout with CSS media queries for every target platform listed.
- Use CSS custom properties for the brand colors (--color-primary, --color-secondary, --color-accent) and use them.

Design system:
${DESIGN_SYSTEMS[designSystem]}

Accessibility (WCAG 2.1 AA):
- Semantic landmarks: <header>, <nav>, <main>, <footer>. Exactly one <h1>; headings in order without skipping levels.
- Every <img> has alt (alt="" if decorative); a meaningful <svg> has role="img" and aria-label; decorative svg has aria-hidden="true".
- Every input, select and textarea has a visible <label for="id">. Buttons and links have descriptive text (no "click here"); actions are <button>, navigation is <a href>.
- Text contrast at least 4.5:1 (3:1 for ≥ 24px or ≥ 18.66px bold), including text on brand-colored backgrounds: pick white or near-black text accordingly. Visible focus indicators.`
}

/** The design prompt template: every part of the project context, in a fixed order. */
export function userPrompt(
  input: GenerationInput,
  personas: PersonaInput[],
  variant: {
    index: number
    total: number
    previous: Array<{ title: string; rationale: string }>
  },
): string {
  const { project, intent } = input
  const section = (
    title: string,
    lines: Array<string | false | null | undefined>,
  ) => {
    const body = lines.filter(Boolean)

    return body.length > 0 ? [`## ${title}`, ...body, ''] : []
  }
  const colors = [
    intent.colors.primary &&
      `- Primary: ${intent.colors.primary} (main actions, key brand areas)`,
    intent.colors.secondary &&
      `- Secondary: ${intent.colors.secondary} (supporting surfaces, secondary actions)`,
    intent.colors.accent &&
      `- Accent: ${intent.colors.accent} (highlights, badges, focus)`,
  ]

  const lines = [
    ...section('Project', [
      `Name: ${project.name}`,
      `Client / product: ${project.clientOrProduct}`,
      project.description && `Description: ${project.description}`,
      `Target platforms: ${project.platforms.map((p) => PLATFORM_LAYOUT[p]).join('; ')}`,
    ]),
    ...section('Design intent', [
      intent.statement && `Goal: ${intent.statement}`,
      `Design system: ${intent.designSystem === 'MUI' ? 'Material Design / MUI' : 'shadcn/ui'}`,
      intent.designStandards.length > 0 &&
        `Standards to meet: ${intent.designStandards.join(', ')}`,
      intent.designGuidelines &&
        `Design guidelines: ${intent.designGuidelines}`,
    ]),
    ...section('Brand & corporate identity', [
      ...colors,
      intent.brandGuidelines && `Brand notes: ${intent.brandGuidelines}`,
    ]),
    ...section('Tone of voice (write all copy this way)', [intent.toneOfVoice]),
    ...section(
      'User personas (design for them)',
      personas.map((persona, i) =>
        describePersona(persona, i === 0 && input.synthesizePersona),
      ),
    ),
    ...section(
      'User stories to satisfy',
      input.stories.map(
        (story) =>
          `- ${story.title}${story.description ? `: ${story.description}` : ''}${story.problemStatement ? ` | problem: ${story.problemStatement}` : ''}${story.acceptanceCriteria ? ` | acceptance: ${story.acceptanceCriteria}` : ''}`,
      ),
    ),
    ...section(
      'Usability findings this iteration must address (reviewed by the designer)',
      (input.feedbackThemes ?? []).map(
        (theme) =>
          `- [${theme.severity} ${theme.category}] ${theme.title}: ${theme.summary}${theme.designerNote ? ` (designer note: ${theme.designerNote})` : ''}`,
      ),
    ),
    ...section(
      'Existing design to refine (keep everything the request does not change; return the full revised document)',
      [
        input.baseDesign &&
          [`"${input.baseDesign.name}":`, input.baseDesign.html].join('\n'),
      ],
    ),
    ...section('Designer request', [input.prompt]),
    ...section('Alternative', [
      `This is design alternative ${variant.index} of ${variant.total}.`,
      variant.previous.length > 0 &&
        [
          'Take a clearly different approach (layout, flow or emphasis) from the alternatives already made:',
          ...variant.previous.map((p) => `- ${p.title}: ${p.rationale}`),
        ].join('\n'),
    ]),
  ]

  return lines.join('\n').trim()
}

export function asConversation(
  input: GenerationInput,
  personas: PersonaInput[],
  variant: {
    index: number
    total: number
    previous: Array<{ title: string; rationale: string }>
  },
): LlmMessage[] {
  return [
    { role: 'system', content: systemPrompt(input.intent.designSystem) },
    { role: 'user', content: userPrompt(input, personas, variant) },
  ]
}

/** Asks for a corrected document, listing what failed. */
export function repairPrompt(issues: HtmlIssue[]): string {
  const listed = issues.slice(0, 25).map((issue) => {
    const what = issue.criterion ? `WCAG ${issue.criterion}` : issue.rule
    const where = issue.element ? ` ${issue.element}` : ''

    return `- ${what}${where}: ${issue.message}`
  })

  return [
    'The design above fails these checks. Return the same JSON object with the complete corrected HTML document, keeping everything else as it is:',
    ...listed,
    issues.length > 25
      ? `- …and ${issues.length - 25} more of the same kinds.`
      : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function describePersona(persona: PersonaInput, fromPrompt: boolean): string {
  const list = (label: string, items: string[]) =>
    items.length > 0 ? `\n  ${label}: ${items.join('; ')}` : ''

  return `- ${persona.name}${persona.age ? `, ${persona.age}` : ''}${fromPrompt ? ' (primary persona for this request)' : ''}: ${persona.shortDescription}${list('Behavior', persona.behavioralConsiderations)}${list('Frustrations', persona.frustrations)}${list('Goals', persona.goals)}${list('Tasks', persona.tasks)}`
}

// ---------------------------------------------------------------------------
// Persona artifact
// ---------------------------------------------------------------------------

const PERSONA_SYSTEM = `You are a UX researcher. From a design request and the project context, synthesize ONE user persona: the person this request is really designing for. Ground it in the context; do not invent an unrelated audience. If existing personas already cover the request, sharpen the most relevant one for this request instead of inventing a different person, but still return a complete persona.

Return only the JSON object required by the schema: name (a realistic full name), age, shortDescription (1–3 sentences), behavioralConsiderations, frustrations, goals and tasks (2–6 short items each). Write in the language of the request.`

export function personaConversation(input: GenerationInput): LlmMessage[] {
  const { project, intent } = input
  const lines = [
    `Project: ${project.name} for ${project.clientOrProduct}${project.description ? ` — ${project.description}` : ''}`,
    `Platforms: ${project.platforms.join(', ')}`,
    intent.statement && `Design intent: ${intent.statement}`,
    intent.toneOfVoice && `Tone of voice: ${intent.toneOfVoice}`,
    input.personas.length > 0 &&
      `Existing personas:\n${input.personas.map((p) => `- ${p.name}${p.age ? ` (${p.age})` : ''}: ${p.shortDescription}`).join('\n')}`,
    input.stories.length > 0 &&
      `User stories:\n${input.stories.map((s) => `- ${s.title}`).join('\n')}`,
    `Design request: ${input.prompt}`,
  ]

  return [
    { role: 'system', content: PERSONA_SYSTEM },
    { role: 'user', content: lines.filter(Boolean).join('\n') },
  ]
}
