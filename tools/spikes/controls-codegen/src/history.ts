/**
 * A fake `window` for `createBrowserHistory` (no DOM in the harness) that counts what the browser
 * would see, plus a masking history modelled on argo's `private-history.ts` (written fresh, not
 * copied): the address bar shows only some params, the real href rides in `history.state`.
 */
import { createBrowserHistory } from '@tanstack/react-router'
import type { RouterHistory } from '@tanstack/react-router'

interface Entry {
  url: string
  state: Record<string, unknown> | null
}

export interface FakeWindow {
  /** Session-history entries, as the browser keeps them. */
  readonly entries: readonly Entry[]
  readonly pushes: number
  readonly replaces: number
  /** What the address bar shows now (path and query). */
  readonly address: string
  /** User agent back/forward: moves the index and fires `popstate`. */
  go(delta: number): void
  /** The object handed to `createBrowserHistory({ window })`. */
  readonly window: object
}

export function createFakeWindow(initialUrl: string): FakeWindow {
  const entries: Entry[] = [{ url: initialUrl, state: null }]
  const listeners = new Map<string, Set<() => void>>()
  let index = 0
  let pushes = 0
  let replaces = 0

  const current = (): URL => new URL(entries[index]?.url ?? '/', 'http://harness.invalid')
  const go = (delta: number): void => {
    const next = index + delta
    if (next < 0 || next >= entries.length) return
    index = next
    listeners.get('popstate')?.forEach((listener) => listener())
  }

  const window = {
    location: {
      get pathname() {
        return current().pathname
      },
      get search() {
        return current().search
      },
      get hash() {
        return current().hash
      },
    },
    history: {
      get state() {
        return entries[index]?.state ?? null
      },
      get length() {
        return entries.length
      },
      scrollRestoration: 'auto',
      pushState: (state: Entry['state'], _title: string, url?: string) => {
        entries.splice(index + 1)
        entries.push({ url: url ?? '/', state })
        index += 1
        pushes += 1
      },
      replaceState: (state: Entry['state'], _title: string, url?: string) => {
        entries[index] = { url: url ?? entries[index]?.url ?? '/', state }
        replaces += 1
      },
      back: () => go(-1),
      forward: () => go(1),
      go,
    },
    addEventListener: (type: string, listener: () => void) => {
      const set = listeners.get(type) ?? new Set()
      set.add(listener)
      listeners.set(type, set)
    },
    removeEventListener: (type: string, listener: () => void) => {
      listeners.get(type)?.delete(listener)
    },
  }

  return {
    entries,
    get pushes() {
      return pushes
    },
    get replaces() {
      return replaces
    },
    get address() {
      const url = current()
      return `${url.pathname}${url.search}`
    },
    go,
    window,
  }
}

export function plainHistory(fake: FakeWindow): RouterHistory {
  return createBrowserHistory({ window: fake.window as never })
}

// ----------------------------------------------------------------------------- masking history

const REAL_HREF = '__realHref'

/** Public form of a router href: only `visible` params survive in the query. */
export function publicHref(href: string, visible: ReadonlySet<string>): string {
  const queryAt = href.indexOf('?')
  if (queryAt === -1) return href
  const hashAt = href.indexOf('#')
  const queryEnd = hashAt === -1 ? href.length : hashAt
  const kept = href
    .slice(queryAt + 1, queryEnd)
    .split('&')
    .filter((pair) => pair !== '' && visible.has(decodeURIComponent(pair.split('=')[0] ?? '')))
  const query = kept.length === 0 ? '' : `?${kept.join('&')}`
  return `${href.slice(0, queryAt)}${query}${hashAt === -1 ? '' : href.slice(hashAt)}`
}

export function maskingHistory(fake: FakeWindow, visible: ReadonlySet<string>): RouterHistory {
  const win = fake.window as {
    location: { pathname: string; search: string; hash: string }
    history: { state: Record<string, unknown> | null }
  }
  const history = createBrowserHistory({
    window: win as never,
    createHref: (href) => publicHref(href, visible),
    parseLocation: () => {
      const state = win.history.state ?? {}
      const real = state[REAL_HREF]
      const href =
        typeof real === 'string'
          ? real
          : `${win.location.pathname}${win.location.search}${win.location.hash}`
      const url = new URL(href, 'http://harness.invalid')
      return {
        href,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        state: state as never,
      }
    },
  })
  const withReal = (href: string, state: unknown) => {
    const next = { ...(state as Record<string, unknown> | undefined) }
    if (publicHref(href, visible) === href) delete next[REAL_HREF]
    else next[REAL_HREF] = href
    return next
  }
  const { push, replace } = history
  history.push = (href, state, options) => push(href, withReal(href, state), options)
  history.replace = (href, state, options) => replace(href, withReal(href, state), options)
  return history
}
