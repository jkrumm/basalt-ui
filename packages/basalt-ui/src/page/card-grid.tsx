import { cva } from 'class-variance-authority'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'

/**
 * The `CardGrid` cva table: equal tracks that are at least `min` wide and share the row, so the
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
      narrow: 'grid-cols-[repeat(auto-fill,minmax(min(100%,var(--container-narrow)),1fr))]',
      regular: 'grid-cols-[repeat(auto-fill,minmax(min(100%,var(--container-regular)),1fr))]',
      wide: 'grid-cols-[repeat(auto-fill,minmax(min(100%,var(--container-wide)),1fr))]',
    },
  },
  defaultVariants: { min: 'narrow' },
})

export type CardGridProps = {
  /** The narrowest a card may get. A container tier, never a column count. Default `narrow`. */
  min?: 'narrow' | 'regular' | 'wide'
  children?: ReactNode
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
export function CardGrid({ min, children }: CardGridProps): ReactElement {
  return (
    <div data-slot="card-grid" className={cn(cardGridVariants({ min }))}>
      {children}
    </div>
  )
}
