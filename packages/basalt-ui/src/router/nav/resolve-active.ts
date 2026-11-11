/**
 * The active-item resolver: pure, no router, no React.
 *
 * Matching. An item matches the pathname via, in order:
 *   1. `activeWhen({ pathname })` when given (counts as an equality hit: the author claimed it);
 *   2. otherwise path equality when `exact` is set or `to === '/'` (`'/'` matches ONLY `'/'`);
 *   3. otherwise a segment-boundary prefix match (`/a` matches `/a` and `/a/b`, never `/ab`).
 * `to` is a route TEMPLATE: a `$param` segment matches any one non-empty segment and a trailing `$`
 * splat matches the rest.
 *
 * Winner. Highest specificity (segment count of `to`), then an equality hit over a prefix hit, then
 * the first in definition order (sections, then pinned, depth-first, parent before children). At
 * most one item is ever active.
 *
 * Ancestors are the items on the children-tree path above the winner. They are on the path, not
 * active: they never carry `aria-current`.
 */
import type { AnyNavConfig, AnyNavItem } from './types'

export type ActiveNav = {
  activeId: string | undefined
  ancestorIds: ReadonlySet<string>
}

/** A nav item in definition order, with the chain of items above it. */
export type FlatNavEntry = { item: AnyNavItem; ancestors: readonly AnyNavItem[] }

/** Depth-first, parent before children: sections' items, then pinned. */
export function flattenNavEntries(nav: AnyNavConfig): FlatNavEntry[] {
  const out: FlatNavEntry[] = []
  const walk = (items: ReadonlyArray<AnyNavItem>, ancestors: readonly AnyNavItem[]): void => {
    for (const item of items) {
      out.push({ item, ancestors })
      if (item.children) walk(item.children, [...ancestors, item])
    }
  }
  for (const section of nav.sections) walk(section.items, [])
  if (nav.pinned) walk(nav.pinned, [])
  return out
}

const segmentsOf = (path: string): string[] => path.split('/').filter(Boolean)

type Hit = 'equal' | 'prefix' | undefined

function matchPath(item: AnyNavItem, pathname: string): Hit {
  const template = segmentsOf(item.link.to)
  const path = segmentsOf(pathname)
  const splat = template.at(-1) === '$'
  const fixed = splat ? template.slice(0, -1) : template
  if (path.length < fixed.length) return undefined
  const head = fixed.every((seg, i) => seg.startsWith('$') || seg === path[i])
  if (!head) return undefined
  if (splat || path.length === fixed.length) return 'equal'
  if (item.exact === true || item.link.to === '/') return undefined
  return 'prefix'
}

function hitOf(item: AnyNavItem, pathname: string): Hit {
  if (item.activeWhen) return item.activeWhen({ pathname }) ? 'equal' : undefined
  return matchPath(item, pathname)
}

const specificity = (item: AnyNavItem): number => segmentsOf(item.link.to).length

export function resolveActive(nav: AnyNavConfig, pathname: string): ActiveNav {
  let winner: FlatNavEntry | undefined
  let winnerRank: [number, number] | undefined
  for (const entry of flattenNavEntries(nav)) {
    const hit = hitOf(entry.item, pathname)
    if (!hit) continue
    const rank: [number, number] = [specificity(entry.item), hit === 'equal' ? 1 : 0]
    const beats =
      winnerRank === undefined ||
      rank[0] > winnerRank[0] ||
      (rank[0] === winnerRank[0] && rank[1] > winnerRank[1])
    if (!beats) continue
    winner = entry
    winnerRank = rank
  }
  return {
    activeId: winner?.item.id,
    ancestorIds: new Set(winner?.ancestors.map((a) => a.id)),
  }
}
