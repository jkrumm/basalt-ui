import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

type ColorScheme = 'light' | 'dark'

export type VxTheme = {
  colorScheme: ColorScheme
  line: string
  line2: string
  axis: string
  axisStroke: string
  tooltipBg: string
  tooltipText: string
  tooltipMuted: string
  tooltipBorder: string
  tooltipShadow: string
}

/**
 * Theme-resolved neutrals are now CSS custom properties (see the token layer). They resolve per
 * Mantine color scheme in CSS, so these are static var refs — the provider keeps `colorScheme`
 * only for any non-color branching a chart may need.
 */
const REFS = {
  line: 'var(--vx-line)',
  line2: 'var(--vx-line2)',
  axis: 'var(--vx-axis)',
  axisStroke: 'var(--vx-axis-stroke)',
  tooltipBg: 'var(--vx-tooltip-bg)',
  tooltipText: 'var(--vx-tooltip-text)',
  tooltipMuted: 'var(--vx-tooltip-muted)',
  tooltipBorder: 'var(--vx-tooltip-border)',
  tooltipShadow: 'var(--vx-tooltip-shadow)',
} as const

const VxThemeContext = createContext<VxTheme | null>(null)

export function VxThemeProvider({
  colorScheme,
  children,
}: {
  colorScheme: ColorScheme
  children: ReactNode
}) {
  const value = useMemo<VxTheme>(() => ({ colorScheme, ...REFS }), [colorScheme])
  return <VxThemeContext.Provider value={value}>{children}</VxThemeContext.Provider>
}

export function useVxTheme(): VxTheme {
  const ctx = useContext(VxThemeContext)
  if (!ctx) throw new Error('useVxTheme must be used inside <VxThemeProvider>')
  return ctx
}
