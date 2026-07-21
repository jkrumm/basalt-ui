/**
 * Basalt Mantine theme.
 *
 * Grounded in argo `apps/dashboard/src/theme.ts`, reskinned to the 2026-07 zinc redesign
 * (`docs/DESIGN-SPEC.md`): a `createTheme` base bound to the Basalt zinc palette so the Mantine
 * chrome shares the charts' identity, plus a `cssVariablesResolver` that binds Mantine's surface
 * system to the same `--vx-*` variables the charts use, so chrome and charts draw from one
 * scheme-reactive identity.
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
  Accordion,
  ActionIcon,
  Alert,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  Checkbox,
  CheckboxCard,
  Chip,
  Code,
  Combobox,
  createTheme,
  defaultVariantColorsResolver,
  Drawer,
  getPrimaryShade,
  Indicator,
  Input,
  Kbd,
  Menu,
  mergeThemeOverrides,
  Modal,
  NavLink,
  Notification,
  NumberInput,
  Pagination,
  Paper,
  PasswordInput,
  PillsInput,
  Popover,
  Progress,
  Radio,
  RadioCard,
  rem,
  Select,
  SegmentedControl,
  Stepper,
  Switch,
  Table,
  Tabs,
  Textarea,
  TextInput,
  Timeline,
  Tooltip,
} from '@mantine/core'
import type {
  CSSVariablesResolver,
  MantineColorsTuple,
  MantineTheme,
  MantineThemeOverride,
  VariantColorsResolver,
} from '@mantine/core'
import { BP, buildPaletteData } from '../tokens/palette'
import type { PaletteData } from '../tokens/palette'
import { DEFAULT_DERIVE_CONFIG, isDefaultDeriveConfig, resolveDeriveConfig } from '../tokens/derive'
import type { DeriveConfig } from '../tokens/derive'
import { VX } from '../tokens'
import controlsClasses from './controls.module.css'
import floatingClasses from './floating.module.css'
import navLinkClasses from './nav-link.module.css'
import segmentedControlClasses from './segmented-control.module.css'
import timelineClasses from './timeline.module.css'

/**
 * The `fonts` option's resolved shape — a full CSS font-family stack string per slot (with its own
 * fallback chain), riding the same `--basalt-font-sans/head/mono` override seam `styles.css` already
 * ships fallbacks for. Omitted keys keep the shipped fallback untouched. See
 * {@link CreateBasaltThemeOptions.fonts}.
 */
export type BasaltFontsConfig = {
  sans?: string
  head?: string
  mono?: string
}

// Typed `theme.other.basaltDerive` / `theme.other.basaltFonts` reads (Mantine's `MantineThemeOther`
// ships an index signature, so this merge is additive — no widening of the existing
// `[key: string]: any`). Set by `createBasaltTheme`'s non-default `{ derive }` / `{ fonts }` paths;
// `BasaltProvider` reads them to decide whether to inject the pre-baked static palette CSS or a
// re-derived one for the resolved config, and to emit the matching `--basalt-font-*` declarations.
declare module '@mantine/core' {
  interface MantineThemeOther {
    basaltDerive?: DeriveConfig
    basaltFonts?: BasaltFontsConfig
  }
}

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

/**
 * Pin specific indices of an already-built 10-shade tuple to exact hex values.
 *
 * `ramp10` linearly interpolates a 5-stop family across 10 fractional positions — that can only
 * land EXACTLY on a raw family stop at the two extremes (index 0 / 9), never at an arbitrary
 * middle index. Two indices of the blue family must be EXACT, GENERATED accent hexes (see
 * `ACCENT` in `tokens/palette.ts` — computed from `tokens/derive.ts`, not hand-picked), so both
 * are pinned after the ramp is built (the rest still reads as one coherent sky-blue scale):
 *
 *  • index 6 = `primaryShade` → `ACCENT.accentFill`. Mantine derives
 *    `--mantine-color-blue-filled` from it, i.e. every filled control's surface.
 *  • index 4 → `ACCENT.accent.dark`. Mantine HARDCODES the dark-scheme
 *    `--mantine-color-{c}-text` to shade 4 (not to `primaryShade`), so this is what keeps the
 *    accent LIGHT when it is used as ink on dark — the other half of the ink/surface split.
 */
function pinShades(
  tuple: MantineColorsTuple,
  overrides: Record<number, string>,
): MantineColorsTuple {
  const out = [...tuple] as string[]
  for (const [i, hex] of Object.entries(overrides)) out[Number(i)] = hex
  return out as unknown as MantineColorsTuple
}

/** The shipped, config-independent palette data — `baseTheme` / `cssVariablesResolver` below are
 * built from this once, at module load. */
const DEFAULT_PALETTE_DATA = buildPaletteData(DEFAULT_DERIVE_CONFIG)

/**
 * Build the dark Mantine tuple for `data` at 10 fixed indices:
 * text=dark[0], dimmed=dark[2], border=dark[4], hover=dark[5], surface=dark[6], body=dark[7].
 * Generator-derived — `data.INK` / `data.SURFACE`'s own dark stops, for the shipped default config
 * as much as for any other `neutral`/level configuration, so a palette retune (including the
 * default identity) always tracks the generator's current dark output with no separately-pinned
 * literal to drift out of sync. Indices 8-9 (below-body / darkest extreme) stay the structural
 * `BP.darkGray[0]` / near-black constant — they are not part of the generator's surface-stop set.
 */
function buildDarkTuple(data: PaletteData): MantineColorsTuple {
  return [
    data.INK.ink.dark,
    data.INK.ink2.dark,
    data.INK.muted.dark,
    data.INK.faint.dark,
    data.SURFACE.border.dark,
    data.SURFACE.panelHover.dark,
    data.SURFACE.panel.dark,
    data.SURFACE.bg.dark,
    BP.darkGray[0],
    '#09090b',
  ] as unknown as MantineColorsTuple
}

