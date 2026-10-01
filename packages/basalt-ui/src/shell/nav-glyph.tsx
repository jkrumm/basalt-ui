import type { ReactNode } from 'react'

/** `Intl.Segmenter` is in every supported runtime; the code-point split is the belt-and-braces fallback. */
const segmenter =
  typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : undefined

/** The first grapheme of a label — the fallback body for an item or action shipping no icon. */
export function initial(label: string): string {
  const first = segmenter
    ? segmenter.segment(label)[Symbol.iterator]().next().value?.segment
    : [...label][0]
  return first?.toUpperCase() ?? '?'
}

/** False for everything React renders as nothing — `cond && <Icon />` yields `false`, not `null`. */
export function hasIcon(icon: ReactNode): boolean {
  return icon !== null && icon !== undefined && typeof icon !== 'boolean' && icon !== ''
}

/**
 * The label's first grapheme as a decorative glyph. The collapsed rail and the landscape tab bar
 * show the icon ALONE, so an absent icon would render a nameless, empty target. `aria-hidden`: the
 * accessible name comes from the label, never the glyph.
 */
export function initialGlyph(label: string): ReactNode {
  return (
    <span aria-hidden data-nav-glyph>
      {initial(label)}
    </span>
  )
}

/** A nav item's icon, or its label's first-letter glyph when it ships none. */
export function iconOrInitial(icon: ReactNode, label: string): ReactNode {
  return hasIcon(icon) ? icon : initialGlyph(label)
}
