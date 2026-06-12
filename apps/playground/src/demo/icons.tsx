/**
 * Inline stroke icons. The framework ships NO icon dependency — every `icon`/`copyIcon`/`resetIcon`
 * slot takes a `ReactNode`, so the consumer supplies its own. These are small Tabler-style 24x24
 * outline glyphs sized for the sidebar rail, settings menu, and theme-lab actions.
 */
import type { ReactNode } from 'react'

function Glyph({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  )
}

export function IconDashboard() {
  return (
    <Glyph>
      <path d="M4 4h6v8H4z" />
      <path d="M4 16h6v4H4z" />
      <path d="M14 4h6v4h-6z" />
      <path d="M14 12h6v8h-6z" />
    </Glyph>
  )
}

export function IconChart() {
  return (
    <Glyph>
      <path d="M4 19h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V8" />
      <path d="M17 16v-9" />
    </Glyph>
  )
}

export function IconActivity() {
  return (
    <Glyph>
      <path d="M3 12h4l3 8l4 -16l3 8h4" />
    </Glyph>
  )
}

export function IconSettings() {
  return (
    <Glyph>
      <path d="M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z" />
      <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
    </Glyph>
  )
}

export function IconCopy() {
  return (
    <Glyph size={16}>
      <path d="M8 8m0 2a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2z" />
      <path d="M16 8V6a2 2 0 0 0 -2 -2H6a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2" />
    </Glyph>
  )
}

export function IconReset() {
  return (
    <Glyph size={16}>
      <path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" />
      <path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" />
    </Glyph>
  )
}

export function IconComponents() {
  return (
    <Glyph>
      <path d="M3 12l3 3l3 -3l-3 -3z" />
      <path d="M15 12l3 3l3 -3l-3 -3z" />
      <path d="M9 6l3 3l3 -3l-3 -3z" />
      <path d="M9 18l3 3l3 -3l-3 -3z" />
    </Glyph>
  )
}

export function IconPalette() {
  return (
    <Glyph size={16}>
      <path d="M12 21a9 9 0 0 1 0 -18a9 8 0 0 1 9 8a4.5 4 0 0 1 -4.5 4h-2.5a2 2 0 0 0 -1 3.75a1.3 1.3 0 0 1 -1 2.25" />
      <path d="M7.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M12 7.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
      <path d="M16.5 10.5m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
    </Glyph>
  )
}