/**
 * ON-COLOR: the foreground for a filled surface, decided in CSS. THE fix for Mantine's
 * scheme-blind, contrast-blind `autoContrast`.
 *
 * Mantine picks the filled-variant text color ONCE, in JS, via `parseThemeColor({ color, theme })`
 * — with NO `colorScheme` argument, so it resolves against the LIGHT `primaryShade` and bakes a
 * static `color: var(--mantine-color-white)` into the element, while the BACKGROUND it pairs that
 * with (`--mantine-color-{c}-filled`) stays a scheme-reactive CSS var. It gets away with it
 * upstream only because Mantine's default `primaryShade` is `{ light: 6, dark: 8 }` — DARKER on
 * dark, so white happens to stay right. It is luck, not logic: point `primaryShade.dark` at a
 * lighter shade (as Basalt originally did) and every filled control in dark mode turns white-on-
 * light. And even in one scheme the pick is wrong, because `isLightColor` is a BT.601 BRIGHTNESS
 * test that does not track WCAG contrast — it handed white to lime `#97ba2e` at 2.24:1.
 *
 * Basalt removes the JS decision entirely. A fill is now scheme-INDEPENDENT and sits in a
 * luminance band chosen so a WHITE label always clears AA (see `FILL` / `ACCENT` in
 * tokens/palette.ts), so the on-color is a token, not a computation. `--vx-on-{color}` is emitted
 * per color and resolves in pure CSS at paint time — the same discipline the rest of the `--vx-*`
 * system follows. It is still MEASURED here (`legibleOn`) rather than hardcoded to white, so a
 * consumer that retunes a family outside the band still gets the legible foreground.
 *
 * The palette already KNEW the answer: `ACCENT.onAccent` ("text on an accent fill") existed, and
 * `Composer`'s send button hand-wired `color: var(--vx-onAccent)` — which was the ONLY reason that
 * one control stayed legible while every generic Mantine control did not. The token was right;
 * nothing bound the chrome to it. It is bound now (see `accentBridge` / `familyBridge`), and the
 * Composer no longer needs the override.
 *
 * Fix: never let a foreground be decided in JS. `--vx-on-{color}` is emitted per color under BOTH
 * scheme blocks of `cssVariablesResolver` (each resolved against the shade that scheme actually
 * paints), so the foreground resolves in pure CSS at paint time — the same discipline the rest of
 * the `--vx-*` system already follows. `basaltVariantColorResolver` re-points every filled variant
 * at it, and the components that bypass the variant resolver (Checkbox / Radio / Tabs / Pagination /
 * Stepper / Indicator / Timeline all call Mantine's `getContrastColor` directly) are re-pointed at
 * it too, in `components` below. Regression-locked by `contrast.test.ts`.
 */
function onColor(theme: MantineTheme, color: string | undefined): string | undefined {
  const name = color ?? theme.primaryColor
  if (!Object.prototype.hasOwnProperty.call(theme.colors, name)) return undefined // hex / `blue.5`
  return `var(--vx-on-${name})`
}

/**
 * The on-color for a component that bypasses the variant resolver and calls Mantine's
 * `getContrastColor` directly. `undefined` (autoContrast off, or a hex / indexed color) leaves
 * Mantine's own value in place — `mergeVars` strips undefined before merging.
 */
function onColorFor(
  theme: MantineTheme,
  props: { color?: string | undefined; autoContrast?: boolean | undefined },
): string | undefined {
  const autoContrast = props.autoContrast ?? theme.autoContrast
  return autoContrast ? onColor(theme, props.color) : undefined
}

