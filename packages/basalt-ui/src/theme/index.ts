/**
 * Basalt Mantine theme.
 *
 * Grounded in argo `apps/dashboard/src/theme.ts`: a `createTheme` base reskinned to the
 * Basalt warm-neutral palette so the Mantine chrome shares the charts' identity, plus a
 * `cssVariablesResolver` that binds Mantine's surface system to the same `--vx-*` variables
 * the charts use, so chrome and charts draw from one scheme-reactive identity.
 *
 * Every Mantine accent (red/teal/yellow/…) is overridden with a Basalt family, so existing
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
  defaultVariantColorsResolver,
  Input,
  mergeThemeOverrides,
  NavLink,
  NumberInput,
  Paper,
  PasswordInput,
  Select,
  Textarea,
  TextInput,
} from '@mantine/core'
import type {
  CSSVariablesResolver,
  MantineColorsTuple,
  MantineThemeOverride,
  VariantColorsResolver,
} from '@mantine/core'
import { BP, NEUTRAL, SURFACE } from '../tokens'
import navLinkClasses from './nav-link.module.css'

// Basalt families are 5 stops dark→light. Expand to a 10-shade Mantine tuple (light→dark).
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

// Basalt warm-neutral charcoal ramp at the indices Mantine reads:
// text=dark[0], dimmed=dark[2], border=dark[4], hover=dark[5], surface=dark[6], body=dark[7].
const basaltDark: MantineColorsTuple = [
  '#e9e7e2', // text — warm off-white
  '#cac4bb',
  '#9b958d', // dimmed
  '#847f78',
  '#3d3c39', // border
  '#33322f', // hover
  '#1f1f1d', // surface (panel)
  '#191917', // body (page bg)
  '#161614',
  '#121110',
]

/**
 * Keep the `light` variant legible in BOTH schemes — the enforcement seam for badges/controls.
 *
 * Mantine resolves the light-variant BACKGROUND to `--mantine-color-{c}-1`. Basalt's `ramp10`
 * only lightens shade 0, so shade 1 stays a fully saturated mid-tone — i.e. the light background
 * renders VIVID, not a faint tint, and the colored text can't sit on it (green measured 2.91:1 in
 * light mode; dark mode was fine at ~9:1 because Mantine uses a proper dark tint there). The text
 * was never the problem, so white text wouldn't help — it'd be invisible on the tint.
 *
 * Fix: rebuild the light background as a faint mix of the variant's OWN text color
 * (`--mantine-color-{c}-light-color`, which is itself scheme-reactive — dark ink in light mode,
 * light ink in dark mode). A 12% mix of that ink over the surface is therefore a pale tint under
 * dark text on light, and a dim tint under light text on dark: one expression, identical logic
 * both ways, always high-contrast. `filled` (autoContrast) / `outline` / `subtle` keep Mantine's
 * defaults. Only plain theme-palette color names are remapped; hex / indexed colors fall through.
 */
const basaltVariantColorResolver: VariantColorsResolver = (input) => {
  const resolved = defaultVariantColorsResolver(input)
  const colorName = input.color ?? input.theme.primaryColor
  const isThemeColor = Object.prototype.hasOwnProperty.call(input.theme.colors, colorName)
  if (input.variant !== 'light' || !isThemeColor) return resolved
  const ink = `var(--mantine-color-${colorName}-light-color)`
  // 10% keeps the worst-case (forest green, whose ink isn't very dark) comfortably past AA 4.5
  // while staying a clearly visible tint for the darker accents.
  return {
    ...resolved,
    background: `color-mix(in srgb, ${ink} 10%, transparent)`,
    hover: `color-mix(in srgb, ${ink} 20%, transparent)`,
    color: ink,
    border: 'none',
  }
}

