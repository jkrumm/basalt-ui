import { cva } from 'class-variance-authority'
import type { FocusEvent, ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { isStatRow } from '../core/stat-row'
import { ScrollArea } from '../ui/scroll-area'

/**
 * The `CardGrid` cva table: equal tracks that are at least `min` wide and share the row (`auto-fit`: a row of fewer cards than it has tracks collapses the empty ones, so a lone card fills the row), so the
 * column count follows the grid's own width and no breakpoint is read. `min` is a container tier
 * (`narrow` 15rem, `regular` 30rem, `wide` 50rem), and `min(100%, ...)` lets one track shrink below
 * the tier on a container narrower than it, so the grid never overflows.
 *
 * @example
 * cardGridVariants({ min: 'regular' }) // class string for a hand-built grid
 */
export const cardGridVariants = cva('grid min-w-0 gap-3', {
  variants: {
    min: {
      narrow: 'grid-cols-[repeat(auto-fit,minmax(min(100%,var(--container-narrow)),1fr))]',
      regular: 'grid-cols-[repeat(auto-fit,minmax(min(100%,var(--container-regular)),1fr))]',
      wide: 'grid-cols-[repeat(auto-fit,minmax(min(100%,var(--container-wide)),1fr))]',
    },
  },
  defaultVariants: { min: 'narrow' },
})

/**
 * The stat row's scrollport (`shrink-0`: in a column page `min-h-0` would squeeze it under its cards and clip them): the padding and negative margin keep each card's ring and shadow inside
 * the box the scroller clips. Below `regular` it snaps (the cards are `ROW`'s); from `regular` the
 * scroller's content wrapper is the page-wide grid again and nothing scrolls.
 */
const SCROLL =
  '-m-1 shrink-0 p-1 @max-regular:snap-x @max-regular:snap-mandatory @max-regular:scroll-px-1 @regular:[&>div]:w-auto'

/** Below `regular`: one line, each card 85% of the container so the next one's edge shows. */
const ROW =
  '@max-regular:flex @max-regular:[&>*]:w-[85cqw] @max-regular:[&>*]:shrink-0 @max-regular:[&>*]:snap-start'

export type CardGridProps = {
  /** The narrowest a card may get. A container tier, never a column count. Default `narrow`. */
  min?: 'narrow' | 'regular' | 'wide'
  /**
   * What a row of stat cards does in a container narrower than `regular`: `scroll` lays the cards
   * on one line that scrolls sideways with snap points, one card and the next one's edge per screen;
   * `stack` keeps the tracks. Default `scroll` for a grid of only stat cards, `stack` for any other
   * (a chart card is a plot and does not scroll).
   */
  narrow?: 'stack' | 'scroll'
  children?: ReactNode
}

/**
 * A keyboard stop on a card brings the whole card into view. The browser's own focus scroll leaves a
 * stretched card target (`StatCard`) mostly off-screen: it counts the 34 px edge as seen.
 */
function revealCard(event: FocusEvent<HTMLElement>): void {
  const card = event.target.closest('[data-slot="stat-card"]')
  if (card !== null && event.currentTarget.contains(card)) {
    card.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
}

/**
 * A grid of cards that decides its columns from its own width: every track is at least `min` wide
 * and the tracks share the row. There is no column count and no breakpoint to choose, so the same
 * grid reads right in a phone column, a docked aside and a 1440 page.
 *
 * @useWhen cards of one kind sit side by side and the column count should follow the space they get
 * @neverWhen the layout needs a fixed column count or an asymmetric split (compose the page with `Section`s)
 *
 * @example
 * <CardGrid min="regular">
 *   <ChartCard title="Latency" chart={...} />
 *   <ChartCard title="Errors" chart={...} />
 * </CardGrid>
 */
export function CardGrid({ min, narrow, children }: CardGridProps): ReactElement {
  if ((narrow ?? (isStatRow(children) ? 'scroll' : 'stack')) === 'stack') {
    return (
      <div data-slot="card-grid" className={cn(cardGridVariants({ min }))}>
        {children}
      </div>
    )
  }
  return (
    <ScrollArea orientation="horizontal" className={SCROLL} onFocus={revealCard}>
      <div
        data-slot="card-grid"
        data-narrow="scroll"
        className={cn(cardGridVariants({ min }), ROW)}
      >
        {children}
      </div>
    </ScrollArea>
  )
}
