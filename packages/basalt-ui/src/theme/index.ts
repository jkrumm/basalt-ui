/**
 * Basalt Mantine theme.
 *
 * Grounded in argo `apps/dashboard/src/theme.ts`: a `createTheme` base reskinned to the
 * Blueprint palette so the Mantine chrome shares the charts' identity, plus a
 * `cssVariablesResolver` that binds Mantine's surface system to the same `--vx-*` variables
 * the charts use, so chrome and charts draw from one scheme-reactive identity.
 *
 * Every Mantine accent (red/teal/yellow/…) is overridden with a Blueprint family, so existing
 * `color="teal"`-style props become on-palette with zero call-site changes.
 *
 * theme.ts is allowed to import the pure palette DATA from `../tokens` — the Mantine-free
 * boundary applies to `src/charts/**` and `src/tokens/**`, not to this `./` root layer. The
 * resolver's hex fallbacks are GENERATED from the same `SURFACE` / `NEUTRAL` pairs the token
 * layer emits, so there is no hand-duplicated hex to drift.
 */
import {
  Card,
  createTheme,
  type CSSVariablesResolver,
  Input,
  type MantineColorsTuple,
  type MantineThemeOverride,
  mergeThemeOverrides,
  NumberInput,
  Paper,
  PasswordInput,
  Select,
  Textarea,
  TextInput,
} from '@mantine/core'
import { BP, NEUTRAL, SURFACE } from '../tokens'

// Blueprint families are 5 stops dark→light. Expand to a 10-shade Mantine tuple (light→dark).
function hexToRgb(h: string): [number, number, number] {
  const n = Number.parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a)
  const B = hexToRgb(b)
  const c = A.map((v, i) => Math.round(v + (B[i]! - v) * t))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
function ramp10(stops: readonly string[]): MantineColorsTuple {
  const lite = stops.toReversed() // light→dark
  const out: string[] = []
  for (let i = 0; i < 10; i++) {
    const pos = (i / 9) * (lite.length - 1)
    const lo = Math.floor(pos)
    const hi = Math.min(lo + 1, lite.length - 1)
    out.push(mix(lite[lo]!, lite[hi]!, pos - lo))
  }
  out[0] = mix(out[0]!, '#ffffff', 0.5) // extra-light tint for light-variant backgrounds
  return out as unknown as MantineColorsTuple
}

// Blueprint neutral ramp at the indices Mantine reads:
// text=dark[0], dimmed=dark[2], border=dark[4], hover=dark[5], surface=dark[6], body=dark[7].
const bpDark: MantineColorsTuple = [
  '#c5cbd3',
  '#abb3bf',
  '#8f99a8',
  '#738091',
  '#383e47',
  '#2f343c',
  '#252a31',
  '#1c2127',
  '#181c22',
  '#111418',
]

/**
 * Basalt base theme — Mantine `createTheme` reskinned to Blueprint.
 *
 * Inputs default to `md` (16px font) so iOS Safari never zooms the viewport on focus. The base
 * `Input` default does not cascade to TextInput/Select/etc. (each component resolves its own
 * `size` and passes it down), so every input is set explicitly. The shipped `styles.css` safety
 * net covers anything not listed here.
 */
