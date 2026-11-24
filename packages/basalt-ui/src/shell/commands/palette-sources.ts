/**
 * The palette's record search: the types an app's `PaletteSource` is written in, the debounced and
 * abortable fetch behind them, and the recents each source keeps. The palette draws the rows.
 */
import type { AnyRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { persisted } from '../../core/persisted'
import type { IconComponent, NavTarget } from '../../core/ports'
import { isInAppPath, safeUrl } from '../../core/url'
import { targetHref } from '../../router/nav-target'

/** A secondary action of a result: a trailing button, and `Mod+Enter` for the first one. */
export type PaletteResultAction = { id: string; label: string; run(): void | Promise<void> }

/** One record a source found. */
export type PaletteResult = {
  /** Unique within its source. */
  id: string
  title: string
  /** A short noun drawn as a chip: 'Supplier', 'Invoice'. */
  kind?: string
  /** One muted line after the title. */
  detail?: string
  icon?: IconComponent
  /** Where choosing the row goes: a path or a `navTarget(...)`. */
  to: string | NavTarget
  actions?: readonly PaletteResultAction[]
}

/** A place the palette searches records in. */
export type PaletteSource = {
  /** Stable: keys the recents in storage. */
  id: string
  /** The group heading. */
  label: string
  /** Called with the trimmed query, debounced (150 ms); a newer query aborts the older call through signal. */
  search(query: string, signal: AbortSignal): Promise<readonly PaletteResult[]>
  /** Rows shown at most. Default 8. */
  limit?: number
  /** Opened results remembered and shown while the query is empty. Default 5; 0 turns it off. */
  recents?: number
}

const DEBOUNCE_MS = 150
const DEFAULT_LIMIT = 8
const DEFAULT_RECENTS = 5

/** What a recent keeps: no function, no icon, and a `to` that is text. */
type Recent = { id: string; title: string; kind?: string; detail?: string; to: string }

const NONE: readonly unknown[] = []

function recentsStore(source: PaletteSource) {
  return persisted<readonly unknown[]>(`palette-recents:${source.id}`, {
    version: 1,
    initial: NONE,
  })
}

function isRecent(value: unknown): value is Recent {
  if (typeof value !== 'object' || value === null) return false
  const { id, title, kind, detail, to } = value as Record<string, unknown>
  return (
    typeof id === 'string' &&
    typeof title === 'string' &&
    typeof to === 'string' &&
    (isInAppPath(to) || safeUrl(to, 'untrusted') !== null) &&
    (kind === undefined || typeof kind === 'string') &&
    (detail === undefined || typeof detail === 'string')
  )
}

/** The opened results a source remembers, most recent first. */
export function readRecents(source: PaletteSource): readonly PaletteResult[] {
  const limit = source.recents ?? DEFAULT_RECENTS
  if (limit <= 0) return []
  return recentsStore(source).get().filter(isRecent).slice(0, limit)
}

/** Moves a result to the front of its source's recents. A target the router cannot build is not kept. */
export function rememberRecent(
  router: AnyRouter,
  source: PaletteSource,
  result: PaletteResult,
): void {
  const limit = source.recents ?? DEFAULT_RECENTS
  if (limit <= 0) return
  const to = typeof result.to === 'string' ? result.to : targetHref(router, result.to)
  if (to === undefined) return
  const entry: Recent = {
    id: result.id,
    title: result.title,
    ...(result.kind !== undefined && { kind: result.kind }),
    ...(result.detail !== undefined && { detail: result.detail }),
    to,
  }
  const store = recentsStore(source)
  store.set(
    [
      entry,
      ...store
        .get()
        .filter(isRecent)
        .filter((recent) => recent.id !== result.id),
    ].slice(0, limit),
  )
}

/** Navigates to a result's `to`: an in-app path or target through the router, any other string by the browser. */
export function openResult(router: AnyRouter, to: string | NavTarget): void {
  const href = typeof to === 'string' ? to : targetHref(router, to)
  if (href === undefined) return
  if (isInAppPath(href)) {
    void router.navigate({ href } as never)
    return
  }
  // A source's rows are data from a search: only a URL the untrusted policy admits leaves the app.
  const safe = safeUrl(href, 'untrusted')
  if (safe !== null) window.location.assign(safe)
}

export type SourceRows = { source: PaletteSource; results: readonly PaletteResult[] }

const NO_ANSWERS: Readonly<Record<string, readonly PaletteResult[]>> = {}

/**
 * The rows of every source for a query: its recents while the query is empty, else what `search`
 * last answered, capped at `limit`. A query is sent once it has rested for 150 ms and a newer one
 * aborts the older through its signal, as does closing. A failed search yields no rows for its
 * source; the previous rows stay until the new ones arrive. `version` re-reads the recents.
 */
export function useSourceRows(
  sources: readonly PaletteSource[],
  query: string,
  open: boolean,
  version: number,
): readonly SourceRows[] {
  const [answers, setAnswers] = useState(NO_ANSWERS)
  // Closing drops what was found, so the next opening starts without the last session's rows.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) setAnswers(NO_ANSWERS)
  }
  const latest = useRef(sources)
  useEffect(() => {
    latest.current = sources
  })
  const ids = sources.map((source) => source.id).join('\n')
  const text = query.trim()

  useEffect(() => {
    if (!open || text === '') return
    const controller = new AbortController()
    const answer = (id: string, results: readonly PaletteResult[]): void => {
      if (controller.signal.aborted) return
      setAnswers((before) => ({ ...before, [id]: results }))
    }
    const ask = async (source: PaletteSource): Promise<void> => {
      try {
        answer(source.id, await source.search(text, controller.signal))
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        if (process.env.NODE_ENV !== 'production')
          // oxlint-disable-next-line no-console -- a development warning for a source whose search rejected
          console.warn(`[basalt] palette source "${source.id}" failed to search`, error)
        answer(source.id, [])
      }
    }
    const timer = setTimeout(() => {
      for (const source of latest.current) void ask(source)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
    // `ids` restarts the search when the set of sources changes; the sources themselves are read from the ref.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- see above
  }, [open, text, ids])

  if (!open) return []
  // `version` has no use here but to make a caller's recents change re-run this read.
  void version
  return sources.map((source) => ({
    source,
    results:
      text === ''
        ? readRecents(source)
        : (answers[source.id] ?? []).slice(0, source.limit ?? DEFAULT_LIMIT),
  }))
}
