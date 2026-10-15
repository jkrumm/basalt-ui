/**
 * TableOfContents — an IntersectionObserver scroll-spy rail (docs/CONTENT-SPEC.md §3/§6).
 *
 * Contract with `Markdown`: `Markdown` slugs every heading it renders into an `id` (deduped within the
 * one document; per streamed block in `streaming` mode); `containerRef` collects the h2/h3 (`levels`)
 * that already carry an `id` under that single container, on mount and on every childList mutation
 * beneath it — late or lazy-rendered headings are picked up. `Prose` sets no ids; `items` replaces collection.
 *
 * Headings self-register: pass `items` explicitly, or pass `containerRef` and the component
 * collects `h2`/`h3` (configurable via `levels`) that already carry an `id` — pair with
 * `headingSlug`/`SlugTracker` when authoring the headings. Sticky positioning is the consumer's
 * job; this component is just the rail.
 *
 * The spy resolves WHICH BOX SCROLLS (`scrollParentOf`) instead of assuming the window: inside
 * `BasaltShell` that is `AppShell.Main` (`shell/app-main.module.css`), so both the observer's root
 * and the bottom-edge arithmetic have to be that element — a window listener there never fires and
 * a viewport-rooted observer measures the wrong band. `null` means the document scrolls, which is
 * the shell-less case and behaves exactly as before.
 *
 * The active item carries `aria-current="location"` (WAI-ARIA APG: a link set within one page).
 *
 * @example
 * import { TableOfContents, headingSlug } from 'basalt-ui/content'
 *
 * const articleRef = useRef<HTMLDivElement>(null)
 * <div ref={articleRef}>
 *   <h2 id={headingSlug('Setup')}>Setup</h2>
 * </div>
 * <TableOfContents containerRef={articleRef} />
 */
import type { MouseEvent, RefObject } from 'react'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useReducedMotion } from '@mantine/hooks'
import { scrollParentOf } from '../common/scroll-parent'
import classes from './toc.module.css'
import { useClickPin } from './toc-click-pin'
import { OBSERVER_ROOT_MARGIN, pickActive, scrollMetrics } from './toc-spy'

export type TocItem = {
  readonly id: string
  readonly label: string
  readonly level: number
}

export type TableOfContentsProps = {
  /** Explicit item list. Omit to auto-collect from `containerRef`. */
  readonly items?: TocItem[]
  /** The article container to auto-collect headings from (ignored when `items` is provided). */
  readonly containerRef?: RefObject<HTMLElement | null>
  /** Heading levels to collect when auto-collecting. Default `[2, 3]`. */
  readonly levels?: readonly [number, number]
  readonly title?: string
  /** Called after a rail item is clicked and the target has been scrolled to. */
  readonly onNavigate?: (id: string) => void
  readonly className?: string
}

const DEFAULT_LEVELS: readonly [number, number] = [2, 3]
const DEFAULT_TITLE = 'On this page'

/** Heading text without the hover-anchor `#` glyph the markdown/MDX heading renderers append. */
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

export function TableOfContents({
  items,
  containerRef,
  levels = DEFAULT_LEVELS,
  title = DEFAULT_TITLE,
  onNavigate,
  className,
}: TableOfContentsProps) {
  const [collected, setCollected] = useState<TocItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const reduceMotion = useReducedMotion()
  // The rail's own node — the probe `scrollParentOf` walks from when there is no `containerRef`.
  const navRef = useRef<HTMLElement | null>(null)
  // Which headings the observer currently reports inside its band.
  const intersectingRef = useRef<Set<string>>(new Set())
  // Bumped when a click hands the rail back: the spy effect below re-subscribes, and re-resolves.
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
    const elements = resolvedItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)
    const id = pickActive(elements, intersectingRef.current, scrollMetrics(scrollerOf()))
    if (id !== undefined) setActiveId(id)
  }, [pin, resolvedItems, scrollerOf])

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
    }
  }, [resolvedItems, scrollerOf, pin, resolve, idleTick])

  if (resolvedItems.length === 0) return null

  const handleClick = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      setActiveId(id)
      pin.click(id, event.currentTarget, scrollerOf())
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
      history.replaceState(null, '', `#${id}`)
    }
    onNavigate?.(id)
  }

  const navClass = [classes.root, className].filter(Boolean).join(' ')

  return (
    <nav ref={navRef} className={navClass} aria-label={title}>
      <div className={classes.header}>{title}</div>
      <ul className={classes.list}>
        {resolvedItems.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={[
                classes.link,
                item.level >= 3 && classes.sub,
                activeId === item.id && classes.active,
              ]
                .filter(Boolean)
                .join(' ')}
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