export const baseTheme: MantineThemeOverride = createTheme({
  primaryColor: 'blue',
  primaryShade: { light: 6, dark: 4 }, // deeper on light, lighter on dark (no glow)
  autoContrast: true,
  luminanceThreshold: 0.45,
  white: '#ffffff',
  black: '#111418',
  // Tight, precise radii (Linear/Carbon). v9's default is `md` (8px); Basalt pins `sm` (4px) for
  // buttons/inputs/badges and bumps cards to `md` (8px).
  defaultRadius: 'sm',
  // Numbers render mono+tabular — keeps metric columns aligned.
  fontFamilyMonospace: "ui-monospace, 'SF Mono', Menlo, monospace",
  // Named weight ladder (v9 fontWeights).
  fontWeights: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  // Deliberate, OWNED spacing + radius scales — the single edit point, not inherited Mantine
  // defaults. Values match Mantine v9 today (a zero-pixel ownership step). 10 12 16 20 32.
  spacing: { xs: '0.625rem', sm: '0.75rem', md: '1rem', lg: '1.25rem', xl: '2rem' },
  // 2 4 8 16 32
  radius: { xs: '0.125rem', sm: '0.25rem', md: '0.5rem', lg: '1rem', xl: '2rem' },
  colors: {
    dark: bpDark,
    gray: ramp10(BP.gray),
    blue: ramp10(BP.blue),
    cyan: ramp10(BP.cerulean),
    teal: ramp10(BP.turquoise),
    green: ramp10(BP.forest),
    lime: ramp10(BP.lime),
    yellow: ramp10(BP.gold),
    orange: ramp10(BP.orange),
    red: ramp10(BP.red),
    pink: ramp10(BP.rose),
    grape: ramp10(BP.violet),
    violet: ramp10(BP.violet),
    indigo: ramp10(BP.indigo),
  },
  components: {
    // Depth = surface change + 1px hairline, never a drop shadow. Cards sit at md (8px) while
    // controls stay tight at sm (4px). The hairline is --vx-surface-border.
    Card: Card.extend({ defaultProps: { withBorder: true, radius: 'md' } }),
    Paper: Paper.extend({ defaultProps: { withBorder: true } }),
    Input: Input.extend({ defaultProps: { size: 'md' } }),
    TextInput: TextInput.extend({ defaultProps: { size: 'md' } }),
    NumberInput: NumberInput.extend({ defaultProps: { size: 'md' } }),
    PasswordInput: PasswordInput.extend({ defaultProps: { size: 'md' } }),
    Select: Select.extend({ defaultProps: { size: 'md' } }),
    Textarea: Textarea.extend({ defaultProps: { size: 'md' } }),
    // Keyed by name (not `DatePickerInput.extend`) so the framework never statically imports
    // `@mantine/dates` — it stays an OPTIONAL peer. Mantine applies these defaults only if the
    // consumer actually installs/renders the component; otherwise the entry is inert.
    DatePickerInput: { defaultProps: { size: 'md' } },
  },
})

/**
 * Bind Mantine's surface system to the SAME `--vx-*` variables the charts use, so chrome and
 * charts draw from one set of scheme-reactive surfaces.
 *
 * These bindings MUST live in the `light`/`dark` blocks, not the scheme-independent `variables`
 * block: Mantine declares the surface vars under the `[data-mantine-color-scheme]` selector, which
 * outranks a `:root` rule — so a `variables` binding loses to Mantine's per-scheme default. The
 * light/dark blocks are injected under the same scheme selector, at matching specificity, after.
 * (The `--vx-*` refs are themselves scheme-resolved; the per-scheme hex fallbacks guard a brief
 * window before the palette CSS injects.) Primary text (`--mantine-color-text`) is intentionally
 * left to Mantine: `--vx-line` is a mid-grey chart stroke, too weak for body copy.
 *
 * The hex fallbacks are generated from the `SURFACE` / `NEUTRAL` palette pairs (not hand-typed),
 * so they cannot drift from the values the token layer emits for the same `--vx-*` names.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': `var(--vx-surface-bg, ${SURFACE.bg.light})`, // page background
    '--mantine-color-default': `var(--vx-surface-panel, ${SURFACE.panel.light})`, // cards / default controls
    '--mantine-color-default-hover': `var(--vx-surface-elevated, ${SURFACE.elevated.light})`,
    '--mantine-color-default-border': `var(--vx-surface-border, ${SURFACE.border.light})`, // the hairline
    '--mantine-color-dimmed': `var(--vx-neutral, ${NEUTRAL.neutral.light})`, // secondary / muted text
  },
  dark: {
    '--mantine-color-body': `var(--vx-surface-bg, ${SURFACE.bg.dark})`,
    '--mantine-color-default': `var(--vx-surface-panel, ${SURFACE.panel.dark})`,
    '--mantine-color-default-hover': `var(--vx-surface-elevated, ${SURFACE.elevated.dark})`,
    '--mantine-color-default-border': `var(--vx-surface-border, ${SURFACE.border.dark})`,
    '--mantine-color-dimmed': `var(--vx-neutral, ${NEUTRAL.neutral.dark})`,
  },
})

/**
 * Build the Basalt theme, optionally merged with consumer overrides. Overrides win on conflict
 * (Mantine `mergeThemeOverrides` is last-wins), so a consumer can retune any field without
 * forking the base.
 */
export function createBasaltTheme(overrides?: MantineThemeOverride): MantineThemeOverride {
  return overrides ? mergeThemeOverrides(baseTheme, overrides) : baseTheme
}