/**
 * Basalt base theme — Mantine `createTheme` reskinned to the Basalt warm-neutral palette.
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
  // Force the `light` variant to a faint, AA-legible tint in both schemes (see resolver above).
  variantColorResolver: basaltVariantColorResolver,
  white: '#ffffff',
  black: '#121110',
  // Tight, precise radii (Linear/Carbon). v9's default is `md` (8px); Basalt pins `sm` (4px) for
  // buttons/inputs/badges and bumps cards to `md` (8px).
  defaultRadius: 'sm',
  // Numbers render mono+tabular — keeps metric columns aligned.
  fontFamilyMonospace: "ui-monospace, 'SF Mono', Menlo, monospace",
  // Named weight ladder (v9 fontWeights).
  fontWeights: { regular: '400', medium: '500', semibold: '600', bold: '700' },
  // Deliberate, OWNED spacing + radius scales — the single edit point, not inherited Mantine
  // defaults. Values match Mantine v9 today (a zero-pixel ownership step). 10 12 16 20 32.
  spacing: { xs: '0.625rem', sm: '0.75rem', md: '1rem', lg: '1.25rem', xl: '2rem' },
  // 2 4 8 16 32. NOTE: `md` (0.5rem = 8px) deliberately MIRRORS the Mantine-free `--vx-radius-card`
  // (8px) so a Mantine card and a charts `ChartCard` share one corner radius — keep them in lockstep
  // (the token is the authoritative 8px; this scale is the rem mirror). See tokens `VX.radiusCard`.
  radius: { xs: '0.125rem', sm: '0.25rem', md: '0.5rem', lg: '1rem', xl: '2rem' },
  colors: {
    dark: basaltDark,
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
    // ONE card identity, enforced at the theme so NO component can diverge. Every card-like
    // surface — Mantine `Card`, a bare `Paper` used as a card, and the Mantine-free `ChartCard` —
    // resolves to the SAME three tokens:
    //   • background → `--vx-surface-panel` (the white/elevated panel, NOT the page body). Mantine
    //     defaults Paper/Card bg to `--mantine-color-body` (the page bg `--vx-surface-bg`), which
    //     would make a card blend into the page and read as a bare outlined box — so we force the
    //     panel surface here.
    //   • border    → `--vx-surface-border` (via `withBorder` → `--mantine-color-default-border`).
    //   • radius    → `md` (8px) = `--vx-radius-card`.
    // This is the single source the user's "strict border + background across components" demands;
    // the `raw-surface` guard then stops consumers re-overriding any of it inline.
    Card: Card.extend({
      defaultProps: { withBorder: true, radius: 'md' },
      styles: { root: { backgroundColor: 'var(--vx-surface-panel)' } },
    }),
    Paper: Paper.extend({
      defaultProps: { withBorder: true, radius: 'md' },
      styles: { root: { backgroundColor: 'var(--vx-surface-panel)' } },
    }),
    // "Ink earns its color" — a nav selection is UI state, not the identity accent. The active
    // item is a QUIET neutral surface fill (scheme-adaptive color-mix of --vx-neutral), never the
    // blue. Forced here at the THEME level (via NavLink's --nl-* vars) so it holds for every render
    // path — including a consumer's router `<Link>` via `renderNavLink`, which never sees the shell
    // CSS module. This is what keeps "blue active nav everywhere" from ever coming back.
    NavLink: NavLink.extend({
      vars: () => ({
        root: {
          '--nl-bg': 'color-mix(in srgb, var(--vx-neutral) 13%, transparent)',
          '--nl-color': 'var(--mantine-color-text)',
          '--nl-hover': 'color-mix(in srgb, var(--vx-neutral) 8%, transparent)',
          '--nl-padding': '2px 8px',
        },
        children: {},
      }),
      // Dense, rounded nav rows — applied at the THEME level so they survive EVERY render path,
      // including a consumer's router `<Link>` via `renderNavLink`, which never sees the shell CSS
      // module (the module's `.link` only reaches the shell's own fallback `<NavLink>`). Same
      // reasoning as the `--nl-*` fill above: layout is single-sourced here, not in two places.
      // The active-weight state selector can't live in `styles` (flat inline props only) — it's in
      // nav-link.module.css, wired via `classNames` so it reaches the same every-render-path scope.
      classNames: { root: navLinkClasses.root },
      styles: {
        root: {
          minHeight: 24,
          borderRadius: '6px',
        },
      },
    }),
    Input: Input.extend({ defaultProps: { size: 'md' } }),
    TextInput: TextInput.extend({ defaultProps: { size: 'md' } }),
    NumberInput: NumberInput.extend({ defaultProps: { size: 'md' } }),
    PasswordInput: PasswordInput.extend({ defaultProps: { size: 'md' } }),
    Select: Select.extend({ defaultProps: { size: 'md' } }),
    Textarea: Textarea.extend({ defaultProps: { size: 'md' } }),
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
    '--app-shell-border-color': `var(--vx-surface-border, ${SURFACE.border.light})`,
    // THE strict-surface lever. Mantine components do NOT chain border/surface colors through
    // `--mantine-color-default-*`; each hardcodes a RAW ramp step (`--mantine-color-gray-{2,3,4}`
    // on light) directly — which is why AppShell/Table/Input/Divider/Tabs/Popover/Accordion borders
    // render an off-system `#aba59c` while cards use the hairline. Collapse the border-class ramp
    // steps onto the ONE hairline token so EVERY component's border is identical and the agent
    // cannot reintroduce a divergent border. (Hover/subtle BG steps are handled below.)
    '--mantine-color-gray-2': `var(--vx-surface-border, ${SURFACE.border.light})`,
    '--mantine-color-gray-3': `var(--vx-surface-border, ${SURFACE.border.light})`,
    '--mantine-color-gray-4': `var(--vx-surface-border, ${SURFACE.border.light})`,
    // Hover/subtle/striped/track surfaces read `gray-0/1` raw → the dedicated subtle token (a faint
    // step below white, so hover is actually visible on white panels). Dark hover uses the
    // `basaltDark` dark-5/6/7 steps, already on-identity.
    '--mantine-color-gray-0': `var(--vx-surface-subtle, ${SURFACE.subtle.light})`,
    '--mantine-color-gray-1': `var(--vx-surface-subtle, ${SURFACE.subtle.light})`,
  },
  dark: {
    '--mantine-color-body': `var(--vx-surface-bg, ${SURFACE.bg.dark})`,
    '--mantine-color-default': `var(--vx-surface-panel, ${SURFACE.panel.dark})`,
    '--mantine-color-default-hover': `var(--vx-surface-elevated, ${SURFACE.elevated.dark})`,
    '--mantine-color-default-border': `var(--vx-surface-border, ${SURFACE.border.dark})`,
    '--mantine-color-dimmed': `var(--vx-neutral, ${NEUTRAL.neutral.dark})`,
    '--app-shell-border-color': `var(--vx-surface-border, ${SURFACE.border.dark})`,
    // Dark components read `--mantine-color-dark-4` (border) raw. The `basaltDark` tuple already
    // sets dark-4, but to a slightly lighter step than the hairline token, so layout borders read
    // marginally heavier than card borders. Pin dark-4 to the SAME hairline token for parity.
    '--mantine-color-dark-4': `var(--vx-surface-border, ${SURFACE.border.dark})`,
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
