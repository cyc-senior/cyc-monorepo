import { UiLibrary } from '../../../generated/prisma/client'

export type PropSpec =
  | { kind: 'enum'; values: readonly string[]; default: string }
  | { kind: 'text'; max: number }
  | { kind: 'boolean' }
  | { kind: 'number'; min: number; max: number }
  | { kind: 'list'; max: number }

export type PropValue = string | number | boolean | string[]

/** Colors a component paints its own text with; `'parent'` = on the parent's background. */
export interface TextColors {
  fg: string
  bg: string | 'parent'
}

export interface KitComponent {
  description: string
  props: Record<string, PropSpec>
  required: readonly string[]
  /** Prop holding the accessible name (WCAG 4.1.2 / 1.1.1 / 1.3.1). */
  nameProp?: string
  /** A form control: its name is also its visible label (WCAG 1.3.1, 3.3.2). */
  formControl?: boolean
  /** Non-text content: needs a text alternative unless marked decorative (1.1.1). */
  nonText?: boolean
  /** May contain child nodes, drawn on this surface. */
  container?: { surface: string; foreground: string }
  /** The text colors the kit renders for these props, if it renders text. */
  textColors?: (props: Record<string, PropValue>) => TextColors | undefined
}

export interface UiKit {
  library: UiLibrary
  name: string
  fonts: readonly string[]
  iconSet: string
  /** Page background and default text color of the kit's light theme. */
  theme: { background: string; foreground: string; mutedForeground: string }
  components: Record<string, KitComponent>
}

const text = (max = 120): PropSpec => ({ kind: 'text', max })
const bool: PropSpec = { kind: 'boolean' }
const list = (max = 12): PropSpec => ({ kind: 'list', max })
const oneOf = (values: readonly string[], fallback = values[0]): PropSpec => ({
  kind: 'enum',
  values,
  default: fallback,
})
const INPUT_TYPES = [
  'text',
  'email',
  'password',
  'number',
  'search',
  'tel',
  'url',
  'date',
] as const
const pick = <T>(
  table: Record<string, T>,
  key: PropValue | undefined,
  fallback: string,
) => table[typeof key === 'string' && key in table ? key : fallback]

// --- shadcn/ui (new-york, neutral, light) ------------------------------------
const SHADCN = {
  background: '#FFFFFF',
  foreground: '#0A0A0A',
  primary: '#171717',
  primaryForeground: '#FAFAFA',
  secondary: '#F5F5F5',
  muted: '#F5F5F5',
  mutedForeground: '#737373',
  destructive: '#E7000B',
}
const shadcnLabel = (): TextColors => ({ fg: SHADCN.foreground, bg: 'parent' })

