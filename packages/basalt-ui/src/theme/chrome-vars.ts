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

/** The chrome opt-out: a call site that names a colour (even the primary one) keeps its hue. */
export function hasExplicitColor(color: string | undefined): boolean {
  return color !== undefined
}

/**
 * A `subtle` Button / ActionIcon that names no colour takes neutral ink for its label and an
 * ink-6% hover (`docs/DESIGN-SPEC.md` §5 ghost idiom). An explicit `color=` — the primary one
 * included — keeps Mantine's tinted label and hover: `color="red"` on a destructive text action
 * carries its hue as the whole signal. Mantine hands the variant resolver `color || primaryColor`,
 * so only the component props can tell "unnamed" from "primary" — hence vars, not the resolver.
 */
export function subtleInkVars(props: {
  color?: string | undefined
  variant?: string | undefined
}): {
  color: string | undefined
  hover: string | undefined
} {
  const ink = props.variant === 'subtle' && !hasExplicitColor(props.color)
  return {
    color: ink ? 'var(--vx-ink)' : undefined,
    hover: ink ? 'color-mix(in srgb, var(--vx-ink) 6%, transparent)' : undefined,
  }
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
