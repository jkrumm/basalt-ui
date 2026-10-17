/**
 * Component `vars` that carry the Wave 33 chrome (`docs/waves/design-parity/SPEC.md` § 6.12) and the
 * ON-COLOR re-point they sit beside. Pure functions of theme + props, kept out of `theme/index.ts`
 * so the tests can call them directly.
 */
import type { MantineTheme } from '@mantine/core'

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
 * `Composer`'s send button hand-wired `color: var(--vx-on-accent)` — which was the ONLY reason that
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
export function onColor(theme: MantineTheme, color: string | undefined): string | undefined {
  const name = color ?? theme.primaryColor
  if (!Object.prototype.hasOwnProperty.call(theme.colors, name)) return undefined // hex / `blue.5`
  return `var(--vx-on-${name})`
}

/**
 * The on-color for a component that bypasses the variant resolver and calls Mantine's
 * `getContrastColor` directly. `undefined` (autoContrast off, or a hex / indexed color) leaves
 * Mantine's own value in place — `mergeVars` strips undefined before merging.
 */
export function onColorFor(
  theme: MantineTheme,
  props: { color?: string | undefined; autoContrast?: boolean | undefined },
): string | undefined {
  const autoContrast = props.autoContrast ?? theme.autoContrast
  return autoContrast ? onColor(theme, props.color) : undefined
}

/**
 * The chrome opt-out: a call site that names a colour (even the primary one) keeps its hue. An
 * empty string names nothing — Mantine would fall back to the primary colour for it too.
 */
export function hasExplicitColor(color: string | undefined): boolean {
  return color !== undefined && color !== ''
}

type InkVars = {
  color?: string
  hover?: string
  bg?: string
  border?: string
}

const INK = 'var(--vx-ink)'
const SUBTLE = 'var(--vx-surface-subtle)'

/** Per variant: what an unnamed-colour Button / ActionIcon paints instead of the accent. */
const INK_BY_VARIANT: Record<string, InkVars> = {
  subtle: { color: INK, hover: 'color-mix(in srgb, var(--vx-ink) 6%, transparent)' },
  light: { color: INK, bg: SUBTLE, hover: `color-mix(in srgb, var(--vx-ink) 6%, ${SUBTLE})` },
  outline: {
    color: INK,
    border: 'calc(0.0625rem * var(--mantine-scale)) solid var(--vx-surface-border)',
    hover: SUBTLE,
  },
}

/**
 * A `subtle`, `light` or `outline` Button / ActionIcon that names no colour is ink, not the accent
 * (`docs/waves/design-parity/SPEC.md` § 6.12, D27). `subtle`: ink label, ink-6% hover
 * (`docs/DESIGN-SPEC.md` §5 ghost idiom). `light`: the subtle surface with an ink label, hover one
 * ink step on top (Mantine's gray-light roles collapse bg and hover to one colour in light). `outline`:
 * the surface border, ink label, subtle-surface hover. An explicit `color=` — the primary one
 * included — keeps Mantine's tinted vars: `color="red"` on a destructive action carries its hue as
 * the whole signal. Mantine hands the variant resolver `color || primaryColor`, so only the
 * component props can tell "unnamed" from "primary" — hence vars, not the resolver. Disabled needs no
 * gate: Mantine's disabled rule sets colour, background and border directly, not through these vars.
 */
export function inkVars(props: { color?: string | undefined; variant?: string | undefined }): {
  color: string | undefined
  hover: string | undefined
  bg: string | undefined
  border: string | undefined
} {
  const ink = hasExplicitColor(props.color) ? undefined : INK_BY_VARIANT[props.variant ?? '']
  return { color: ink?.color, hover: ink?.hover, bg: ink?.bg, border: ink?.border }
}

/**
 * Tabs vars: the on-color re-point plus the active underline in ink (SPEC § 6.12). Only the
 * underline `default` variant takes ink (`pills` fills with the colour); an explicit `color=` opts
 * out. The return type lists `--tabs-text-color` and `--tabs-radius` because Mantine's
 * `TabsCssVariables` type declares only `--tabs-color` / `--tabs-radius` while Tabs' OWN
 * varsResolver writes `--tabs-text-color` (an upstream type gap).
 */
export function tabsVars(
  theme: MantineTheme,
  props: {
    color?: string | undefined
    variant?: string | undefined
    autoContrast?: boolean | undefined
  },
): { root: Record<'--tabs-color' | '--tabs-radius' | '--tabs-text-color', string | undefined> } {
  const underline = !hasExplicitColor(props.color) && (props.variant ?? 'default') === 'default'
  return {
    root: {
      '--tabs-text-color': onColorFor(theme, props),
      '--tabs-color': underline ? 'var(--vx-ink)' : undefined,
      '--tabs-radius': undefined,
    },
  }
}
