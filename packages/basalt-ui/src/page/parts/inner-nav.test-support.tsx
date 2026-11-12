/**
 * A test-local push field over the address bar: the structural stand-in for the controls layer's
 * handle (`value`, `set`, `isSet`, `link`). Writes `?<key>=<value>` with `history.pushState`, so a
 * Back walks the sections exactly as a router-backed push field would. Shared by the unit suites and
 * the layout fixture; never exported from the package.
 */
import { useSyncExternalStore } from 'react'
import type { InnerNavHandle } from './inner-nav'

const listeners = new Set<() => void>()
const notify = (): void => listeners.forEach((listener) => listener())
let wired = false

function subscribe(listener: () => void): () => void {
  if (!wired && typeof window !== 'undefined') {
    window.addEventListener('popstate', notify)
    wired = true
  }
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const search = (): string => (typeof window === 'undefined' ? '' : window.location.search)

export type PushDouble<K extends string> = InnerNavHandle<K> & {
  /** Every value written through `set` or a link click, in order. */
  readonly writes: K[]
}

export function pushField<K extends string>(
  values: readonly K[],
  fallback: K,
  key: string,
): PushDouble<K> {
  const raw = (): string | null => new URLSearchParams(search()).get(key)
  const hrefOf = (value: K): string => {
    const params = new URLSearchParams(search())
    params.set(key, value)
    return `?${params.toString()}`
  }
  const writes: K[] = []
  const go = (value: K): void => {
    writes.push(value)
    window.history.pushState(null, '', hrefOf(value))
    notify()
  }
  return {
    key,
    kind: 'enum',
    history: 'push',
    options: values.map((value) => ({ value, label: value })),
    writes,
    use: () => {
      const stored = useSyncExternalStore(subscribe, raw, () => null)
      const value = values.find((v) => v === stored) ?? fallback
      return [value, go]
    },
    useSource: () => ({ source: 'own', inherited: undefined }),
    clear: () => {
      const params = new URLSearchParams(search())
      params.delete(key)
      const query = params.toString()
      window.history.replaceState(null, '', query === '' ? window.location.pathname : `?${query}`)
      notify()
    },
    get isDefault() {
      return (raw() ?? fallback) === fallback
    },
    get isSet() {
      return raw() !== null
    },
    link: (value) => ({
      href: hrefOf(value),
      onClick: (event) => {
        event.preventDefault()
        go(value)
      },
    }),
  }
}
