import type { ReactNode } from 'react'

/** The first grapheme of a label — the fallback body for an item or action shipping no icon. */
export function initial(label: string): string {
  return [...label][0]?.toUpperCase() ?? '?'
}

/**
 * A nav item's icon, or — when it ships none — the label's first grapheme as a decorative glyph.
 * The collapsed rail and the landscape tab bar show the icon ALONE, so a null icon would render a
 * nameless, empty target. `aria-hidden`: the accessible name comes from the label, never the glyph.
 */
export function iconOrInitial(icon: ReactNode, label: string): ReactNode {
  return (
    icon ?? (
      <span aria-hidden data-nav-glyph>
        {initial(label)}
      </span>
    )
  )
}
