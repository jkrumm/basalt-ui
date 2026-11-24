import type { ReactElement } from 'react'

/** The site parts' inline glyphs: 16px, stroke follows the text color, hidden from assistive tech. */
const PATHS = {
  sun: 'M8 2.5v1M8 12.5v1M2.5 8h1M12.5 8h1M4.1 4.1l.7.7M11.2 11.2l.7.7M4.1 11.9l.7-.7M11.2 4.8l.7-.7M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
  moon: 'M13 9.5A5.5 5.5 0 0 1 6.5 3a5.5 5.5 0 1 0 6.5 6.5Z',
  system: 'M2.5 3.5h11v7h-11zM6 13.5h4M8 10.5v3',
  menu: 'M2.5 4.5h11M2.5 8h11M2.5 11.5h11',
  close: 'M4 4l8 8M12 4l-8 8',
  copy: 'M5.5 5.5h7v8h-7zM10.5 5.5v-1A1.5 1.5 0 0 0 9 3H4.5A1.5 1.5 0 0 0 3 4.5v6A1.5 1.5 0 0 0 4.5 12h1',
  check: 'M3.5 8.5l3 3 6-7',
  chevron: 'M6 4l4 4-4 4',
  dash: 'M4.5 8h7',
} as const

export type GlyphName = keyof typeof PATHS

export function Glyph({ name, className }: { name: GlyphName; className?: string }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className ?? 'size-4 shrink-0'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
