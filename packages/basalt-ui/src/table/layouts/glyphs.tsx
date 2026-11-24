/**
 * The glyphs of the built-in layouts: drawn in the shipped icon's 16 px box and 1.5 px stroke, so an
 * app's own layout icon sits beside them in the toggle.
 */
import type { IconComponent } from '../../core/ports'

type GlyphProps = Parameters<IconComponent>[0]

const glyph =
  (paths: readonly string[]): IconComponent =>
  ({ className }: GlyphProps) => (
    <svg viewBox="0 0 16 16" className={className ?? 'size-icon'} fill="none" aria-hidden="true">
      {paths.map((d) => (
        <path
          key={d}
          d={d}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )

/** Rows under a head. */
export const TableGlyph = glyph(['M2.5 3.5h11v9h-11z', 'M2.5 6.5h11', 'M2.5 9.5h11', 'M6 6.5v6'])
/** Lines with a mark at their start. */
export const ListGlyph = glyph([
  'M5.5 4h8',
  'M5.5 8h8',
  'M5.5 12h8',
  'M2.5 4h.5',
  'M2.5 8h.5',
  'M2.5 12h.5',
])
/** Three columns of unequal height. */
export const BoardGlyph = glyph(['M2.5 2.5h3v9h-3z', 'M6.5 2.5h3v6h-3z', 'M10.5 2.5h3v11h-3z'])
/** A grid of four cards. */
export const GalleryGlyph = glyph([
  'M2.5 2.5h4.5v4.5h-4.5z',
  'M9 2.5h4.5v4.5h-4.5z',
  'M2.5 9h4.5v4.5h-4.5z',
  'M9 9h4.5v4.5h-4.5z',
])
