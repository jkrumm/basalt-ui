/**
 * Basalt Mantine theme.
 *
 * Grounded in argo `apps/dashboard/src/theme.ts`: a `createTheme` base (Blueprint-anchored)
 * plus a `cssVariablesResolver` that binds Mantine's surface system to the same `--vx-*`
 * variables the charts use, so chrome and charts draw from one scheme-reactive identity.
 *
 * S0: the base is MINIMAL but real-shaped — `primaryColor`, OWNED spacing/radius scales as
 * placeholders, the named font-weight ladder, mono font family. The full Blueprint ramp
 * reskin (10-shade tuples from BP) lands in S2. Must typecheck against `@mantine/core`.
 */
import {
  createTheme,
  type CSSVariablesResolver,
  type MantineThemeOverride,
  mergeThemeOverrides,
} from '@mantine/core'

/**
 * Minimal Basalt base theme. Deliberate, OWNED spacing + radius scales (matching argo's v9
 * values) live here as the single edit point; full color tuples are added in S2.
 */
export const baseTheme: MantineThemeOverride = createTheme({
  primaryColor: 'blue',
  primaryShade: { light: 6, dark: 4 }, // deeper on light, lighter on dark (no glow)
  autoContrast: true,
  luminanceThreshold: 0.45,
  defaultRadius: 'sm',
  fontFamilyMonospace: "ui-monospace, 'SF Mono', Menlo, monospace",
  fontWeights: { normal: '400', medium: '500', semibold: '600', bold: '700' },
  // 10 12 16 20 32
  spacing: { xs: '0.625rem', sm: '0.75rem', md: '1rem', lg: '1.25rem', xl: '2rem' },
  // 2 4 8 16 32
  radius: { xs: '0.125rem', sm: '0.25rem', md: '0.5rem', lg: '1rem', xl: '2rem' },
})

/**
 * Bind Mantine's surface system to the SAME `--vx-*` variables the charts use, so chrome and
 * charts draw from one set of scheme-reactive surfaces. Bindings live in the `light`/`dark`
 * blocks (not scheme-independent `variables`) so they win at matching specificity against
 * Mantine's per-scheme defaults. Per-scheme hex fallbacks guard the window before palette CSS
 * injects. S0 placeholder — same shape as argo, fallbacks trimmed to the surface set.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': 'var(--vx-surface-bg, #f6f7f9)',
    '--mantine-color-default': 'var(--vx-surface-panel, #ffffff)',
    '--mantine-color-default-hover': 'var(--vx-surface-elevated, #ffffff)',
    '--mantine-color-default-border': 'var(--vx-surface-border, #dce0e5)',
    '--mantine-color-dimmed': 'var(--vx-neutral, #5f6b7c)',
  },
  dark: {
    '--mantine-color-body': 'var(--vx-surface-bg, #1c2127)',
    '--mantine-color-default': 'var(--vx-surface-panel, #252a31)',
    '--mantine-color-default-hover': 'var(--vx-surface-elevated, #2f343c)',
    '--mantine-color-default-border': 'var(--vx-surface-border, #383e47)',
    '--mantine-color-dimmed': 'var(--vx-neutral, #8f99a8)',
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
