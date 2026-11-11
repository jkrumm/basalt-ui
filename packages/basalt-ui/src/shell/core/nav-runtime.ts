/**
 * `NavRuntime`: the one seam between the router and the shell core. Internal, never exported from
 * `basalt-ui/shell`.
 *
 * The projector never reads a router. It reads the declared nav and the active state through this
 * interface, so the rail, the tab bar and the header are unit-testable with no router, no React
 * and no DOM. The frame (`AppShell`) builds the production runtime from the router's location and
 * the active resolver of `src/router/nav`, injected as `resolve`; a test builds the double and sets
 * the active item by hand.
 *
 * Both are tiny external stores, so a part reads them with
 * `useSyncExternalStore(runtime.subscribe, runtime.getState)`.
 */
import type { CoreNavConfig } from './types'

/** The active destination, as the resolver of `src/router/nav` returns it. */
export type NavState = {
  /** At most one item is active; only it carries `aria-current`. */
  readonly activeId: string | undefined
  /** Items on the children-tree path above the active one. On the path, never active. */
  readonly ancestorIds: ReadonlySet<string>
}

export interface NavRuntime {
  readonly nav: CoreNavConfig
  /** Referentially stable until the active item or its ancestors change. */
  getState: () => NavState
  subscribe: (listener: () => void) => () => void
}

/** The production runtime: the router feeds pathnames, `resolve` turns each into a `NavState`. */
export type LocationNavRuntime = NavRuntime & { setPathname: (pathname: string) => void }

/** The test double: the active item is set directly. */
export type NavRuntimeDouble = NavRuntime & {
  setActive: (activeId: string | undefined, ancestorIds?: Iterable<string>) => void
}

const EMPTY: NavState = { activeId: undefined, ancestorIds: new Set() }

const stateOf = (id: string | undefined, ancestors: Iterable<string>): NavState =>
  id === undefined ? EMPTY : { activeId: id, ancestorIds: new Set(ancestors) }

function sameState(a: NavState, b: NavState): boolean {
  if (a.activeId !== b.activeId || a.ancestorIds.size !== b.ancestorIds.size) return false
  for (const id of a.ancestorIds) if (!b.ancestorIds.has(id)) return false
  return true
}

function createStore(nav: CoreNavConfig, initial: NavState) {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    runtime: {
      nav,
      getState: () => state,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    } satisfies NavRuntime,
    set(next: NavState): void {
      if (sameState(state, next)) return
      state = next
      for (const listener of listeners) listener()
    },
  }
}

export function createNavRuntime(options: {
  nav: CoreNavConfig
  resolve: (pathname: string) => NavState
  pathname: string
}): LocationNavRuntime {
  const { nav, resolve, pathname } = options
  const store = createStore(nav, resolve(pathname))
  return { ...store.runtime, setPathname: (next) => store.set(resolve(next)) }
}

export function createNavRuntimeDouble(
  nav: CoreNavConfig,
  activeId?: string,
  ancestorIds: Iterable<string> = [],
): NavRuntimeDouble {
  const store = createStore(nav, stateOf(activeId, ancestorIds))
  return {
    ...store.runtime,
    setActive: (id, ancestors = []) => store.set(stateOf(id, ancestors)),
  }
}