/** WCAG 2.x relative luminance. */
function relativeLuminance(hex: string): number {
  const channels = hexToRgb(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

/** WCAG 2.x contrast ratio. */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].toSorted((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/**
 * The legible foreground for `background` — decided by MEASURED contrast, never by a brightness
 * heuristic. (Mantine picks via `isLightColor`, a BT.601 brightness test against
 * `luminanceThreshold`, which does not track WCAG contrast: it hands white to saturated mid-tones
 * like lime `#97ba2e` at 2.24:1.) Since `contrast(bg, white) * contrast(bg, black)` is a constant
 * (~17.9 for this black), taking the larger of the two is also the AA-optimal choice, and floors
 * every pairing at ~4.2:1.
 */
function legibleOn(background: string, theme: MantineTheme): string {
  return contrastRatio(background, theme.white) >= contrastRatio(background, theme.black)
    ? 'var(--mantine-color-white)'
    : 'var(--mantine-color-black)'
}

/** The `--vx-on-*` block for one scheme: contrast-picked against the shade THAT scheme fills with. */
function onColorVars(
  theme: MantineTheme,
  colorScheme: 'light' | 'dark',
  data: PaletteData,
): Record<string, string> {
  const shade = getPrimaryShade(theme, colorScheme)
  const vars: Record<string, string> = {}
  for (const [name, tuple] of Object.entries(theme.colors)) {
    if (!Array.isArray(tuple)) continue // virtual color — resolves per scheme on its own
    const filled = tuple[shade]
    if (typeof filled !== 'string') continue
    // The accent already HAS a declared on-color in the palette (`ACCENT.onAccent`, the spec's
    // "text on an accent fill") — the token stays the single source, so a palette retune moves the
    // chrome with it. Everything else is a generic surface with no declared foreground: measure it.
    vars[`--vx-on-${name}`] =
      name === theme.primaryColor
        ? `var(--vx-onAccent, ${data.ACCENT.onAccent[colorScheme]})`
        : legibleOn(filled, theme)
  }
  return vars
}

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
 * light ink in dark mode). A mix of that ink over the surface is therefore a pale tint under
 * dark text on light, and a dim tint under light text on dark: one expression, identical logic
 * both ways, always high-contrast. `filled` (autoContrast) / `outline` / `subtle` keep Mantine's
 * defaults. Only plain theme-palette color names are remapped; hex / indexed colors fall through.
 *
 * The background mix is pinned at 13% — the spec's status-tint idiom (`docs/DESIGN-SPEC.md` §2:
 * "status tint bg (delta badges): color-mix(in srgb, <status> 13%, transparent)"), which this
 * resolver is the single implementation of (Badge's `light` variant IS the status-tint idiom).
 */
const basaltVariantColorResolver: VariantColorsResolver = (input) => {
  const resolved = defaultVariantColorsResolver(input)
  const colorName = input.color ?? input.theme.primaryColor
  const on = onColor(input.theme, colorName)
  if (on === undefined) return resolved // hex / indexed color — bg is scheme-static, Mantine is right

  // `filled`: swap Mantine's JS-baked, scheme-blind white for the scheme-reactive on-color.
  if (input.variant === 'filled') {
    const autoContrast = input.autoContrast ?? input.theme.autoContrast
    return autoContrast ? { ...resolved, color: on } : resolved
  }

  if (input.variant !== 'light') return resolved
  const ink = `var(--mantine-color-${colorName}-light-color)`
  return {
    ...resolved,
    background: `color-mix(in srgb, ${ink} 13%, transparent)`,
    hover: `color-mix(in srgb, ${ink} 20%, transparent)`,
    color: ink,
    border: 'none',
  }
}

/**
 * Basalt base theme — Mantine `createTheme` bound to the Basalt zinc palette.
 *
 * Inputs keep `size: 'md'` for GEOMETRY (42px height, padding), while their FONT-SIZE is floored
 * at 16px by the `styles.css` rule — Safari zooms the viewport when a focused input computes below
 * 16px. Splitting the two is deliberate: pinning `size: 'lg'` to reach a 16px font would drag a
 * 50px input height along with it. The floor is `max(16px, …)`, so it never clamps a deliberately
 * LARGER input down, and — being a CSS floor on the element rather than a per-component
 * `defaultProps` — it covers every input Mantine ships (Autocomplete, MultiSelect, TagsInput,
 * PinInput, …) plus any consumer that passes an explicit `size="xs"`. Enumerating components in
 * `defaultProps` could never do that; the previous attempt missed seven of them.
 */
function buildTheme(data: PaletteData): MantineThemeOverride {
  const { ACCENT, FILL } = data
  return createTheme({
    primaryColor: 'blue',
    // ONE shade in both schemes — a filled control is a SURFACE, and the accent surface is the same
    // hex either way (see `ACCENT.accentFill`). The scheme-inverting half of the accent lives in
    // Mantine's dark `--mantine-color-{c}-text`, which is hardcoded to shade 4 = `ACCENT.accent.dark`.
    primaryShade: 6,
    autoContrast: true,
    luminanceThreshold: 0.45,
    // Force the `light` variant to a faint, AA-legible tint in both schemes (see resolver above).
    variantColorResolver: basaltVariantColorResolver,
    white: '#ffffff',
    black: '#18181b',
    // The three-font system (docs/DESIGN-SPEC.md §3): Nunito Sans body / Hubot Sans condensed
    // headings / JetBrains Mono for numerals + micro-labels. The `--basalt-font-*` vars stay the
    // override seam (shipped in styles.css, with system-font fallback chains).
    fontFamily: 'var(--basalt-font-sans, ui-sans-serif, system-ui, sans-serif)',
    fontFamilyMonospace: "var(--basalt-font-mono, ui-monospace, 'SF Mono', Menlo, monospace)",
    headings: {
      fontFamily: 'var(--basalt-font-head, var(--basalt-font-sans, ui-sans-serif, sans-serif))',
      fontWeight: '550',
    },
    // Control radius tier (docs/DESIGN-SPEC.md §4: inputs, search, buttons, segmented track, icon
    // buttons ≥28px sit at ~6px). `radius.md` = 0.375rem = 6px, mirrored by `--vx-radius-ctrl` — every
    // control without its own explicit `radius` prop (Button, ActionIcon, TextInput, NumberInput,
    // PasswordInput, Select, Textarea) falls back to this default. Card/Paper bypass this scale
    // entirely — they resolve straight to `var(--vx-radius-card)` (7px, see the
    // `components.Card`/`Paper` overrides below).
    defaultRadius: 'md',
    // Named weight ladder (v9 fontWeights).
    fontWeights: { regular: '400', medium: '500', semibold: '600', bold: '700' },
    // The OWNED type scale — Mantine's xs…xl re-expressed from the single `VX.text` ladder
    // (`tokens/index.ts`), so `<Text size="sm">` and a `--vx-text-sm` CSS module read the same step.
    // Passed through Mantine's `rem()` (→ `calc(Xrem * var(--mantine-scale))`) rather than raw px, so
    // the component surface honors the user's browser font-size and Mantine's own scale factor —
    // the px numbers in `VX.text` exist only for inline styles and visx SVG, which can't take `var()`.
    // `md` is the body step. Mantine's default ladder (12/14/16/18/20) is now fully replaced.
    fontSizes: {
      xs: rem(VX.text.xs),
      sm: rem(VX.text.sm),
      md: rem(VX.text.md),
      lg: rem(VX.text.lg),
      xl: rem(VX.text.xl),
    },
    // Deliberate, OWNED spacing + radius scales — the single edit point, not inherited Mantine
    // defaults. Denser than Mantine's stock lg/xl for a tighter, data-driven surface. 10 12 16 18 24.
    spacing: { xs: '0.625rem', sm: '0.75rem', md: '1rem', lg: '1.125rem', xl: '1.5rem' },
    // 2 4 6 16 32 — the size scale; `md` (6px) is the control-radius default (`defaultRadius: 'md'`,
    // inputs/buttons). Card/Paper/Popover/Modal/Notification read `--vx-radius-*` directly instead
    // (7px cards / 6px controls), so the larger steps of this scale no longer mirror either token.
    radius: { xs: '0.125rem', sm: '0.25rem', md: '0.375rem', lg: '1rem', xl: '2rem' },
    // Shade 6 (= `primaryShade`) is pinned to the FILL BAND for every family, so the JS ramp and the
    // `--vx-fill-*` tokens hold the SAME hex. That keeps `-filled` / `-text`(light) / `-outline`
    // internally consistent, and lets the on-color be measured straight off the tuple (below).
    colors: {
      dark: buildDarkTuple(data),
      gray: pinShades(ramp10(BP.gray), { 6: FILL.gray }),
      blue: pinShades(ramp10(BP.blue), { 4: ACCENT.accent.dark, 6: ACCENT.accentFill.light }),
      cyan: pinShades(ramp10(BP.cerulean), { 6: FILL.cyan }),
      teal: pinShades(ramp10(BP.turquoise), { 6: FILL.teal }),
      green: pinShades(ramp10(BP.forest), { 6: FILL.green }),
      lime: pinShades(ramp10(BP.lime), { 6: FILL.lime }),
      yellow: pinShades(ramp10(BP.gold), { 6: FILL.yellow }),
      orange: pinShades(ramp10(BP.orange), { 6: FILL.orange }),
      red: pinShades(ramp10(BP.red), { 6: FILL.red }),
      pink: pinShades(ramp10(BP.rose), { 6: FILL.pink }),
      grape: pinShades(ramp10(BP.violet), { 6: FILL.grape }),
      violet: pinShades(ramp10(BP.violet), { 6: FILL.violet }),
      indigo: pinShades(ramp10(BP.indigo), { 6: FILL.indigo }),
    },
    components: {
      // Depth = `shadow-card` (a whisper shadow + a 1px ring baked into the SAME value) — never a
      // separate `border` property (docs/DESIGN-SPEC.md doctrine inversion #1). Cards carry no
      // `withBorder` at all; the ring lives inside `--vx-shadow-card`.
      // ONE card identity, enforced at the theme so NO component can diverge. Every card-like
      // surface — Mantine `Card`, a bare `Paper` used as a card, and the Mantine-free `ChartCard` —
      // resolves to the SAME three tokens:
      //   • background → `--vx-surface-panel` (the panel surface, NOT the page body).
      //   • depth      → `--vx-shadow-card` (whisper shadow + ring, replaces `withBorder`).
      //   • radius     → `--vx-radius-card` (10px).
      // This is the single source the user's "strict surface across components" demands; the
      // `raw-surface` guard then stops consumers re-overriding any of it inline.
      Card: Card.extend({
        styles: {
          root: {
            backgroundColor: 'var(--vx-surface-panel)',
            boxShadow: 'var(--vx-shadow-card)',
            borderRadius: 'var(--vx-radius-card)',
          },
        },
      }),
      Paper: Paper.extend({
        styles: {
          root: {
            backgroundColor: 'var(--vx-surface-panel)',
            boxShadow: 'var(--vx-shadow-card)',
            borderRadius: 'var(--vx-radius-card)',
          },
        },
      }),
      // Mantine's default Badge radius is a full 1000px pill; the spec's delta/status badges sit at
      // radius 6 (docs/DESIGN-SPEC.md §4/§5). Count badges (radius 5) are a distinct, smaller-radius
      // usage left to the call site (`radius={5}` prop) since Badge has no state to key off here.
      Badge: Badge.extend({ defaultProps: { radius: 6 } }),
      // Alert renders its title in the body font by default; bring it onto the head-font idiom
      // (docs/DESIGN-SPEC.md §5) like every other titled surface. Radius/padding/color tint are
      // already on-system (defaultRadius 'md' control tier + the variant color resolver), so only
      // the title font is overridden.
      Alert: Alert.extend({
        styles: {
          title: {
            fontFamily: 'var(--basalt-font-head)',
            fontWeight: 550,
            fontStretch: '88%',
          },
        },
      }),
      // "Ink earns its color" — a nav selection is UI state, not the identity accent on the LABEL.
      // The active item is panel bg + `shadow-card` (forced here at the THEME level via NavLink's
      // `--nl-*` vars, so it holds for every render path — including a consumer's router `<Link>`
      // via `renderNavLink`, which never sees the shell CSS module); the active ICON is
      // accent-colored via `nav-link.module.css` (targets the `[data-position='left']` leftSection,
      // which the flat `vars`/`styles` API can't express conditionally on `[data-active]`).
      NavLink: NavLink.extend({
        vars: () => ({
          root: {
            '--nl-bg': 'var(--vx-surface-panel)',
            '--nl-color': 'var(--vx-ink)',
            '--nl-hover': 'color-mix(in srgb, var(--vx-ink) 6%, transparent)',
          },
          children: {},
        }),
        // Dense, rounded nav rows — applied at the THEME level so they survive EVERY render path,
        // including a consumer's router `<Link>` via `renderNavLink`, which never sees the shell CSS
        // module (the module's `.link` only reaches the shell's own fallback `<NavLink>`). Same
        // reasoning as the `--nl-*` fill above: layout is single-sourced here, not in two places.
        // The active-weight/shadow/icon-accent state selectors can't live in `styles` (flat inline
        // props only) — they're in nav-link.module.css, wired via `classNames` so they reach the
        // same every-render-path scope.
        classNames: { root: navLinkClasses.root },
        styles: {
          root: {
            // Row geometry (docs/DESIGN-SPEC.md §5): 6px 10px padding lands ~29-30px rows. Mantine
            // v9 hardcodes NavLink padding (`8px var(--mantine-spacing-sm)` — there is NO
            // `--nl-padding` var), so the spec padding is forced inline here, where it wins
            // deterministically on every render path.
            padding: '6px 10px',
            // The body step on the ROOT, not just the label: the body element sizes itself from the
            // root's inherited line-height (which, left at the default 1.55, alone pushed rows to
            // ~37px). The tightened 1.35 keeps rows compact as the scale grows.
            fontSize: VX.text.md,
            lineHeight: '1.35',
            // Nav rows sit in the 5-6px radius tier (docs/DESIGN-SPEC.md §4), not square.
            borderRadius: 6,
          },
          // Mantine pins the label at `font-size-sm` explicitly, so the root value alone
          // doesn't reach it.
          label: { fontSize: VX.text.md, lineHeight: '1.35' },
        },
      }),
      // Field idiom (docs/DESIGN-SPEC.md §5): field surface + `shadow-card` depth + faint placeholder,
      // accent border + subtle accent ring on focus — see controls.module.css. The two slots carry
      // different halves of it: the `wrapper` is where Mantine declares the `--input-*` vars, the
      // `input` is the box that actually paints the surface (bg + radius) and therefore the only
      // legal home for the shadow's ring. Theming the base `Input` covers
      // TextInput/NumberInput/PasswordInput/Select/Textarea, which all render it internally (only
      // `size` needs per-component defaults, since each resolves its own).
      Input: Input.extend({
        defaultProps: { size: 'md' },
        classNames: { wrapper: controlsClasses.inputWrapper, input: controlsClasses.input },
      }),
      TextInput: TextInput.extend({ defaultProps: { size: 'md' } }),
      NumberInput: NumberInput.extend({ defaultProps: { size: 'md' } }),
      PasswordInput: PasswordInput.extend({ defaultProps: { size: 'md' } }),
      Select: Select.extend({ defaultProps: { size: 'md' } }),
      Textarea: Textarea.extend({ defaultProps: { size: 'md' } }),
      // PillsInput (MultiSelect/TagsInput's outer field) renders `InputBase` internally but under
      // its OWN `__staticSelector: 'PillsInput'`, so it never reads `theme.components.Input` — the
      // field idiom above never reached it. `PillsInput.classes === InputBase.classes`, so the SAME
      // part names apply here; reusing both control classes picks up the exact `[data-variant]` rules
      // in controls.module.css for free, no new CSS needed. Both slots are required — `wrapper` alone
      // would land the vars but leave the field flat, since the depth lives on `input`.
      PillsInput: PillsInput.extend({
        classNames: { wrapper: controlsClasses.inputWrapper, input: controlsClasses.input },
      }),
      // Button / ActionIcon (`default` variant): same `shadow-card` depth as every other control
      // surface (docs/DESIGN-SPEC.md §5: "search trigger … panel + shadow-card", "icon button …
      // panel + shadow-card"; doctrine inversion #1). Background already resolves through the shared
      // `--mantine-color-default` var (→ `--vx-surface-panel`, see cssVariablesResolver below) and
      // the border through `--mantine-color-default-border` (→ transparent, same resolver) — neither
      // component had a `.extend()` block at all before this, which is why they never picked up
      // either. Only the shadow needs adding here, in controls.module.css: Mantine's own
      // `[data-variant='default']` rule never declares a `box-shadow`, so no specificity fight is
      // needed to win one. `filled`/`subtle`/`light` variants are untouched — scoped by attribute
      // selector in the CSS, not here.
      Button: Button.extend({ classNames: { root: controlsClasses.buttonRoot } }),
      ActionIcon: ActionIcon.extend({ classNames: { root: controlsClasses.actionIconRoot } }),
      // CheckboxCard / RadioCard (`withBorder`, true by default): same live regression as Button/
      // ActionIcon before this pass — Mantine ships `border: 1px solid transparent` as the BASE
      // `[data-with-border]` declaration, but its own `:where([data-mantine-color-scheme=…])` block
      // re-colors that to gray-3/dark-4 (pinned to `--vx-surface-border` by the strict-surface lever
      // below), landing a real, flat hairline with no shadow at all — the exact "flat and edgeless"
      // symptom, just via a different mechanism (`[data-with-border]`, not the `default`-variant
      // border var). `.checkboxCardRoot[data-with-border]` / `.radioCardRoot[data-with-border]` are
      // real attribute selectors ((0,2,0)) — Mantine's own rule wraps the same attribute in `:where()`
      // (0 specificity, landing at (0,1,0) total), so no `html[…]` prefix fight is needed here either.
      // Neither component sets a background of its own, so panel bg is added alongside the shadow —
      // the same panel-bg + shadow-card + no-border triad as Card/Paper.
      CheckboxCard: CheckboxCard.extend({
        classNames: { card: controlsClasses.checkboxCardRoot },
      }),
      RadioCard: RadioCard.extend({
        classNames: { card: controlsClasses.radioCardRoot },
      }),
      // Chip: unlike Button/Input, Chip has no literal `variant="default"` — its OWN default (no
      // `variant` prop passed) resolves internally to `variant: 'filled'` (Chip's neutral/unselected
      // look, NOT a "loud" filled color — `light`/`outline` are the other two Chip variants). The
      // unchecked `filled`-variant label already ships a transparent border (`gray-1`/`dark-5` tint,
      // no shadow) — borderless but flat, the same symptom as CheckboxCard/RadioCard above. The class
      // is wired conditionally (function-form `classNames`, same pattern as the `vars` on-color
      // re-points below) so it NEVER reaches a consumer-chosen `light`/`outline` Chip.
      Chip: Chip.extend({
        classNames: (_theme, props) =>
          (props.variant ?? 'filled') === 'filled' ? { label: controlsClasses.chipLabel } : {},
      }),
      // Track = ink-6% tint, radius 7, 2px padding; active segment = panel bg + `shadow-ctrl`,
      // radius 5. `--sc-radius`/`--sc-color` don't reach the root track background (Mantine
      // hardcodes that to a raw gray step), so it's forced via `styles.root` same as Card/Paper.
      // The active-only ink label color + weight can't live in the flat `styles.label` object
      // (applies to every option regardless of state), so it's in segmented-control.module.css
      // instead — same pattern as NavLink's active-icon accent.
      SegmentedControl: SegmentedControl.extend({
        defaultProps: { radius: 7 },
        classNames: { label: segmentedControlClasses.label },
        styles: {
          root: {
            backgroundColor: 'color-mix(in srgb, var(--vx-ink) 6%, transparent)',
            padding: 2,
          },
          indicator: {
            backgroundColor: 'var(--vx-surface-panel)',
            boxShadow: 'var(--vx-shadow-ctrl)',
            borderRadius: 5,
          },
        },
      }),
      // Track = ink-8%; leader/section fill colors are a per-usage `color` prop (left to consumers).
      Progress: Progress.extend({
        defaultProps: { size: 6, radius: 4 },
        styles: {
          root: { backgroundColor: 'color-mix(in srgb, var(--vx-ink) 8%, transparent)' },
        },
      }),
      // Activity-feed idiom: 20-24px bullet, hairline connecting line (not Mantine's heavy default),
      // head-weight title, muted body — zero call-site work for an on-spec Timeline. `bulletSize`/
      // `lineWidth` land through Timeline's OWN `varsResolver` (real component vars, not our `styles`
      // object), so they aren't subject to the custom-property stripping below. The bullet's
      // panel/hairline/accent-active treatment and the line's divider color ARE custom-property
      // declarations / state-selectors — both unreachable from a flat `styles` object (same
      // reasoning as SegmentedControl's active-label rule and NavLink's active-icon rule) — so they
      // live in `timeline.module.css` instead. `TimelineItem` renders through the PARENT Timeline's
      // style context (`ctx.getStyles`), so `item`/`itemBullet`/`itemTitle`/`itemContent` are all
      // themed from this ONE extend — no separate `TimelineItem` override needed.
      Timeline: Timeline.extend({
        defaultProps: { bulletSize: 22, lineWidth: 1 },
        // The active bullet's icon sits on the accent fill — on-color, not a baked white (see above).
        vars: (theme, props) => ({ root: { '--tl-icon-color': onColorFor(theme, props) } }),
        classNames: {
          item: timelineClasses.item,
          itemBullet: timelineClasses.itemBullet,
        },
        styles: {
          itemTitle: {
            fontSize: VX.text.md,
            fontWeight: 600,
            color: 'var(--vx-ink)',
          },
          itemContent: {
            fontSize: VX.text.md,
            color: 'var(--vx-muted)',
          },
        },
      }),
      // ── Floating layer (docs/DESIGN-SPEC.md §5) ─────────────────────────────────────────────
      // ONE idiom for every detached surface: overlay surface + a REAL 1px `--vx-surface-border`
      // border + the overlay elevation shadow. The border must be a real `border` property (never
      // "ring in the shadow" like cards): Mantine's arrow is a rotated square that draws
      // `1px solid var(--popover-border-color)` and inherits the dropdown's background — with
      // `border: 'none'` on the dropdown the arrow rendered as a broken floating diamond edge.
      // (`--popover-border-color` resolves to gray-2/dark-4, both pinned to `--vx-surface-border`
      // by the resolver below, so dropdown and arrow always share the same edge color.)

      // Tooltip is a standalone floating primitive (not Popover-based) — themed directly. Its arrow
      // ships border-less (`border: 0`), so the same edge is applied inline to keep the ring closed.
      Tooltip: Tooltip.extend({
        defaultProps: { radius: 8 },
        styles: {
          tooltip: {
            backgroundColor: 'var(--vx-surface-overlay)',
            color: 'var(--vx-ink)',
            border: '1px solid var(--vx-surface-border)',
            boxShadow: 'var(--vx-shadow-overlay)',
          },
          arrow: { border: '1px solid var(--vx-surface-border)' },
        },
      }),
      // Popover is the shared floating primitive underneath Menu (Menu renders `<Popover>`
      // internally with no `radius`/`shadow` of its own), so theming it here covers both.
      Popover: Popover.extend({
        defaultProps: { radius: 8 },
        styles: {
          dropdown: {
            backgroundColor: 'var(--vx-surface-overlay)',
            border: '1px solid var(--vx-surface-border)',
            boxShadow: 'var(--vx-shadow-overlay)',
          },
        },
      }),
      // Menu rows: 13px, radius 6, ghost ink-6% hover (floating.module.css — custom properties are
      // stripped from `styles` objects, and Menu's internal Popover does NOT consume
      // `components.Popover.styles`, so the dropdown surface is repeated here). Menu.Label = the
      // mono micro-label idiom; dividers use the layout-divider token.
      Menu: Menu.extend({
        classNames: { item: floatingClasses.menuItem },
        styles: {
          dropdown: {
            backgroundColor: 'var(--vx-surface-overlay)',
            border: '1px solid var(--vx-surface-border)',
            boxShadow: 'var(--vx-shadow-overlay)',
          },
          item: { fontSize: VX.text.md, borderRadius: 6, padding: '6px 10px' },
          label: {
            fontFamily: 'var(--basalt-font-mono)',
            fontSize: VX.text.micro,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--vx-faint)',
          },
          divider: { borderColor: 'var(--vx-divider)' },
        },
      }),
      // Combobox is the floating primitive underneath Select/Autocomplete/MultiSelect — like Menu,
      // it doesn't consume `components.Popover.styles`, so the overlay dropdown idiom is repeated.
      Combobox: Combobox.extend({
        styles: {
          dropdown: {
            backgroundColor: 'var(--vx-surface-overlay)',
            border: '1px solid var(--vx-surface-border)',
            boxShadow: 'var(--vx-shadow-overlay)',
          },
        },
      }),
      // Modal/Drawer: overlay surface + overlay shadow on the content. The header goes transparent —
      // Mantine paints it `--mantine-color-body`, which read as a grey band over the overlay
      // surface. Title = head font; close button = the ghost idiom (floating.module.css).
      Modal: Modal.extend({
        defaultProps: { radius: 8 },
        classNames: { close: floatingClasses.closeButton },
        styles: {
          content: {
            backgroundColor: 'var(--vx-surface-overlay)',
            boxShadow: 'var(--vx-shadow-overlay)',
          },
          header: { backgroundColor: 'transparent' },
          title: {
            fontFamily: 'var(--basalt-font-head)',
            fontWeight: 550,
            fontStretch: '88%',
          },
        },
      }),
      Drawer: Drawer.extend({
        classNames: { close: floatingClasses.closeButton },
        styles: {
          content: {
            backgroundColor: 'var(--vx-surface-overlay)',
            boxShadow: 'var(--vx-shadow-overlay)',
          },
          header: { backgroundColor: 'transparent' },
          title: {
            fontFamily: 'var(--basalt-font-head)',
            fontWeight: 550,
            fontStretch: '88%',
          },
        },
      }),
      // Kbd/Code share the ink-tint idiom (docs/DESIGN-SPEC.md §2: "segmented-control track /
      // count-badge bg: ink 6–8%") — mono, ink-7% bg, radius 5.
      // Flat mono chip (mock's ⌘K badge) — Mantine's default Kbd draws a 3px "keyboard key" bottom
      // border that reads as a heavy off-system rule, so the border goes entirely.
      Kbd: Kbd.extend({
        styles: {
          root: {
            backgroundColor: 'color-mix(in srgb, var(--vx-ink) 7%, transparent)',
            border: 'none',
            color: 'var(--vx-ink2)',
            borderRadius: 5,
          },
        },
      }),
      Code: Code.extend({
        styles: {
          root: {
            backgroundColor: 'color-mix(in srgb, var(--vx-ink) 7%, transparent)',
            borderRadius: 5,
          },
        },
      }),
      // Header cells become a micro-label (mono, uppercase, faint) — numeral/tabular styling for
      // body cells is a per-table call-site concern, left to consumers. `--table-border-color`
      // drives row separators AND the opt-in `withTableBorder` outer border — both drop to the
      // hairline (Mantine's default reads gray-3/dark-4 = the STRONG line, too heavy in a card).
      Table: Table.extend({
        classNames: { table: controlsClasses.tableRoot },
        styles: {
          th: {
            fontFamily: 'var(--basalt-font-mono)',
            fontSize: VX.text.micro,
            fontWeight: 500,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--vx-faint)',
          },
        },
      }),
      // The v9 thumb indicator is a center dot painted in the TRACK color — over the remapped
      // neutral track it read as an artifact, so it's disabled: clean track, plain thumb, accent
      // fill when checked (`--switch-color` defaults to the primary filled shade = the accent).
      Switch: Switch.extend({ defaultProps: { withThumbIndicator: false } }),
      // The tab-list bottom rule (and the inactive-tab hover underline) is a layout separator, not
      // control chrome — it reads the divider token instead of the heavy gray-3/dark-4 line
      // (controls.module.css; custom properties are stripped from `styles` objects). The active tab
      // underline keeps `--tabs-color` (accent) untouched.
      Tabs: Tabs.extend({
        classNames: { root: controlsClasses.tabsRoot },
        // The on-color re-point (see below). Cast: Mantine's `TabsCssVariables` type declares only
        // `--tabs-color` / `--tabs-radius`, yet Tabs' OWN varsResolver writes `--tabs-text-color` —
        // an upstream type gap, so the var it actually paints the active tab with is otherwise
        // unreachable from the theme.
        vars: (theme, props) =>
          ({ root: { '--tabs-text-color': onColorFor(theme, props) } }) as unknown as {
            root: Record<'--tabs-color' | '--tabs-radius', string | undefined>
          },
      }),

      // ── ON-COLOR re-points (see the ON-COLOR doctrine above) ────────────────────────────────
      // These components never reach `variantColorResolver` — each calls Mantine's `getContrastColor`
      // straight from its own `varsResolver`, so each bakes the same scheme-blind white into its ONE
      // foreground var. Theme `vars` merge AFTER a component's own `varsResolver` (Mantine
      // `useStyles`), so re-pointing that var here wins on every render path. Without this, a dark-mode
      // Checkbox/Radio paints a white checkmark on the light accent fill — invisible.
      Checkbox: Checkbox.extend({
        vars: (theme, props) => ({
          root: {
            // `iconColor` is an explicit call-site override, and `outline` paints the mark in the
            // color itself on a transparent box — neither is an on-color surface.
            '--checkbox-icon-color':
              props.iconColor || props.variant === 'outline' ? undefined : onColorFor(theme, props),
          },
        }),
      }),
      Radio: Radio.extend({
        vars: (theme, props) => ({
          root: {
            '--radio-icon-color':
              props.iconColor || props.variant === 'outline' ? undefined : onColorFor(theme, props),
          },
        }),
      }),
      Pagination: Pagination.extend({
        vars: (theme, props) => ({
          root: { '--pagination-active-color': onColorFor(theme, props) },
        }),
      }),
      Stepper: Stepper.extend({
        vars: (theme, props) => ({ root: { '--stepper-icon-color': onColorFor(theme, props) } }),
      }),
      Indicator: Indicator.extend({
        vars: (theme, props) => ({ root: { '--indicator-text-color': onColorFor(theme, props) } }),
      }),
      // Accordion (default variant): hairline separators between items only — the color retune AND
      // the last item's outer border-bottom drop both live in controls.module.css.
      Accordion: Accordion.extend({ classNames: { item: controlsClasses.accordionItem } }),
      // Parents faint, separator line-colored — the current-page treatment (head font, weight) is a
      // shell-level concern (AppBreadcrumbs), not this generic Mantine primitive.
      Breadcrumbs: Breadcrumbs.extend({
        styles: {
          breadcrumb: { color: 'var(--vx-faint)' },
          separator: { color: 'var(--vx-surface-border)' },
        },
      }),
      // Card idiom — same panel + shadow-card as every other surface.
      Notification: Notification.extend({
        defaultProps: { radius: 8 },
        styles: {
          root: {
            backgroundColor: 'var(--vx-surface-panel)',
            boxShadow: 'var(--vx-shadow-card)',
          },
        },
      }),
    },
  })
}

