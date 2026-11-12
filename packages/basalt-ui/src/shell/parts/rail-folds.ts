/**
 * The persisted section folds. Each collapsible section owns one `persisted` store under
 * `basalt:sidebar-section:<id>` (the `{ v: 1, value: boolean }` envelope of 2.x), so a stored fold
 * survives a reload. The hook reads every store through ONE external-store subscription, since the
 * number of sections is data and hooks cannot be looped.
 *
 * Only a key that holds an accepted value is reported: a section nobody has toggled keeps its
 * `defaultCollapsed` (the projector falls back to it). The server and the hydration pass report
 * none, so the markup always matches.
 */
import { useSyncExternalStore } from 'react'
import { persisted } from '../../core/persisted'
import type { Persisted } from '../../core/persisted'
import { FOLD_VERSION, sectionFoldKey } from '../core/block-model'

const storeOf = (id: string): Persisted<boolean> =>
  persisted<boolean>(sectionFoldKey(id), { version: FOLD_VERSION, initial: false })

/** Writes one section's fold. */
export function setSectionFold(id: string, folded: boolean): void {
  storeOf(id).set(folded)
}

/** JSON of the `[id, folded]` pairs that hold a stored fold: a stable string snapshot of every store. */
function snapshot(ids: readonly string[]): string {
  const pairs: Array<[string, boolean]> = []
  for (const id of ids) {
    const store = storeOf(id)
    if (store.isSet()) pairs.push([id, store.get()])
  }
  return JSON.stringify(pairs)
}

/** The stored folds of the given collapsible section ids. */
export function useSectionFolds(ids: readonly string[]): Record<string, boolean> {
  const encoded = useSyncExternalStore(
    (listener) => {
      const offs = ids.map((id) => storeOf(id).subscribe(listener))
      return () => {
        for (const off of offs) off()
      }
    },
    () => snapshot(ids),
    () => '[]',
  )
  return Object.fromEntries(JSON.parse(encoded) as Array<[string, boolean]>)
}
