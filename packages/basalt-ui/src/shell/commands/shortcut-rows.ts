/**
 * The shortcut list as data: every command with a chord that works where focus is now, grouped.
 * Pure, so the overlay and its test read the same function. The source is the set's entries plus the
 * nav's chords, the same two the palette's key listener binds, so a chord that fires is a chord listed.
 */
import type { Chord } from './chord'
import { parseChordSequence } from './chord'
import type { NavCommand } from './nav-commands'
import type { PaletteItem } from './rank'

export type ShortcutRow = {
  readonly id: string
  readonly label: string
  readonly steps: readonly Chord[]
}
export type ShortcutGroup = { readonly name: string; readonly rows: readonly ShortcutRow[] }

type Source = Pick<PaletteItem, 'id' | 'label' | 'group' | 'steps' | 'area' | 'enabled'>

/** The nav's chorded destinations as shortcut sources. */
export function navShortcutSources(navItems: readonly NavCommand[]): Source[] {
  return navItems.flatMap((cmd) =>
    cmd.chord === undefined
      ? []
      : [{ id: cmd.id, label: cmd.label, group: cmd.group, steps: parseChordSequence(cmd.chord) }],
  )
}

/**
 * Groups the sources that have a chord, are enabled and fire in `area` (global ones and the area's
 * own). A group is the command's `group`, else its `area`, else `General`; groups and rows keep
 * declaration order. A `listed: false` command is still here: the palette hides it, the key works.
 */
export function shortcutGroups(
  sources: readonly Source[],
  area: string | undefined,
): ShortcutGroup[] {
  const groups = new Map<string, ShortcutRow[]>()
  for (const source of sources) {
    if (source.steps.length === 0) continue
    if (source.area !== undefined && source.area !== area) continue
    if (source.enabled?.() === false) continue
    const name = source.group ?? source.area ?? 'General'
    const rows = groups.get(name) ?? []
    rows.push({ id: source.id, label: source.label, steps: source.steps })
    groups.set(name, rows)
  }
  return [...groups].map(([name, rows]) => ({ name, rows }))
}
