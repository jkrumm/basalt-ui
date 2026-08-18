import { createContext, useContext, useMemo, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { CursorState, CursorStore } from './store'
import { createCursorStore, EMPTY_CURSOR, globalCursorStore } from './store'

const CursorStoreContext = createContext<CursorStore>(globalCursorStore)

export type ChartCursorScopeProps = {
  children: ReactNode
}

/**
 * ISOLATES its subtree onto a private cursor store — the inverse of the removed `ChartHoverSync`, which
 * had to be mounted to enable sharing at all. Charts share a cursor by default now; wrap a group
 * in this only when it must NOT follow the rest of the page (e.g. two independent dashboards
 * rendered side by side over the same calendar).
 */
export function ChartCursorScope({ children }: ChartCursorScopeProps) {
  const store = useMemo(() => createCursorStore(), [])
  return <CursorStoreContext.Provider value={store}>{children}</CursorStoreContext.Provider>
}

/** The cursor store this chart belongs to — the nearest `ChartCursorScope`, else the global one. */
export function useCursorStore(): CursorStore {
  return useContext(CursorStoreContext)
}

/** Subscribe to the ambient cursor. Re-renders only on an actual cursor change. */
export function useCursorState(): CursorState {
  const store = useCursorStore()
  return useSyncExternalStore(store.subscribe, store.get, () => EMPTY_CURSOR)
}
