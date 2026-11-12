/**
 * The nav as a command source: every `defineNav` item is a palette row, and the first nine
 * top-level items (sections in order, then `pinned`) carry `Mod+1`..`Mod+9`. This is the one place
 * the order is read, so the chords, the palette and anything else that numbers the nav agree.
 */
import { flattenNavEntries } from '../../router/nav/resolve-active'
import type { AnyNavConfig, AnyNavItem } from '../../router/nav/types'
import { NAV_CHORD_COUNT } from './define-commands'

export type NavCommand = {
  readonly id: string
  readonly label: string
  /** `Mod+1`..`Mod+9`, for the first nine top-level items. */
  readonly chord: string | undefined
  readonly group: string
  readonly item: AnyNavItem
}

/** The nav's destinations in `defineNav` order; a disabled item is left out. */
export function navCommands(nav: AnyNavConfig): NavCommand[] {
  let topLevel = 0
  const out: NavCommand[] = []
  for (const { item, ancestors } of flattenNavEntries(nav)) {
    const isTop = ancestors.length === 0
    const position = isTop ? topLevel++ : -1
    if (item.disabled === true) continue
    const trail = [...ancestors, item].map((entry) => entry.label).join(' / ')
    out.push({
      id: `nav.${item.id}`,
      label: `Go to ${trail}`,
      chord: isTop && position < NAV_CHORD_COUNT ? `Mod+${position + 1}` : undefined,
      group: 'Navigate',
      item,
    })
  }
  return out
}