/** The static, shipped-identity theme — `buildTheme` evaluated once at
 * `DEFAULT_DERIVE_CONFIG` (memoized by `buildPaletteData`), not per import. */
export const baseTheme: MantineThemeOverride = buildTheme(DEFAULT_PALETTE_DATA)

/**
 * Bind Mantine's surface system to the SAME `--vx-*` variables the charts use, so chrome and
 * charts draw from one set of scheme-reactive surfaces.
 *
 * These bindings MUST live in the `light`/`dark` blocks, not the scheme-independent `variables`
 * block: Mantine declares the surface vars under the `[data-mantine-color-scheme]` selector, which
 * outranks a `:root` rule — so a `variables` binding loses to Mantine's per-scheme default. The
 * light/dark blocks are injected under the same scheme selector, at matching specificity, after.
 * (The `--vx-*` refs are themselves scheme-resolved; the per-scheme hex fallbacks guard a brief
 * window before the palette CSS injects.)
 *
 * The hex fallbacks are generated from the `SURFACE` / `NEUTRAL` / `INK` palette pairs (not
 * hand-typed), so they cannot drift from the values the token layer emits for the same `--vx-*`
 * names.
 */
/**
 * Bridge Mantine's PRIMARY-color vars onto the `--vx-*` accent tokens — the second half of the
 * single-source rule (surfaces are already bridged below).
 *
 * Without this, the accent is DUAL-SOURCED: the `--vx-*` layer (charts, links, nav icons, focus
 * ring) reads CSS custom properties, while the Mantine chrome (buttons, switches, checkboxes, tabs,
 * badges) reads `theme.colors.blue`, a JS hex ramp baked at module load. The two happened to hold
 * the same hue, so the split was invisible — until you retune one. It is exactly why the theme lab
 * appeared broken: overriding `--vx-accent` on `<html>` restyled the charts and left every button
 * untouched, because no Mantine var pointed at it.
 *
 * `getThemeColor(color, theme)` resolves a plain theme color to `var(--mantine-color-{c}-filled)`,
 * so overriding that ONE var reaches the variant resolver's filled background AND every component
 * that fills from its own varsResolver (Checkbox, Radio, Switch, Tabs, Timeline, Stepper,
 * Indicator, Pagination). The `-text` / `-outline` / `-light-color` vars are the accent's INK role
 * and bridge to `--vx-accent`, which is why they still invert across schemes while the fill does not.
 *
 * The `var(--vx-…, <hex>)` fallbacks are generated from the same `ACCENT` pairs the token layer
 * emits, so they cannot drift, and they cover the window before the palette <style> lands
 * (`injectPalette={false}`).
 */
