/**
 * TableOfContents — an IntersectionObserver scroll-spy rail (docs/CONTENT-SPEC.md §3/§6).
 *
 * Headings self-register: pass `items` explicitly, or pass `containerRef` and the component
 * collects `h2`/`h3` (configurable via `levels`) that already carry an `id` — pair with
 * `headingSlug`/`SlugTracker` when authoring the headings. Sticky positioning is the consumer's
 * job; this component is just the rail.
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
import { useEffect, useState } from 'react'
import { useReducedMotion } from '@mantine/hooks'
import classes from './toc.module.css'

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

  // Scroll-spy: one IntersectionObserver over every collected heading.
  useEffect(() => {
    if (resolvedItems.length === 0) return
    const elements = resolvedItems
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null)
    if (elements.length === 0) return

    const intersecting = new Set<string>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) intersecting.add(entry.target.id)
          else intersecting.delete(entry.target.id)
        }

        if (intersecting.size > 0) {
          const topmost = elements.find((el) => intersecting.has(el.id))
          if (topmost) setActiveId(topmost.id)
          return
        }

        // Nothing intersecting — fall back to the last heading already scrolled past.
        const passed = elements.filter((el) => el.getBoundingClientRect().top < 0)
        const last = passed[passed.length - 1]
        if (last) setActiveId(last.id)
      },
      { rootMargin: '-80px 0px -70% 0px' },
    )

    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
  }, [resolvedItems])

  if (resolvedItems.length === 0) return null

  const handleClick = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' })
      history.replaceState(null, '', `#${id}`)
    }
    onNavigate?.(id)
  }

  const navClass = [classes.root, className].filter(Boolean).join(' ')

  return (
    <nav className={navClass} aria-label={title}>
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
