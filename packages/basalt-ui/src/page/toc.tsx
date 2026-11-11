import type { MouseEvent, ReactElement, RefObject } from 'react'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { scrollParentOf } from '../common/scroll-parent'
import { cn } from '../core/cn'
import { page } from '../core/messages/page'
import { useMessages } from '../core/messages/use-messages'
import { useClickPin } from './toc-click-pin'
import { OBSERVER_ROOT_MARGIN, pickActive, scrollMetrics } from './toc-spy'

export type TocItem = {
  id: string
  label: string
  level: number
}

export type TocProps = {
  /** Explicit item list. Omit to auto-collect from `containerRef`. */
  items?: TocItem[]
  /** The article container to auto-collect headings from (ignored when `items` is provided). */
  containerRef?: RefObject<HTMLElement | null>
  /** Heading levels to collect when auto-collecting. Default `[2, 3]`. */
  levels?: readonly [number, number]
  title?: string
  /** Called after a rail item is clicked and the target has been scrolled to. */
  onNavigate?: (id: string) => void
  className?: string
}

const DEFAULT_LEVELS: readonly [number, number] = [2, 3]

function prefersReducedMotion(): boolean {
  // theme-allow raw-breakpoint — a motion preference, not a width
  // theme-allow raw-breakpoint — a motion preference, not a width
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Heading text, trimmed; a `[data-heading-anchor]` descendant (a legacy `#` glyph) is dropped. */
function headingLabel(node: HTMLElement): string {
  const clone = node.cloneNode(true) as HTMLElement
  for (const anchor of clone.querySelectorAll('[data-heading-anchor]')) anchor.remove()
  return (clone.textContent ?? '').trim()
}

function collectHeadings(container: HTMLElement, levels: readonly [number, number]): TocItem[] {
  const selector = levels.map((level) => `h${level}[id]`).join(',')
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(selector))
  return nodes.map((node) => ({
    id: node.id,
    label: headingLabel(node),
    level: Number(node.tagName.slice(1)),
  }))
}

/**
 * A scroll-spy rail for one article: a `<nav>` of in-page links, the reader's section marked
 * `aria-current="location"`. Pass `items`, or pass `containerRef` and the rail collects the `h2`/`h3`
 * (`levels`) that carry an `id` under it, on mount and on every childList mutation. Sticky
 * positioning is the caller's job.
 *
 * The spy resolves which box scrolls (`scrollParentOf`): the shell's main region or the document.
 * A click pins the clicked entry while the scroll runs, then hands the rail back to the spy.
 *
 * @useWhen a long page with h2 and h3 headings needs an on-this-page list that follows the scroll
 * @neverWhen the page has fewer than three headings or its sections are tabs
 *
 * @example
 * const articleRef = useRef<HTMLDivElement>(null)
 * <div ref={articleRef}><h2 id="setup">Setup</h2></div>
 * <Toc containerRef={articleRef} />
 */
export function Toc({
  items,
  containerRef,
  levels = DEFAULT_LEVELS,
  title,
  onNavigate,
  className,
}: TocProps): ReactElement | null {
  const t = useMessages(page)
  const heading = title ?? t('page.toc')
  const [collected, setCollected] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  // The rail's own node — the probe `scrollParentOf` walks from when there is no `containerRef`.
  const navRef = useRef<HTMLElement | null>(null)
  // The spy's working set, resolved once per effect run: headings, scroller, and the band's members.
  const elementsRef = useRef<HTMLElement[]>([])
  const portRef = useRef<HTMLElement | null>(null)
  const intersectingRef = useRef<Set<string>>(new Set())
  // Bumped when a click hands the rail back, so the rail re-resolves.
  const [idleTick, bumpIdle] = useReducer((n: number) => n + 1, 0)
  const pin = useClickPin(bumpIdle)
  const scrollerOf = useCallback(
    () => scrollParentOf(containerRef?.current ?? navRef.current),
    [containerRef],
  )

  // Auto-collection: re-scan on mount + on any childList mutation under the container.
  useEffect(() => {
    if (items !== undefined) return
    const container = containerRef?.current
    if (!container) return

    const update = () => setCollected(collectHeadings(container, levels))
    update()

    const observer = new MutationObserver(update)
    observer.observe(container, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [items, containerRef, levels])

  const resolvedItems = items ?? collected

  // The spy's answer for the reader's current position — or the clicked entry, while the click owns it.
  const resolve = useCallback(() => {
    if (pin.activeId !== null) {
      setActiveId(pin.activeId)
      return
    }
    const id = pickActive(
      elementsRef.current,
      intersectingRef.current,
      scrollMetrics(portRef.current),
    )
    if (id !== undefined) setActiveId(id)
  }, [pin])

  // Scroll-spy: one IntersectionObserver over every collected heading.
  useEffect(() => {
    pin.prune(resolvedItems.map((item) => item.id))
    if (resolvedItems.length === 0) return
    const elements = resolvedItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    const port = scrollerOf()
    const scroller: Window | HTMLElement = port ?? window
    const intersecting = intersectingRef.current
    intersecting.clear()
    elementsRef.current = elements
    portRef.current = port

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target.id)
          else intersecting.delete(entry.target.id)
        }
        resolve()
      },
      // `root: null` IS the viewport — the shell-less case, unchanged. Inside a shell the root has
      // to be the scrollport or the `-70%` dead zone is measured against a box nothing scrolls.
      { root: port, rootMargin: OBSERVER_ROOT_MARGIN },
    )

    for (const el of elements) observer.observe(el)
    // The observer only fires when an intersection CHANGES; the bottom edge resolves on scroll
    // position alone, so it needs a scroll signal too. Re-setting the same id is a no-op for React.
    scroller.addEventListener('scroll', resolve, { passive: true })
    return () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', resolve)
      elementsRef.current = []
    }
  }, [resolvedItems, scrollerOf, pin, resolve])

  // A click handed the rail back: answer for where the reader is, next frame.
  useEffect(() => {
    const frame = requestAnimationFrame(resolve)
    return () => cancelAnimationFrame(frame)
  }, [idleTick, resolve])

  if (resolvedItems.length === 0) return null

  const handleClick = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      setActiveId(id)
      pin.click(id, event.currentTarget, scrollerOf())
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      history.replaceState(null, '', `#${id}`)
    }
    onNavigate?.(id)
  }

  return (
    <nav
      ref={navRef}
      data-slot="toc"
      aria-label={heading}
      className={cn('flex flex-col gap-2', className)}
    >
      <div className="font-mono text-micro tracking-wider text-faint uppercase">{heading}</div>
      <ul className="flex flex-col border-l border-border">
        {resolvedItems.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                'focus-ring -ml-px block border-l-2 border-transparent py-1 pl-3 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground motion-reduce:transition-none',
                item.level >= 3 && 'pl-6',
                activeId === item.id && 'border-brand text-foreground',
              )}
              aria-current={activeId === item.id ? 'location' : undefined}
              onClick={handleClick(item.id)}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
