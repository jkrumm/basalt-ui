import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'

export type SettingsLayoutProps = {
  /** The pane's name (`Profile`): an `h2`, which a `SplitPage` hands focus to when the pane opens. */
  title: NonNullable<ReactNode>
  /** One line under the title saying what the pane settles. */
  description?: ReactNode
  /**
   * The id of the row to scroll to and mark, when the app reads it from somewhere the layout cannot
   * (the router's hash). Without it the layout follows the URL's own `#hash`.
   */
  row?: string
  /** Layout only (`w-full`). */
  className?: string
  /** The pane's `FormSection`s. */
  children: ReactNode
}

/** How long a row stays marked: the slow step of the motion scale. */
const FLASH_MS = 1600

function subscribeHash(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener('popstate', onChange)
  }
}
const readHash = (): string => window.location.hash
const noHash = (): string => ''

function decode(hash: string): string | undefined {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (raw === '') return undefined
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

/** The element of `id` inside `root`: ids are compared as text, never as a selector. */
function findRow(root: HTMLElement, id: string): HTMLElement | null {
  for (const el of root.querySelectorAll<HTMLElement>('[id]')) if (el.id === id) return el
  return null
}

/**
 * Scrolls the row `target` names into the middle of the scrollport and marks it with `data-flash`
 * for a moment, once per target: a re-render with the same target does nothing. The row is found
 * after the commit, so a target in a pane that has just rendered is reached; one that is not there
 * yet gets a second try on the next frame.
 */
function useRowTarget(target: string | undefined, root: { current: HTMLElement | null }): void {
  useEffect(() => {
    if (target === undefined) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    let marked: HTMLElement | null = null
    const reveal = (): boolean => {
      const el = root.current === null ? null : findRow(root.current, target)
      if (el === null) return false
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      el.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' })
      el.setAttribute('data-flash', '')
      marked = el
      timer = setTimeout(() => {
        el.removeAttribute('data-flash')
      }, FLASH_MS)
      return true
    }
    if (!reveal()) frame = requestAnimationFrame(reveal)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
      marked?.removeAttribute('data-flash')
    }
  }, [target, root])
}

/**
 * The frame of a settings pane: a centred column with the pane's title and description over its
 * `FormSection`s, 40 px apart. A link to a row (`#row-id`, or the `row` prop) scrolls to it and
 * marks it once. It sets no padding of its own: the `Page` owns the gutter. Put the sections'
 * navigation beside it in a `SplitPage` with an `InnerNav`; a hit on a setting's name is an
 * `InnerNav` item whose `href` carries the row's `#id`.
 *
 * @useWhen a page is settings: sections of rows under one title, with rows a link can point at
 * @neverWhen the page is a record or a dashboard (Page and Section), or one short form (FormField alone)
 *
 * @example
 * <SplitPage selected={selected} list={() => <InnerNav … />} detail={() => (
 *   <SettingsLayout title="Notifications" description="Where each event is sent.">
 *     <FormSection title="Email">…</FormSection>
 *   </SettingsLayout>
 * )} />
 */
export function SettingsLayout({
  title,
  description,
  row,
  className,
  children,
}: SettingsLayoutProps): ReactElement {
  const root = useRef<HTMLDivElement>(null)
  const hash = useSyncExternalStore(subscribeHash, readHash, noHash)
  useRowTarget(row ?? decode(hash), root)
  const hasDescription = description !== undefined && description !== null && description !== ''
  return (
    <div
      ref={root}
      data-slot="settings-layout"
      className={cn('mx-auto flex w-full min-w-0 max-w-4xl flex-col gap-10', className)}
    >
      <header data-slot="settings-layout-header" className="flex min-w-0 flex-col gap-1">
        <h2 className="m-0 font-head text-xl font-semibold text-foreground">{title}</h2>
        {hasDescription && (
          <p className="m-0 max-w-prose text-sm text-muted-foreground">{description}</p>
        )}
      </header>
      {children}
    </div>
  )
}
