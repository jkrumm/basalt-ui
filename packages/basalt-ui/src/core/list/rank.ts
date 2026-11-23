/**
 * The one ranking of every list: four tiers on the label (prefix, word start, substring,
 * subsequence), the keywords one tier below, ties keeping declaration order. `Combobox`, a searchable
 * `Select` and the command palette take any function of this shape as `rank`, so an app can rank by
 * recency or by route without touching the list.
 */
import type { ReactNode } from 'react'

/** What a rank reads from a row: its label (text only; a node label ranks by its keywords) and keywords. */
export type Rankable = {
  label: ReactNode
  keywords?: readonly string[] | undefined
}

/** Orders and filters rows for a query. An empty query arrives as `''`. */
export type RankFn<Item extends Rankable = Rankable> = (
  query: string,
  items: readonly Item[],
) => readonly Item[]

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

/** The text a label ranks by: a string or a number; any other node ranks by its keywords alone. */
export function labelText(label: ReactNode): string {
  return typeof label === 'string' || typeof label === 'number' ? String(label) : ''
}

function score(item: Rankable, query: string): number {
  const text = labelText(item.label)
  const label = text === '' ? 0 : tier(text.toLowerCase(), query)
  // Keywords can only lift an item that the label missed, and never above a substring hit.
  const keyword = Math.max(0, ...(item.keywords ?? []).map((k) => tier(k.toLowerCase(), query)))
  return label > 0 ? label * 2 : Math.min(keyword, 3)
}

/**
 * The default `rank`: `dep` finds "Deploy now" before "Go to Deployments" because the label starts
 * with it; `dsh` finds "Dashboard" as a subsequence.
 *
 * @example
 * <Combobox aria-label="Owner" options={people} rank={(q, rows) => defaultRank(q, rows).slice(0, 8)} />
 */
export function defaultRank<Item extends Rankable>(
  query: string,
  items: readonly Item[],
): readonly Item[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return items
  return items
    .map((item, index) => ({ item, index, score: score(item, needle) }))
    .filter((row) => row.score > 0)
    .toSorted((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item)
}
