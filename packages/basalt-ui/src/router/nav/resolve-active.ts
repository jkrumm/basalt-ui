/**
 * The active-item resolver: pure, no router, no React.
 *
 * Matching. An item matches the pathname via, in order:
 *   1. `activeWhen({ pathname })` when given (counts as an equality hit: the author claimed it);
 *   2. otherwise path equality when `exact` is set or `to === '/'` (`'/'` matches ONLY `'/'`);
 *   3. otherwise a segment-boundary prefix match (`/a` matches `/a` and `/a/b`, never `/ab`).
 * `to` is a route TEMPLATE: a `$param` segment matches any one non-empty segment and a trailing `$`
 * splat matches the rest. A `$param` the link pins through `link.params` (a string or number)
 * matches only that value, so sibling items on one param route do not tie.
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

/** A nav item in definition order, with the chain of items above it and its section's label (none for `pinned`). */
export type FlatNavEntry = {
  item: AnyNavItem
  ancestors: readonly AnyNavItem[]
  section: string | undefined
}

/** Depth-first, parent before children: sections' items, then pinned. */
export function flattenNavEntries(nav: AnyNavConfig): FlatNavEntry[] {
  const out: FlatNavEntry[] = []
  const walk = (
    items: ReadonlyArray<AnyNavItem>,
    ancestors: readonly AnyNavItem[],
    section: string | undefined,
  ): void => {
    for (const item of items) {
      out.push({ item, ancestors, section })
      if (item.children) walk(item.children, [...ancestors, item], section)
    }
  }
  for (const section of nav.sections) walk(section.items, [], section.label)
  if (nav.pinned) walk(nav.pinned, [], undefined)
  return out
}

const segmentsOf = (path: string): string[] => path.split('/').filter(Boolean)

function decodeSegment(seg: string | undefined): string | undefined {
  if (seg === undefined) return undefined
  try {
    return decodeURIComponent(seg)
  } catch {
    return seg
  }
}

type Hit = 'equal' | 'prefix' | undefined

/** A `$name` segment the link pins through `link.params` is that value; every other `$` segment stays a wildcard. */
function pinnedSegment(seg: string, params: unknown): string | undefined {
  if (seg === '$' || !seg.startsWith('$')) return undefined
  if (typeof params !== 'object' || params === null) return undefined
  const value = (params as Record<string, unknown>)[seg.slice(1)]
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

function matchPath(item: AnyNavItem, pathname: string): Hit {
  const template = segmentsOf(item.link.to)
  const path = segmentsOf(pathname)
  const splat = template.at(-1) === '$'
  const fixed = splat ? template.slice(0, -1) : template
  if (path.length < fixed.length) return undefined
  const head = fixed.every((seg, i) => {
    const pinned = pinnedSegment(seg, item.link.params)
    if (pinned !== undefined) return pinned === decodeSegment(path[i])
    return seg.startsWith('$') || seg === path[i]
  })
  if (!head) return undefined
  if (splat || path.length === fixed.length) return 'equal'
  if (item.exact === true || item.link.to === '/') return undefined
  return 'prefix'
}

function hitOf(item: AnyNavItem, pathname: string): Hit {
  if (item.activeWhen) return item.activeWhen({ pathname }) ? 'equal' : undefined
  return matchPath(item, pathname)
}

/** The pathname with each segment decoded, so paths compare as the resolver matches them. */
export function decodePath(pathname: string): string {
  return `/${segmentsOf(pathname)
    .map((seg) => decodeSegment(seg) ?? seg)
    .join('/')}`
}

/**
 * The decoded path an item links to, read against the pathname: a `$param` its link pins is that
 * value, an unpinned one takes the pathname's segment. `undefined` for a splat or a template longer
 * than the pathname. The breadcrumb compares it with the pathname's prefixes.
 */
export function navItemPath(
  item: { readonly link: { readonly to: string; readonly params?: unknown } },
  pathname: string,
): string | undefined {
  const template = segmentsOf(item.link.to)
  const path = segmentsOf(pathname)
  if (template.length > path.length || template.includes('$')) return undefined
  return `/${template
    .map((seg, i) => {
      if (!seg.startsWith('$')) return seg
      return pinnedSegment(seg, item.link.params) ?? decodeSegment(path[i]) ?? ''
    })
    .join('/')}`
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
