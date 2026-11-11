import { useSyncExternalStore } from 'react'
import { SIZE_CLASSES, toEm } from '../tokens/size-classes'

/** The viewport classes: `compact` below 840 px, `medium` from it, `expanded` from 1200 px. */
export type SizeClass = keyof typeof SIZE_CLASSES

const MEDIUM = `(min-width: ${toEm(SIZE_CLASSES.medium)})`
const EXPANDED = `(min-width: ${toEm(SIZE_CLASSES.expanded)})`

// theme-allow raw-breakpoint — the page kit's one viewport read; every query goes through here
const list = (q: string): MediaQueryList | null => globalThis.window?.matchMedia?.(q) ?? null

function subscribe(notify: () => void): () => void {
  const lists = [list(MEDIUM), list(EXPANDED)].filter((l) => l !== null)
  for (const l of lists) l.addEventListener('change', notify)
  return () => {
    for (const l of lists) l.removeEventListener('change', notify)
  }
}

function read(): SizeClass {
  if (list(EXPANDED)?.matches === true) return 'expanded'
  return list(MEDIUM)?.matches === true ? 'medium' : 'compact'
}

const readServer = (): SizeClass => 'compact'

/**
 * The viewport class, `'compact' | 'medium' | 'expanded'`, for the one read CSS cannot make: which
 * of two components to mount (a docked aside or a sheet). The server and the hydration pass read
 * `'compact'`, so the markup always matches and the real class lands one commit later; a
 * client-rendered app reads it on its first render. Chrome only: a page lays out by container
 * (`CardGrid`), never by this.
 *
 * @useWhen frame chrome must mount one of two components by viewport width (a docked aside or a sheet)
 * @neverWhen the layout of page content changes with width (use a container tier, `CardGrid`) or only the look changes (use CSS)
 *
 * @example
 * const docked = useSizeClass() === 'expanded'
 * return docked ? <Inspector /> : <InspectorSheet />
 */
export function useSizeClass(): SizeClass {
  return useSyncExternalStore(subscribe, read, readServer)
}
