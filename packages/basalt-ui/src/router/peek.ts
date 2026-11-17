/**
 * `usePeek`: the address, the click handler, the history and the Escape rule behind `Peek`
 * (`basalt-ui/page`). The panel draws; this owns what it shows and how the address changes. No JSX
 * in this folder, and nothing from `ui/*`: the app composes the two.
 */
import { useRouter, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import type { ControlHandle } from '../core/ports'

/** A record kind's page, with one `$id` segment: `/issues/$id`. */
export type PeekPattern = `/${string}$id${string}`

/** The record kinds a peek can show, by the name written in the address. */
export type PeekKinds = Readonly<Record<string, PeekPattern>>

/** The record the peek shows. */
export type PeekTarget<K extends string = string> = { kind: K; id: string }

/**
 * The URL field that holds the address: `field.string()` in a global store. `link(value)` is what
 * a click on a typed `Link` writes; `usePeek` navigates with it so the write keeps the field's own
 * encoding.
 */
export type PeekField = Pick<ControlHandle<string>, 'use' | 'clear'> & {
  link(value: string): { search: object }
}

export type PeekOptions<K extends PeekKinds> = {
  field: PeekField
  kinds: K
}

export type PeekState<K extends string = string> = {
  /** The record to show, or `null` while the peek is closed, names an unknown kind or the page it opened on is gone. */
  open: PeekTarget<K> | null
  /** Closes it: one step back when this hook pushed the entry, else the field cleared in place. */
  close: () => void
  /** The open record's own page, to pass to `Peek fullPage`. */
  fullPage: string | null
}

/** Another popup (a popover, the palette, a menu) is open: Escape is its, not the panel's. */
const OTHER_POPUP = '[role="dialog"][data-open], [role="menu"], [role="listbox"]'

type Matcher = { kind: string; pattern: RegExp }

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** `/issues/$id` as an anchored pattern with the id in group 1. */
function matcherOf(kind: string, path: PeekPattern): Matcher {
  const [before = '', after = ''] = path.split('$id')
  return { kind, pattern: new RegExp(`^${escaped(before)}([^/]+)${escaped(after)}/?$`) }
}

function matchPath(matchers: readonly Matcher[], pathname: string): PeekTarget | null {
  for (const { kind, pattern } of matchers) {
    const id = pattern.exec(pathname)?.[1]
    if (id === undefined) continue
    try {
      return { kind, id: decodeURIComponent(id) }
    } catch {
      return null // a malformed percent escape is no record's address
    }
  }
  return null
}

/** `kind/id` as written in the address; `null` for an empty value or a kind the app did not declare. */
function parse(value: string, kinds: PeekKinds): PeekTarget | null {
  const cut = value.indexOf('/')
  if (cut <= 0 || cut === value.length - 1) return null
  const kind = value.slice(0, cut)
  return Object.hasOwn(kinds, kind) ? { kind, id: value.slice(cut + 1) } : null
}

/**
 * The record a link points at, by the same `kinds` a `usePeek` is given: `null` for an address
 * that is another origin, not a kind's page or unparseable. It reads the path only, so a query or
 * a hash does not matter. Use it to feed a `PreviewCard` (`basalt-ui/ui/preview-card`) the summary
 * of what a link opens, from the one declaration the peek already uses.
 *
 * @useWhen a link to a record should show that record's summary on hover, focus or tap, and the app already declares its record kinds for `usePeek`
 * @neverWhen the address is not a record page, or the app has no `kinds` (a card on any link takes its content directly)
 *
 * @example
 * recordAt({ issue: '/issues/$id' }, '/issues/12?tab=notes') // { kind: 'issue', id: '12' }
 * recordAt({ issue: '/issues/$id' }, '/pulls/12') // null
 */
export function recordAt<const K extends PeekKinds>(
  kinds: K,
  href: string,
): PeekTarget<keyof K & string> | null {
  const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  let url: URL
  try {
    url = new URL(href, base)
  } catch {
    return null
  }
  if (url.origin !== base) return null
  const matchers = Object.entries(kinds).map(([kind, path]) => matcherOf(kind, path))
  return matchPath(matchers, url.pathname) as PeekTarget<keyof K & string> | null
}

const format = (target: PeekTarget): string => `${target.kind}/${target.id}`

/** The click the browser would follow itself in this tab: not another button, a modifier or a new-tab link. */
function isPlainClick(event: MouseEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
  )
}

const isField = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