function accentBridge(
  theme: MantineTheme,
  side: 'light' | 'dark',
  data: PaletteData,
): Record<string, string> {
  const c = theme.primaryColor
  const { ACCENT } = data
  return {
    [`--mantine-color-${c}-filled`]: `var(--vx-accentFill, ${ACCENT.accentFill[side]})`,
    [`--mantine-color-${c}-filled-hover`]: `var(--vx-accentFillHover, ${ACCENT.accentFillHover[side]})`,
    [`--mantine-color-${c}-text`]: `var(--vx-accent, ${ACCENT.accent[side]})`,
    [`--mantine-color-${c}-outline`]: `var(--vx-accent, ${ACCENT.accent[side]})`,
    [`--mantine-color-${c}-light-color`]: `var(--vx-accent, ${ACCENT.accent[side]})`,
  }
}

/**
 * The same bridge for the NON-primary families — the rest of the chrome, single-sourced.
 *
 * Scheme-independent (a fill does not invert), so one map serves both blocks. Only the FILL roles
 * are bridged: `-text` / `-outline` / `-light-color` are INK roles read against the page, and
 * Mantine already resolves those correctly per scheme (dark `-text` is hardcoded to shade 4, a
 * light step; light `-text` chains to `-filled`, so it follows this bridge for free).
 *
 * `dark` is deliberately not a member — `color="dark"` is a near-black surface by intent, not a
 * band color, and forcing it into the band would turn it into a mid grey.
 */