const shadcn: UiKit = {
  library: 'SHADCN',
  name: 'shadcn/ui',
  fonts: ['Geist', 'Inter', 'system-ui'],
  iconSet: 'lucide',
  theme: {
    background: SHADCN.background,
    foreground: SHADCN.foreground,
    mutedForeground: SHADCN.mutedForeground,
  },
  components: {
    Button: {
      description:
        'Action. `size: icon` shows only `icon`; `label` is then its accessible name.',
      props: {
        variant: oneOf([
          'default',
          'secondary',
          'destructive',
          'outline',
          'ghost',
          'link',
        ]),
        size: oneOf(['default', 'sm', 'lg', 'icon']),
        label: text(60),
        icon: text(40),
        disabled: bool,
      },
      required: ['label'],
      nameProp: 'label',
      textColors: (p) =>
        pick<TextColors>(
          {
            default: { fg: SHADCN.primaryForeground, bg: SHADCN.primary },
            secondary: { fg: SHADCN.primary, bg: SHADCN.secondary },
            destructive: { fg: '#FFFFFF', bg: SHADCN.destructive },
            outline: { fg: SHADCN.foreground, bg: SHADCN.background },
            ghost: { fg: SHADCN.foreground, bg: 'parent' },
            link: { fg: SHADCN.primary, bg: 'parent' },
          },
          p.variant,
          'default',
        ),
    },
    Input: {
      description: 'Single-line text field with a visible label.',
      props: {
        type: oneOf(INPUT_TYPES),
        label: text(80),
        placeholder: text(80),
        helperText: text(160),
        required: bool,
        disabled: bool,
      },
      required: ['label'],
      nameProp: 'label',
      formControl: true,
      textColors: shadcnLabel,
    },
    Textarea: {
      description: 'Multi-line text field with a visible label.',
      props: {
        label: text(80),
        placeholder: text(80),
        helperText: text(160),
        required: bool,
      },
      required: ['label'],
      nameProp: 'label',
      formControl: true,
      textColors: shadcnLabel,
    },
    Select: {
      description: 'Dropdown with a visible label.',
      props: {
        label: text(80),
        placeholder: text(80),
        options: list(),
        required: bool,
      },
      required: ['label', 'options'],
      nameProp: 'label',
      formControl: true,
      textColors: shadcnLabel,
    },
    Checkbox: {
      description: 'Checkbox with its label.',
      props: { label: text(120), checked: bool, disabled: bool },
      required: ['label'],
      nameProp: 'label',
      formControl: true,
      textColors: shadcnLabel,
    },
    Switch: {
      description: 'On/off toggle with its label.',
      props: { label: text(120), checked: bool, disabled: bool },
      required: ['label'],
      nameProp: 'label',
      formControl: true,
      textColors: shadcnLabel,
    },
    RadioGroup: {
      description: 'Single choice; `label` is the group legend.',
      props: { label: text(80), options: list(8), value: text(80) },
      required: ['label', 'options'],
      nameProp: 'label',
      formControl: true,
      textColors: shadcnLabel,
    },
    Card: {
      description: 'Surface grouping content; put its content in `children`.',
      props: { title: text(80), description: text(200) },
      required: [],
      container: { surface: SHADCN.background, foreground: SHADCN.foreground },
      textColors: () => ({ fg: SHADCN.foreground, bg: SHADCN.background }),
    },
    Badge: {
      description: 'Short status label.',
      props: {
        variant: oneOf(['default', 'secondary', 'destructive', 'outline']),
        text: text(30),
      },
      required: ['text'],
      nameProp: 'text',
      textColors: (p) =>
        pick<TextColors>(
          {
            default: { fg: SHADCN.primaryForeground, bg: SHADCN.primary },
            secondary: { fg: SHADCN.primary, bg: SHADCN.secondary },
            destructive: { fg: '#FFFFFF', bg: SHADCN.destructive },
            outline: { fg: SHADCN.foreground, bg: 'parent' },
          },
          p.variant,
          'default',
        ),
    },
    Alert: {
      description: 'Callout message.',
      props: {
        variant: oneOf(['default', 'destructive']),
        title: text(80),
        description: text(240),
      },
      required: ['title'],
      nameProp: 'title',
      textColors: (p) => ({
        fg:
          p.variant === 'destructive' ? SHADCN.destructive : SHADCN.foreground,
        bg: SHADCN.background,
      }),
    },
    Avatar: {
      description: 'User picture; `fallback` initials show without an image.',
      props: { alt: text(80), fallback: text(3) },
      required: ['alt'],
      nameProp: 'alt',
      nonText: true,
      textColors: (p) =>
        p.fallback ? { fg: SHADCN.foreground, bg: SHADCN.muted } : undefined,
    },
    Tabs: {
      description: 'Tab list; `value` is the selected item.',
      props: { items: list(6), value: text(40) },
      required: ['items'],
      textColors: () => ({ fg: SHADCN.foreground, bg: SHADCN.muted }),
    },
    Separator: {
      description: 'Divider line (decorative).',
      props: { orientation: oneOf(['horizontal', 'vertical']) },
      required: [],
    },
    Icon: {
      description:
        'lucide icon by name. Give `label`, or mark it `a11y.decorative`.',
      props: {
        name: text(40),
        label: text(80),
        size: { kind: 'number', min: 12, max: 64 },
      },
      required: ['name'],
      nameProp: 'label',
      nonText: true,
    },
  },
}