/**
 * The peek's address and behaviour. `field` holds `kind/id` (`?peek=issue/12`) on any page, so a
 * reload or a shared link restores it; `kinds` names each record kind's page (`/issues/$id`).
 *
 * One click handler serves every link: a plain click on a same-origin link to a kind's page opens
 * the peek instead, so no screen wires it. Not intercepted: a modifier or middle click, a link with
 * a `target` or `download`, a link inside `data-peek="off"` (the panel's own full-page link),
 * another origin, and, while the peek is closed, any link on a page that is itself a kind's (the
 * record's own page is the full view). Opening from closed pushes one history entry, swapping
 * replaces it, so Escape, the close button and Back all leave the page exactly as it was.
 * Escape belongs to an open popover, menu or listbox first; inside a field it only leaves the field.
 * The peek belongs to the page it was opened on: on another pathname it is closed with a replace.
 *
 * Mount it once, inside the router and (for `Peek`) inside `AppShell`.
 *
 * @useWhen records are listed on many pages and a plain click on any link to one should open it in a side panel beside the list
 * @neverWhen one page owns the record and its panel (use `PageAside` with a string field), or the click must always navigate
 *
 * @example
 * const peek = usePeek({ field: globals.field.peek, kinds: { issue: '/issues/$id' } })
 * // peek.open is { kind: 'issue', id: '12' } for ?peek=issue/12, else null
 */
export function usePeek<const K extends PeekKinds>({
  field,
  kinds,
}: PeekOptions<K>): PeekState<keyof K & string> {
  const router = useRouter()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const [value] = field.use()
  const target = parse(value, kinds)

  // The page the panel was opened on: a reload into an open peek adopts the page it lands on.
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  if (target === null && openedOn !== null) setOpenedOn(null)
  else if (target !== null && openedOn === null) setOpenedOn(pathname)
  const stale = target !== null && openedOn !== null && openedOn !== pathname
  const live = target !== null && !stale
  const closed = target === null
  // This hook pushed the entry, so closing it is a step back.
  const pushed = useRef(false)
  useEffect(() => {
    if (closed) pushed.current = false
  }, [closed])

  const write = (next: string | null, replace: boolean): void => {
    if (next === null) {
      field.clear({ replace: true })
      return
    }
    const { search } = field.link(next)
    void router.navigate({
      to: '.',
      search: (prev: Record<string, unknown>) => ({ ...prev, ...search }),
      replace,
      resetScroll: false,
    } as never)
  }

  const close = (): void => {
    if (pushed.current) {
      pushed.current = false
      router.history.back()
      return
    }
    write(null, true)
  }

  // The latest of everything the document listeners read: they are installed once.
  const latest = useRef({ kinds, value, write, close, open: live })
  useIsomorphicLayoutEffect(() => {
    latest.current = { kinds, value, write, close, open: live }
  })

  useEffect(() => {
    if (stale) field.clear({ replace: true })
  }, [stale, field])

  useEffect(() => {
    const onClick = (event: MouseEvent): void => {
      if (!isPlainClick(event)) return
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target !== '') return
      if (anchor.hasAttribute('download') || anchor.closest('[data-peek="off"]') !== null) return
      // A touch tap on a `PreviewCardTrigger` whose card is closed shows the card; the next one gets here.
      if (anchor.hasAttribute('data-preview-first-tap')) return
      const url = new URL(anchor.href)
      if (url.origin !== window.location.origin) return
      const now = latest.current
      const matchers = Object.entries(now.kinds).map(([kind, path]) => matcherOf(kind, path))
      // The record's own page is the full view: its links go there (the peek opens over lists).
      if (!now.open && matchPath(matchers, router.state.location.pathname) !== null) return
      const next = matchPath(matchers, url.pathname)
      if (next === null) return
      event.preventDefault()
      event.stopPropagation()
      if (now.open && now.value === format(next)) return
      if (!now.open) pushed.current = true
      now.write(format(next), now.open)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [router])

  useEffect(() => {
    if (!live) return undefined
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // In a field the first Escape leaves the field: a draft is not thrown away with the panel.
      if (isField(event.target)) {
        event.target.blur()
        return
      }
      if (document.querySelector(OTHER_POPUP) !== null) return
      latest.current.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [live])

  const open = live ? target : null
  const path = open === null ? undefined : kinds[open.kind]
  return {
    open: open as PeekTarget<keyof K & string> | null,
    close,
    fullPage:
      path === undefined || open === null ? null : path.replace('$id', encodeURIComponent(open.id)),
  }
}