function familyBridge(data: PaletteData): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [name, hex] of Object.entries(data.FILL)) {
    vars[`--mantine-color-${name}-filled`] = `var(--vx-fill-${name}, ${hex})`
    vars[`--mantine-color-${name}-filled-hover`] =
      `var(--vx-fillHover-${name}, color-mix(in srgb, ${hex} 88%, #000))`
  }
  return vars
}

/**
 * Build the `cssVariablesResolver` bound to a given palette `data` — the derive-config-dependent
 * half of the fallback hexes below (see `buildTheme` above for the same split on `theme.colors`).
 * `cssVariablesResolver` (the static, shipped export) is `buildCssVariablesResolver(DEFAULT_PALETTE_DATA)`
 * evaluated ONCE below — and that is the ONLY resolver instance `BasaltProvider` ever wires in,
 * unconditionally, regardless of derive config. `createBasaltTheme`'s non-default `{ derive }` path
 * does NOT call this function: it rebuilds `theme.colors` (via `buildTheme`) but leaves the CSS
 * variables resolver at its shipped default. A retuned identity instead reaches paint time through
 * `BasaltBridge`'s injected `<style>` (the palette CSS built from the SAME resolved config, keyed
 * by `theme.other.basaltDerive`), which wins the cascade over the resolver's inline fallback hexes.
 * Limitation: `injectPalette={false}` combined with a custom `derive` therefore leaves the
 * resolver's fallback hexes at the shipped defaults — a consumer taking over palette injection
 * (SSR/head) with a non-default derive config must also emit `buildPaletteCss(opts, buildPaletteData(config))`
 * themselves, or those fallbacks silently mismatch the intended identity.
 */