// --- MUI (Material UI, default light theme) -----------------------------------
const MUI_TEXT = '#000000DE' // rgba(0,0,0,.87)
const MUI_TEXT_SECONDARY = '#00000099' // rgba(0,0,0,.6)
const MUI_PALETTE: Record<string, string> = {
  primary: '#1976D2',
  secondary: '#9C27B0',
  error: '#D32F2F',
  warning: '#ED6C02',
  info: '#0288D1',
  success: '#2E7D32',
}
const MUI_COLORS = Object.keys(MUI_PALETTE)
const MUI_ALERT: Record<string, { text: string; surface: string }> = {
  success: { text: '#1E4620', surface: '#EDF7ED' },
  info: { text: '#014361', surface: '#E5F6FD' },
  warning: { text: '#663C00', surface: '#FFF4E5' },
  error: { text: '#5F2120', surface: '#FDEDED' },
}
const muiColor = (value: PropValue | undefined) =>
  pick(MUI_PALETTE, value, 'primary')
const muiOnParent = (fg: string) => (): TextColors => ({ fg, bg: 'parent' })

const mui: UiKit = {
  library: 'MUI',
  name: 'Material UI',
  fonts: ['Roboto'],
  iconSet: 'Material Symbols',
  theme: {
    background: '#FFFFFF',
    foreground: MUI_TEXT,
    mutedForeground: MUI_TEXT_SECONDARY,
  },
  components: {
    Button: {
      description: 'Action.',
      props: {
        variant: oneOf(['contained', 'outlined', 'text']),
        color: oneOf(MUI_COLORS),
        size: oneOf(['medium', 'small', 'large']),
        label: text(60),
        startIcon: text(40),
        disabled: bool,
      },
      required: ['label'],
      nameProp: 'label',
      textColors: (p) =>
        (p.variant ?? 'contained') === 'contained'
          ? { fg: '#FFFFFF', bg: muiColor(p.color) }
          : { fg: muiColor(p.color), bg: 'parent' },
    },
    TextField: {
      description: 'Text field with a floating label.',
      props: {
        variant: oneOf(['outlined', 'filled', 'standard']),
        type: oneOf(INPUT_TYPES),
        label: text(80),
        placeholder: text(80),
        helperText: text(160),
        required: bool,
        multiline: bool,
        disabled: bool,
      },
      required: ['label'],
      nameProp: 'label',
      formControl: true,
      textColors: muiOnParent(MUI_TEXT_SECONDARY),
    },
    Select: {
      description: 'Dropdown with a label.',
      props: {
        variant: oneOf(['outlined', 'filled', 'standard']),
        label: text(80),
        options: list(),
        required: bool,
      },
      required: ['label', 'options'],
      nameProp: 'label',
      formControl: true,
      textColors: muiOnParent(MUI_TEXT_SECONDARY),
    },
    Checkbox: {
      description: 'Checkbox with its label (FormControlLabel).',
      props: {
        label: text(120),
        checked: bool,
        color: oneOf(MUI_COLORS),
        disabled: bool,
      },
      required: ['label'],
      nameProp: 'label',
      formControl: true,
      textColors: muiOnParent(MUI_TEXT),
    },
    Switch: {
      description: 'On/off toggle with its label.',
      props: {
        label: text(120),
        checked: bool,
        color: oneOf(MUI_COLORS),
        disabled: bool,
      },
      required: ['label'],
      nameProp: 'label',
      formControl: true,
      textColors: muiOnParent(MUI_TEXT),
    },
    RadioGroup: {
      description: 'Single choice; `label` is the group legend.',
      props: { label: text(80), options: list(8), value: text(80) },
      required: ['label', 'options'],
      nameProp: 'label',
      formControl: true,
      textColors: muiOnParent(MUI_TEXT),
    },
    Card: {
      description:
        'Paper surface grouping content; put its content in `children`.',
      props: {
        variant: oneOf(['elevation', 'outlined']),
        title: text(80),
        subheader: text(160),
      },
      required: [],
      container: { surface: '#FFFFFF', foreground: MUI_TEXT },
      textColors: () => ({ fg: MUI_TEXT, bg: '#FFFFFF' }),
    },
    AppBar: {
      description: 'Top app bar; put its content in `children`.',
      props: { color: oneOf(['primary', 'default']), title: text(60) },
      required: [],
      container: { surface: MUI_PALETTE.primary, foreground: '#FFFFFF' },
      textColors: (p) =>
        p.color === 'default'
          ? { fg: MUI_TEXT, bg: '#F5F5F5' }
          : { fg: '#FFFFFF', bg: MUI_PALETTE.primary },
    },
    Chip: {
      description: 'Compact label.',
      props: {
        label: text(30),
        color: oneOf(['default', ...MUI_COLORS]),
        variant: oneOf(['filled', 'outlined']),
      },
      required: ['label'],
      nameProp: 'label',
      textColors: (p) => {
        const color =
          p.color && p.color !== 'default' ? muiColor(p.color) : undefined
        if (p.variant === 'outlined') {
          return { fg: color ?? MUI_TEXT, bg: 'parent' }
        }

        return color
          ? { fg: '#FFFFFF', bg: color }
          : { fg: MUI_TEXT, bg: '#EBEBEB' }
      },
    },
    Alert: {
      description: 'Callout message.',
      props: {
        severity: oneOf(['info', 'success', 'warning', 'error']),
        variant: oneOf(['standard', 'filled', 'outlined']),
        title: text(80),
        description: text(240),
      },
      required: ['severity', 'description'],
      nameProp: 'description',
      textColors: (p) => {
        const severity = typeof p.severity === 'string' ? p.severity : 'info'
        const tone = MUI_ALERT[severity] ?? MUI_ALERT.info
        if (p.variant === 'filled') {
          return { fg: '#FFFFFF', bg: muiColor(severity) }
        }

        return {
          fg: tone.text,
          bg: p.variant === 'outlined' ? 'parent' : tone.surface,
        }
      },
    },
    Link: {
      description: 'Inline link; `text` says where it goes.',
      props: { text: text(80), underline: oneOf(['always', 'hover', 'none']) },
      required: ['text'],
      nameProp: 'text',
      textColors: muiOnParent(MUI_PALETTE.primary),
    },
    Tabs: {
      description: 'Tab list; `value` is the selected item.',
      props: { items: list(6), value: text(40) },
      required: ['items'],
      textColors: muiOnParent(MUI_PALETTE.primary),
    },
    Avatar: {
      description: 'User picture (a person icon without an image).',
      props: { alt: text(80) },
      required: ['alt'],
      nameProp: 'alt',
      nonText: true,
    },
    Divider: {
      description: 'Divider line (decorative).',
      props: { orientation: oneOf(['horizontal', 'vertical']) },
      required: [],
    },
    Icon: {
      description:
        'Material Symbols icon by name. Give `label`, or mark it `a11y.decorative`.',
      props: {
        name: text(40),
        label: text(80),
        size: { kind: 'number', min: 12, max: 64 },
      },
      required: ['name'],
      nameProp: 'label',
      nonText: true,
    },
  },
}

export const UI_KITS: Readonly<Record<UiLibrary, UiKit>> = {
  SHADCN: shadcn,
  MUI: mui,
}

/** Compact catalog for the LLM prompt. */
export function describeKit(kit: UiKit): string {
  const lines = Object.entries(kit.components).map(([key, component]) => {
    const props = Object.entries(component.props)
      .map(([name, spec]) => {
        const required = component.required.includes(name) ? '*' : ''
        switch (spec.kind) {
          case 'enum':
            return `${name}${required}=${spec.values.join('|')}`
          case 'list':
            return `${name}${required}: string[]`
          default:
            return `${name}${required}: ${spec.kind === 'text' ? 'string' : spec.kind}`
        }
      })
      .join(', ')
    const children = component.container ? ' (has children)' : ''

    return `- ${key}${children}: ${component.description} Props: ${props}`
  })

  return lines.join('\n')
}
