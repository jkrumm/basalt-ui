/**
 * `settled()`: resolves when the app has stopped moving, so an assertion reads a still tree.
 *
 * Three things move after a render: the router (a navigation or loader in flight), queries (a fetch
 * or mutation in flight) and Base UI (a popup mounts on the next frame and settles on the one after).
 * `settled` waits for all three. It flushes whatever React queued inside `act`, so no "not wrapped
 * in act" warning reaches the console, and it polls on real timers: it is not fake-timer aware.
 *
 * Router and query client are passed in rather than found: the kit imports neither peer, so a
 * consumer with no router pays nothing and `settled()` alone is the Base UI mount tick. `act` is
 * React's own (React 19 exports it), so the module needs no Testing Library import and the
 * subpath has no peer of its own.
 */
import { act } from 'react'

/** The part of a TanStack Router `router` that `settled` reads. */
export type SettledRouter = {
  readonly state: { readonly isLoading: boolean; readonly isTransitioning?: boolean }
}

/** The part of a TanStack Query `QueryClient` that `settled` reads. */
export type SettledQueryClient = {
  isFetching(): number
  isMutating(): number
}

export type SettledOptions = {
  /** Also wait for this router to finish loading and transitioning. */
  router?: SettledRouter
  /** Also wait for this client to have no fetch or mutation in flight. */
  queryClient?: SettledQueryClient
  /** Give up after this many milliseconds with an error naming what is still pending. Default 5000. */
  timeoutMs?: number
}

/** React reads this flag to decide whether an `act` call is expected; a test runner rarely sets it itself. */
const flag = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean | undefined }

/** One macrotask, then one animation frame where the runtime has one: Base UI mounts on the next frame. */
function tick(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve())
      else resolve()
    }, 0)
  })
}

function pending(options: SettledOptions): string[] {
  const list: string[] = []
  const { router, queryClient } = options
  if (router?.state.isLoading === true) list.push('router loading')
  if (router?.state.isTransitioning === true) list.push('router transitioning')
  if (queryClient !== undefined) {
    const fetching = queryClient.isFetching()
    const mutating = queryClient.isMutating()
    if (fetching > 0) list.push(`${fetching} queries fetching`)
    if (mutating > 0) list.push(`${mutating} mutations in flight`)
  }
  return list
}

/**
 * Awaits at least one mount tick, then keeps ticking until the router and query client (when given)
 * are idle. Always ends on a tick that found nothing pending, so a state change the last request
 * scheduled has rendered by the time it resolves.
 *
 * @useWhen a test must read the tree after a popup opened, a navigation ran or a query settled
 * @neverWhen the test uses fake timers (it polls real ones), or a `findBy*` on the one element is enough
 *
 * @example
 * fireEvent.click(trigger)
 * await settled({ queryClient })
 */
export async function settled(options: SettledOptions = {}): Promise<void> {
  const deadline = Date.now() + (options.timeoutMs ?? 5000)
  let waiting: string[] = []
  do {
    if (Date.now() > deadline) {
      throw new Error(`settled() timed out with work pending: ${waiting.join(', ')}`)
    }
    const previous = flag.IS_REACT_ACT_ENVIRONMENT
    flag.IS_REACT_ACT_ENVIRONMENT = true
    try {
      await act(tick)
    } finally {
      flag.IS_REACT_ACT_ENVIRONMENT = previous
    }
    waiting = pending(options)
  } while (waiting.length > 0)
}