function buildCssVariablesResolver(data: PaletteData): CSSVariablesResolver {
  const { INK, NEUTRAL, SURFACE } = data
  return (theme) => ({
    variables: {},
    light: {
      ...onColorVars(theme, 'light', data),
      ...familyBridge(data),
      ...accentBridge(theme, 'light', data),
      '--mantine-color-body': `var(--vx-surface-bg, ${SURFACE.bg.light})`, // page background
      '--mantine-color-default': `var(--vx-surface-panel, ${SURFACE.panel.light})`, // cards / default controls
      '--mantine-color-default-hover': `var(--vx-surface-elevated, ${SURFACE.elevated.light})`,
      // THE central lever for doctrine inversion #1 on CONTROLS (docs/DESIGN-SPEC.md §8): depth is
      // `shadow-card`, never a hairline, for every `variant="default"` control — not just Card/Paper.
      // `defaultVariantColorsResolver`'s `variant === 'default'` branch reads this ONE var for every
      // component that uses it (Button, ActionIcon, Chip, CheckboxCard, RadioCard, …), so pointing it
      // at `transparent` kills the stock 1px hairline everywhere at once. `transparent`, not `border:
      // none` — the 1px border BOX stays, so focus/error can recolor the same box with no layout
      // shift and `[data-error]` still wins a visible border.
      '--mantine-color-default-border': 'transparent',
      '--mantine-color-dimmed': `var(--vx-neutral, ${NEUTRAL.neutral.light})`, // secondary / muted text
      '--mantine-color-text': `var(--vx-ink, ${INK.ink.light})`, // primary body/heading text
      '--app-shell-border-color': `var(--vx-surface-border, ${SURFACE.border.light})`,
      // THE strict-surface lever. Mantine components do NOT chain border/surface colors through
      // `--mantine-color-default-*`; each hardcodes a RAW ramp step (`--mantine-color-gray-{2,3,4}`
      // on light) directly — which is why AppShell/Table/Input/Divider/Tabs/Popover/Accordion borders
      // render an off-system color while cards use the hairline. Collapse the border-class ramp
      // steps onto the ONE "line" token so EVERY component's border is identical and the agent
      // cannot reintroduce a divergent border. (Hover/subtle BG steps are handled below.)
      '--mantine-color-gray-2': `var(--vx-surface-border, ${SURFACE.border.light})`,
      '--mantine-color-gray-3': `var(--vx-surface-border, ${SURFACE.border.light})`,
      '--mantine-color-gray-4': `var(--vx-surface-border, ${SURFACE.border.light})`,
      // Hover/subtle/striped/track surfaces read `gray-0/1` raw → the dedicated subtle token (a faint
      // step below panel, so hover is actually visible). Dark hover uses the generator-derived
      // dark-5/6/7 steps (`buildDarkTuple`), already on-identity.
      '--mantine-color-gray-0': `var(--vx-surface-subtle, ${SURFACE.subtle.light})`,
      '--mantine-color-gray-1': `var(--vx-surface-subtle, ${SURFACE.subtle.light})`,
    },
    dark: {
      ...onColorVars(theme, 'dark', data),
      ...familyBridge(data),
      ...accentBridge(theme, 'dark', data),
      '--mantine-color-body': `var(--vx-surface-bg, ${SURFACE.bg.dark})`,
      '--mantine-color-default': `var(--vx-surface-panel, ${SURFACE.panel.dark})`,
      '--mantine-color-default-hover': `var(--vx-surface-elevated, ${SURFACE.elevated.dark})`,
      // See the light block above — same lever, both schemes.
      '--mantine-color-default-border': 'transparent',
      '--mantine-color-dimmed': `var(--vx-neutral, ${NEUTRAL.neutral.dark})`,
      '--mantine-color-text': `var(--vx-ink, ${INK.ink.dark})`,
      '--app-shell-border-color': `var(--vx-surface-border, ${SURFACE.border.dark})`,
      // Dark components read `--mantine-color-dark-4` (border) raw. `buildDarkTuple` already sets
      // dark-4, but to a slightly lighter step than the hairline token, so layout borders read
      // marginally heavier than card borders. Pin dark-4 to the SAME "line" token for parity.
      '--mantine-color-dark-4': `var(--vx-surface-border, ${SURFACE.border.dark})`,
    },
  })
}

