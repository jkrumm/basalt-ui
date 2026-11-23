/**
 * The ai parts' own glyphs, drawn in the 16 px box and 1.5 px stroke of the shipped icons, so the
 * subpath needs no icon package.
 */
import type { ReactElement, ReactNode } from 'react'

function Glyph({ children }: { children: ReactNode }): ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-icon shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const PlusGlyph = (): ReactElement => (
  <Glyph>
    <path d="M8 3v10M3 8h10" />
  </Glyph>
)

export const AtGlyph = (): ReactElement => (
  <Glyph>
    <circle cx="8" cy="8" r="2.5" />
    <path d="M10.5 8v1a1.75 1.75 0 0 0 3.5 0V8a6 6 0 1 0-2.4 4.8" />
  </Glyph>
)

export const SendGlyph = (): ReactElement => (
  <Glyph>
    <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
  </Glyph>
)

export const StopGlyph = (): ReactElement => (
  <svg viewBox="0 0 16 16" className="size-icon shrink-0" fill="currentColor" aria-hidden="true">
    <rect x="4" y="4" width="8" height="8" rx="1.5" />
  </svg>
)

export const RegenerateGlyph = (): ReactElement => (
  <Glyph>
    <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.5v3h-3" />
  </Glyph>
)

export const EditGlyph = (): ReactElement => (
  <Glyph>
    <path d="M10.5 3.5l2 2L6 12H4v-2l6.5-6.5Z" />
  </Glyph>
)

export const GoodGlyph = (): ReactElement => (
  <Glyph>
    <path d="M5 7v6H3V7h2Zm0 0 2.5-4.5a1.5 1.5 0 0 1 1.5 1.5V6h3a1 1 0 0 1 1 1.2l-1 5a1 1 0 0 1-1 .8H5" />
  </Glyph>
)

export const BadGlyph = (): ReactElement => (
  <Glyph>
    <path d="M5 9V3H3v6h2Zm0 0 2.5 4.5A1.5 1.5 0 0 0 9 12v-2h3a1 1 0 0 0 1-1.2l-1-5a1 1 0 0 0-1-.8H5" />
  </Glyph>
)

export const CloseGlyph = (): ReactElement => (
  <Glyph>
    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
  </Glyph>
)

export const FileGlyph = (): ReactElement => (
  <Glyph>
    <path d="M9 2.5H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-7l-3-3Zm0 0v3h3" />
  </Glyph>
)

export const ChevronGlyph = ({ open = false }: { open?: boolean }): ReactElement => (
  <Glyph>
    <path d={open ? 'M4.5 6.5 8 10l3.5-3.5' : 'M6.5 4.5 10 8l-3.5 3.5'} />
  </Glyph>
)
