/**
 * BasaltProvider — wraps `MantineProvider` with the Basalt theme, injects the `--vx-*` palette
 * stylesheet, and bridges Mantine's color scheme into the Vx chart theme context so chrome and
 * charts share one scheme-reactive identity.
 *
 * Grounded in argo: argo split this into `main.tsx` (the `MantineProvider` + `cssVariablesResolver`
 * wiring) and `charts-bridge.tsx` (the `VxBridge`: read the Mantine color scheme, provide the Vx
 * context, inject the palette `<style>`). Basalt folds the GENERIC half of both into one provider.
 * The DOMAIN half of argo's `main.tsx` — router, query client, app routes, auth gate, the concrete
 * series/sections — stays in the consumer and does NOT extract.
 *
 * The palette injection is pure CSS: the `<style>` emitted by `buildPaletteCss` keys off Mantine's
 * `[data-mantine-color-scheme]` attribute, so dark/light resolution needs no React re-render. The
 * Vx context still carries the resolved `colorScheme` for any non-color branching a chart may need.
 *
 * Mantine usage is allowed in this `./` root layer (unlike `src/charts/**` and `src/tokens/**`).
 */
import { MantineProvider, type MantineProviderProps, useComputedColorScheme } from '@mantine/core'
import type { ReactNode } from 'react'
import { VxThemeProvider } from '../charts/theme'
import { createBasaltTheme, cssVariablesResolver } from '../theme'
import { type BuildPaletteOpts, buildPaletteCss } from '../tokens'

export type BasaltProviderProps = {
  children: ReactNode
  /** Theme override merged onto the Basalt base. Omit to use the base theme as-is. */
  theme?: MantineProviderProps['theme']
  /**
   * Inject the `--vx-*` palette stylesheet once via an inline `<style>`. Default `true`. Set
   * `false` to skip it (SSR / head injection — emit `buildPaletteCss(paletteOptions)` yourself).
   */
  injectPalette?: boolean
  /**
   * Passed through to `buildPaletteCss` so a consumer can append its own series/groups/derived
   * declarations on top of the framework primitives. Additive extension to the S0 stub shape.
   */
  paletteOptions?: BuildPaletteOpts
  /** Default color scheme. Defaults to dark. */
  defaultColorScheme?: MantineProviderProps['defaultColorScheme']
} & Omit<MantineProviderProps, 'children' | 'theme' | 'defaultColorScheme'>

/**
 * Inner bridge — must render INSIDE `MantineProvider` to read the active color scheme. Provides
 * the Vx chart theme context and injects the palette `<style>`. Mirrors argo's `VxBridge`.
 */
function BasaltBridge({
  children,
  injectPalette,
  paletteOptions,
}: {
  children: ReactNode
  injectPalette: boolean
  paletteOptions: BuildPaletteOpts | undefined
}) {
  // Resolve via Mantine's computed scheme so 'auto' follows the OS prefers-color-scheme
  // (fallback 'dark' before hydration, matching the provider's defaultColorScheme).
  const resolved = useComputedColorScheme('dark')
  return (
    <VxThemeProvider colorScheme={resolved}>
      {injectPalette ? <style>{buildPaletteCss(paletteOptions)}</style> : null}
      {children}
    </VxThemeProvider>
  )
}

export function BasaltProvider({
  children,
  theme,
  injectPalette = true,
  paletteOptions,
  defaultColorScheme = 'dark',
  ...rest
}: BasaltProviderProps) {
  return (
    <MantineProvider
      theme={createBasaltTheme(theme)}
      cssVariablesResolver={cssVariablesResolver}
      defaultColorScheme={defaultColorScheme}
      {...rest}
    >
      <BasaltBridge injectPalette={injectPalette} paletteOptions={paletteOptions}>
        {children}
      </BasaltBridge>
    </MantineProvider>
  )
}