/** The static, shipped-identity resolver — `buildCssVariablesResolver` evaluated once at
 * `DEFAULT_DERIVE_CONFIG`. Unchanged call signature (`cssVariablesResolver(theme)`), so it drops
 * straight into `<MantineProvider cssVariablesResolver={cssVariablesResolver}>` as before. */
export const cssVariablesResolver: CSSVariablesResolver =
  buildCssVariablesResolver(DEFAULT_PALETTE_DATA)

/** Options for {@link createBasaltTheme}'s derive-config path. */
export type CreateBasaltThemeOptions = {
  /**
   * Retune the shipped palette identity from the six-knob derive engine (`basalt-ui/tokens`'s
   * `DeriveConfig`) instead of the shipped `#0077bd` zinc default. Omitted knobs fall back to
   * {@link DEFAULT_DERIVE_CONFIG}'s value for that knob (`resolveDeriveConfig`).
   *
   * This is the ONE place a consumer sets the palette identity — everything else follows: the
   * Mantine color ramps, the on-color contrast measurements, and the CSS-variables resolver
   * fallbacks are all rebuilt from the SAME resolved config, and the config itself is stashed on
   * `theme.other.basaltDerive` so `BasaltProvider` can inject the matching `--vx-*` stylesheet
   * automatically. For live DEV-time tuning instead of a fixed production identity, see
   * `DeriveControls` (`basalt-ui/theme-lab`).
   */
  derive?: Partial<DeriveConfig>

  /**
   * Retune the three-font system (`docs/DESIGN-SPEC.md` §3: Nunito Sans body / Hubot Sans
   * condensed headings / JetBrains Mono numerals + micro-labels) instead of the shipped stacks.
   * THIS is the font entry point — a consumer must not set `fontFamily` literals in component code
   * (enforced by the `raw-font-family` guard kind, `./guard`); overriding Mantine's `fontFamily` via
   * `overrides` is unnecessary because the theme already reads `--basalt-font-sans/head/mono`.
   *
   * Each value is a FULL CSS font-family stack string (bring your own fallback chain) —
   * an omitted key keeps the shipped `styles.css` fallback untouched. The resolved value is
   * stashed on `theme.other.basaltFonts` so `BasaltProvider` can inject the matching
   * `--basalt-font-*` declarations — it rides the SAME `<style>` injection as the palette CSS, so
   * `injectPalette={false}` (SSR/head injection) also opts fonts out; a consumer taking over
   * injection must then emit those declarations itself.
   *
   * @example
   * createBasaltTheme(undefined, { fonts: { sans: 'Inter, sans-serif' } })
   */
  fonts?: BasaltFontsConfig
}

/**
 * Build the Basalt theme, optionally merged with consumer overrides. Overrides win on conflict
 * (Mantine `mergeThemeOverrides` is last-wins), so a consumer can retune any field without
 * forking the base.
 *
 * Pass `{ derive }` to retune the palette identity instead of the shipped default, and/or `{ fonts }`
 * to retune the three-font system (see {@link CreateBasaltThemeOptions}); the default (no `options`,
 * or a `derive`/`fonts` that resolve back to nothing non-default) stays on the pre-baked static
 * `baseTheme` — zero extra derivation work, byte-identical to the shipped identity.
 *
 * Call this at MODULE scope, not inline in a component's render — the non-default `{ derive }` /
 * `{ fonts }` paths build a fresh `MantineThemeOverride` object on every call
 * (`mergeThemeOverrides(...)`), so calling it per-render would hand `MantineProvider` a new `theme`
 * reference every render and churn Mantine's theme context (and every consumer subscribed to it)
 * for no reason.
 *
 * `overrides.other` deep-merges onto the derive-produced `other` (Mantine's `mergeThemeOverrides` /
 * `deepMerge` recurse into plain-object values rather than replacing them wholesale), so passing
 * `{ other: { myFlag: true } }` alongside a non-default `derive` still leaves `other.basaltDerive`
 * intact — it is only lost if a consumer's own `overrides.other` explicitly sets that same key.
 */
export function createBasaltTheme(
  overrides?: MantineThemeOverride,
  options?: CreateBasaltThemeOptions,
): MantineThemeOverride {
  const resolvedConfig = resolveDeriveConfig(options?.derive)
  let theme = isDefaultDeriveConfig(resolvedConfig)
    ? baseTheme
    : mergeThemeOverrides(buildTheme(buildPaletteData(resolvedConfig)), {
        other: { basaltDerive: resolvedConfig },
      })
  if (options?.fonts !== undefined) {
    theme = mergeThemeOverrides(theme, { other: { basaltFonts: options.fonts } })
  }
  return overrides ? mergeThemeOverrides(theme, overrides) : theme
}
