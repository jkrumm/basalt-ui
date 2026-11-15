/**
 * The shell's route accessibility: the skip link, the polite route announcer and the document title.
 * Consumers cannot forget any of them because `AppShell` renders them (concept decision 12).
 *
 * The router ships no `aria-live` anywhere, so a navigation is silent to a screen reader until the
 * announcer says the new page's title. It reacts to a pathname change only: a search-only change
 * (a filter, a tab) keeps the same page and says nothing.
 */
import { useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactElement } from 'react'
import { useIsomorphicLayoutEffect } from '../../common/isomorphic-layout-effect'

/** The `id` of the one scrollport, the skip link's target. */
export const SHELL_MAIN_ID = 'shell-main'

/**
 * The shell's own strings. `shell.*` message keys belong to the messages concept (v3-qa-i2) and are
 * not there yet; until they land these English defaults stand in, and the swap is one import.
 */
export const SHELL_TEXT = {
  skip: 'Skip to content',
  primary: 'Primary',
  notFound: 'Not found',
} as const

/** The document title: the page's title, a separator and the brand. */
export function composeTitle(page: string | undefined, brand: string): string {
  return page === undefined || page === '' ? brand : `${page} · ${brand}`
}

/**
 * The first focusable element of the page. It is hidden until focused, then jumps to `Main`, which
 * takes focus itself (`tabindex="-1"`) so the next Tab starts inside the content.
 */
export function SkipLink(): ReactElement {
  const jump = (event: MouseEvent<HTMLAnchorElement>): void => {
    const main = document.getElementById(SHELL_MAIN_ID)
    if (main === null) return
    event.preventDefault()
    main.focus()
  }
  return (
    <a
      data-slot="shell-skip"
      href={`#${SHELL_MAIN_ID}`}
      onClick={jump}
      className="sr-only rounded-ctrl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus-ring"
    >
      {SHELL_TEXT.skip}
    </a>
  )
}

/** The polite live region. Its text is set once per page change and is never visible. */
export function RouteAnnouncer({ message }: { message: string }): ReactElement {
  return (
    <output data-slot="shell-announcer" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </output>
  )
}

/**
 * Says the page title after a pathname change, never on the first render and never for a
 * search-only change. It reads `document.title` one frame later: by then the new page's `PageBar`
 * has claimed its title and the shell has composed it.
 */
export function useRouteAnnouncement(pathname: string): string {
  const [message, setMessage] = useState('')
  const seen = useRef(pathname)
  useEffect(() => {
    if (seen.current === pathname) return undefined
    seen.current = pathname
    // Cleared first: two pages that compose the same title must still change the region's text.
    let second = 0
    const first = requestAnimationFrame(() => {
      setMessage('')
      second = requestAnimationFrame(() => setMessage(document.title))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [pathname])
  return message
}

/**
 * Keeps `document.title` at the composed title. It runs after every render on purpose: a `PageBar`
 * writes its raw title and restores the previous one on unmount, and the shell's write must be the
 * last of the commit.
 */
export function useDocumentTitle(title: string): void {
  useIsomorphicLayoutEffect(() => {
    if (document.title !== title) document.title = title
  })
}

/**
 * Hands focus to `Main` after a pathname change that left it on `<body>`: the control that was
 * focused (a page action, a row) went away with the old page, and without this the next Tab starts
 * at the skip link. Focus that is somewhere real (the rail link just activated) stays where it is.
 */
export function useRouteFocus(pathname: string): void {
  const seen = useRef(pathname)
  useEffect(() => {
    if (seen.current === pathname) return undefined
    seen.current = pathname
    const frame = requestAnimationFrame(() => {
      if (!focusLost()) return
      document.getElementById(SHELL_MAIN_ID)?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [pathname])
}

/** Whether focus fell to the document: nothing is focused, or it is `<body>`. */
export function focusLost(): boolean {
  const active = document.activeElement
  return active === null || active === document.body
}

/**
 * How long a navigation may wait before main shows it: the router's `defaultPendingMs` (TanStack's
 * own default, 1000, where the app set none). True while a navigation has waited that long.
 */
export function useNavigationPending(pendingMs: number): boolean {
  // A navigation, not a background reload: the wanted location is not the resolved one yet.
  const loading = useRouterState({
    select: (s) =>
      s.status === 'pending' &&
      s.resolvedLocation !== undefined &&
      s.resolvedLocation.href !== s.location.href,
  })
  const [late, setLate] = useState(false)
  useEffect(() => {
    if (!loading) return undefined
    const timer = setTimeout(() => setLate(true), pendingMs)
    return () => {
      clearTimeout(timer)
      setLate(false)
    }
  }, [loading, pendingMs])
  return loading && late
}
