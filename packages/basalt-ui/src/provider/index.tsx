/**
 * BasaltProvider — wraps `MantineProvider` with the Basalt theme and (in later stages) injects
 * the `--vx-*` palette stylesheet so charts + chrome share one scheme-reactive identity.
 *
 * S0: `injectPalette` is typed but a no-op placeholder; the palette injection (mounting the
 * `buildPaletteCss` output once) lands in S2. Mantine usage is allowed here.
 */
import { MantineProvider, type MantineProviderProps } from '@mantine/core'
import type { ReactNode } from 'react'
import { createBasaltTheme, cssVariablesResolver } from '../theme'

export type BasaltProviderProps = {
  children: ReactNode
  /** Theme override merged onto the Basalt base. Omit to use the base theme as-is. */
  theme?: MantineProviderProps['theme']
  /** Inject the `--vx-*` palette stylesheet once on mount. No-op placeholder in S0. */
  injectPalette?: boolean
  /** Default color scheme. Argo defaults to dark. */
  defaultColorScheme?: MantineProviderProps['defaultColorScheme']
} & Omit<MantineProviderProps, 'children' | 'theme' | 'defaultColorScheme'>

export function BasaltProvider({
  children,
  theme,
  injectPalette: _injectPalette = true,
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
      {children}
    </MantineProvider>
  )
}
