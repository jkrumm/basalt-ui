import { Children, useContext, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../core/cn'
import { Card } from '../ui/card'
import type { StatCellProps } from './stat-cell'
import { FrameDepthContext, MAX_DEPTH, StatGroupContext, warnOnce } from './stat-group-shared'

/**
 * A group takes `StatCell`s and nothing else. The type is declared here because
 * `src/cards/contract.ts` has no `StatGroup` entry yet.
 */
export type StatCellElement = ReactElement<StatCellProps>

export type StatGroupProps = {
  /**
   * `strip` is one dense surface whose cells share their tracks; `cards` is one card per cell with
   * the bands aligned across them, and a snap row below `@regular`.
   */
  variant: 'strip' | 'cards'
  /** Names the group for assistive tech (`Recovery`). */
  label?: string
  children: StatCellElement | readonly StatCellElement[]
}

/**
 * Whether the element's content is wider than its box. Measured after paint and on every resize,
 * so the server render and the first client render agree (`false`).
 */
function useOverflowsX(count: number): [(el: HTMLDivElement | null) => void, boolean] {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const [overflows, setOverflows] = useState(false)
  const frame = useRef(0)
  useEffect(() => {
    if (el === null) return undefined
    const measure = (): void => setOverflows(el.scrollWidth > el.clientWidth)
    measure()
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(measure)
    })
    observer.observe(el)
    for (const child of el.children) observer.observe(child)
    return () => {
      cancelAnimationFrame(frame.current)
      observer.disconnect()
    }
  }, [el, count])
  return [setEl, overflows]
}

/**
 * Every cell's tracks are one set of rows: nine, in the order caption, figure, meter, chart, four
 * rows and a foot line. A cell is `row-span-9` on a subgrid, so a track one cell fills is as tall
 * in all of them and a track nobody fills is 0 px. Rows have no gap; the space between wrapped
 * lines is the cells' bottom margin, which the last line gives back.
 */
const STRIP = 'grid -mb-3 grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-x-6'

/**
 * The snap row below `@regular`: one column per cell, `w-72` each, snapping at the start edge. At
 * `@regular` it becomes the auto-fit grid. The padding and negative margin keep the cards' ring and
 * shadow inside the scroller's clip.
 */
const CARDS =
  'grid -mx-1 -mt-1 -mb-4 auto-cols-[18rem] grid-flow-col snap-x snap-mandatory overflow-x-auto overscroll-x-contain p-1 focus-ring focus-visible:-outline-offset-2 @regular:grid-flow-row @regular:auto-cols-auto @regular:snap-none @regular:grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] @regular:overflow-visible gap-x-3'

/**
 * A row of `StatCell`s on shared tracks. `strip` draws them on one surface for the dense status bar
 * of a dashboard; `cards` draws one card each with the headline bands aligned across them, and below
 * `@regular` a snap row that is a keyboard stop only while it scrolls. A cell fills the tracks it
 * declares and the rest collapse, so a loading cell is already its final height.
 *
 * @useWhen a page shows several headline figures side by side, a status bar or a row of KPIs
 * @neverWhen there is one figure (use a stat card) or the figures need a chart each (use chart cards)
 *
 * @example
 * <StatGroup variant="strip" label="Link health">
 *   <StatCell label="Downstream" value={412} unit="Mbit/s" phase={query} />
 *   <StatCell label="Upstream" value={44} unit="Mbit/s" phase={query} />
 * </StatGroup>
 */
export function StatGroup({ variant, label, children }: StatGroupProps): ReactElement {
  const depth = useContext(FrameDepthContext)
  if (depth >= MAX_DEPTH) {
    warnOnce(
      'depth',
      `A StatGroup sits ${depth} frames deep (over ${MAX_DEPTH}). Lay the frames out side by side instead of nesting them.`,
    )
  }
  return (
    <FrameDepthContext.Provider value={depth + 1}>
      <StatGroupContext.Provider value={variant}>
        {variant === 'strip' ? (
          <StripGroup label={label}>{children}</StripGroup>
        ) : (
          <CardsGroup label={label}>{children}</CardsGroup>
        )}
      </StatGroupContext.Provider>
    </FrameDepthContext.Provider>
  )
}

type BodyProps = { label: string | undefined; children: StatGroupProps['children'] }

function StripGroup({ label, children }: BodyProps): ReactElement {
  return (
    <div data-slot="stat-group" data-variant="strip" className="@container min-w-0">
      <Card flush className="px-(--card-edge) py-3">
        {/* The explicit role is deliberate: a `fieldset` carries form semantics and a UA border. */}
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
        <div role="group" aria-label={label} className={STRIP}>
          {children}
        </div>
      </Card>
    </div>
  )
}

function CardsGroup({ label, children }: BodyProps): ReactElement {
  const [ref, scrolls] = useOverflowsX(Children.count(children))
  return (
    <div data-slot="stat-group" data-variant="cards" className="@container min-w-0">
      <div
        ref={ref}
        data-slot="stat-scroll"
        // The explicit role is deliberate: it names the scroller, and only while it scrolls.
        {...(scrolls ? { role: 'region' } : { role: 'group' })}
        aria-label={label}
        {...(scrolls && { tabIndex: 0 })}
        className={cn(CARDS)}
      >
        {children}
      </div>
    </div>
  )
}
