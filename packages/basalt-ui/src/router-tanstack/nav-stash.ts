/**
 * The nav definition's runtime stash and its flatten reader, as a leaf (types only from `./nav`):
 * `defineNav` fills it; Spotlight's action builder, the route transitions and the provider read it.
 * Kept apart from `nav.ts` so no reader imports the module that registers the Spotlight mount.
 */
import type { AnyNavGroup, AnyNavItem } from './nav'

/**
 * The runtime stash `defineNav` fills (the last call wins, like `defineCommands`), read by
 * `BasaltProvider` to project the nav into Spotlight. Type augmentation is erased, so this is the
 * live source.
 *
 * @internal
 */
let activeNav: { groups: ReadonlyArray<AnyNavGroup> } | undefined

/** @internal */
export function getActiveNav(): { groups: ReadonlyArray<AnyNavGroup> } | undefined {
  return activeNav
}

/** @internal — `defineNav` only. The last call wins. */
export function setActiveNav(nav: { groups: ReadonlyArray<AnyNavGroup> }): void {
  activeNav = nav
}

/** A flattened destination, tagged with the group it was declared in. */
export type FlatNavItem = AnyNavItem & { groupId: string; groupLabel: string }

/** Depth-first flatten, parent then children — the leaf every other surface reads. */
export function flattenNav(config: { groups: ReadonlyArray<AnyNavGroup> }): FlatNavItem[] {
  const out: FlatNavItem[] = []
  const walk = (items: ReadonlyArray<AnyNavItem>, groupId: string, groupLabel: string): void => {
    for (const item of items) {
      out.push({ ...item, groupId, groupLabel })
      if (item.children) walk(item.children, groupId, groupLabel)
    }
  }
  for (const g of config.groups) walk(g.items, g.id, g.label)
  return out
}
