/**
 * The palette's default ranking: four tiers on the label (prefix, word start, substring, subsequence),
 * the keywords one tier below, ties keeping declaration order. The palette takes any function of
 * this shape as `rank`, so an app can rank by recency or by route without touching the palette.
 */
import type { CommandEntry } from './define-commands'

/** A row of the palette: a declared command, a built-in or a nav destination. */
export type PaletteItem = Pick<
  CommandEntry,
  | 'id'
  | 'label'
  | 'group'
  | 'keywords'
  | 'icon'
  | 'parsed'
  | 'chord'
  | 'area'
  | 'enabled'
  | 'listed'
  | 'run'
>

/** Orders and filters the palette's items for a query. An empty query arrives as `''`. */
export type RankFn = (query: string, items: readonly PaletteItem[]) => readonly PaletteItem[]

function tier(text: string, query: string): number {
  const at = text.indexOf(query)
  if (at === 0) return 4
  if (at > 0 && /[\s\-_./:]/.test(text.charAt(at - 1))) return 3
  if (at > 0) return 2
  let from = 0
  for (const char of query) {
    from = text.indexOf(char, from) + 1
    if (from === 0) return 0
  }
  return 1
}

function score(item: PaletteItem, query: string): number {
  const label = tier(item.label.toLowerCase(), query)
  // Keywords can only lift an item that the label missed, and never above a substring hit.
  const keyword = Math.max(0, ...(item.keywords ?? []).map((k) => tier(k.toLowerCase(), query)))
  return label > 0 ? label * 2 : Math.min(keyword, 3)
}

/**
 * The default `rank`: `dep` finds "Deploy now" before "Go to Deployments" because the label starts
 * with it; `dsh` finds "Dashboard" as a subsequence.
 *
 * @example
 * <CommandPalette commands={COMMANDS} rank={(q, items) => defaultRank(q, items).slice(0, 8)} />
 */
export const defaultRank: RankFn = (query, items) => {
  const needle = query.trim().toLowerCase()
  if (needle === '') return items
  return items
    .map((item, index) => ({ item, index, score: score(item, needle) }))
    .filter((row) => row.score > 0)
    .toSorted((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item)
}
