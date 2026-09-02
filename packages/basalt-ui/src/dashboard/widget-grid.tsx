/**
 * WidgetGrid — the dashboard's column law, owned once (audit B #6/#7).
 *
 * Every consumer hand-wrote it: `SimpleGrid cols={{ base: 1, md: 3 }}` on one page,
 * `cols={{ base: 1, sm: 2, lg: 3 }}` on the next, `Grid.Col span={{ base: 12, md: 8 }}` on a third
 * — three different breakpoint sets for the same shape, in one app. That is not a styling
 * preference, it is a layout law nobody owned, and the cost is that a card is 2-up on one route and
 * 3-up on another at the same viewport.
 *
 * **`cols` is the DESKTOP count, and it is the only number a consumer states.** The law is
 * `base 1 → sm min(cols, 2) → lg cols`: a phone gets one column because a dashboard card holds a
 * chart; a tablet gets at most two because a third makes every chart narrower than
 * `VX.phoneChartWidth`; the full count lands at `lg`. Mantine's `cols={{ … }}` object is
 * deliberately NOT forwarded — a responsive object on the public prop is exactly the seam that let
 * five call sites disagree.
 *
 * **This is the sanctioned place `lg` enters the package.** `sm` is still the only breakpoint a
 * consumer writes (`docs/CONTROLS-SPEC.md` §2); `WidgetGrid` and `StatGroup` own `lg` internally so
 * nobody else has to.
 *
 * `WidgetGrid.Item` is for the one card that is wider than the rest — a hero chart beside two
 * stacked panels. `span` is likewise the DESKTOP span and is CLAMPED to the live column count at
 * each breakpoint, so a `span={3}` in a 2-up `sm` row cannot spill into an implicit third track.
 * A child rendered WITHOUT an `Item` simply occupies one column; the wrapper is not required.
 *
 * @example
 * import { WidgetGrid } from 'basalt-ui'
 *
 * <WidgetGrid cols={3}>
 *   <ChartCard title="Revenue">…</ChartCard>
 *   <ChartCard title="Sessions">…</ChartCard>
 *   <ChartCard title="Errors">…</ChartCard>
 * </WidgetGrid>
 *
 * @example
 * // The 8/4 split every dashboard has, without a 12-column vocabulary.
 * <WidgetGrid cols={3}>
 *   <WidgetGrid.Item span={2}>
 *     <ChartCard title="Total sales over time">…</ChartCard>
 *   </WidgetGrid.Item>
 *   <Section title="Top channels">…</Section>
 * </WidgetGrid>
 */
import { createContext, useContext, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import classes from './widget-grid.module.css'

/** The desktop column count. Four is the ceiling: a fifth widget column is a KPI row — `StatGroup`. */
export type WidgetGridCols = 1 | 2 | 3 | 4

/** The resolved counts at the two breakpoints the law names. Base is always 1 and needs no member. */
type ResolvedCols = { readonly sm: number; readonly lg: number }

/**
 * The live column count, published so `WidgetGrid.Item` can CLAMP its span against it. A context
 * rather than a CSS `min()` because `grid-column: span <n>` takes an integer, not a calculation —
 * and an unclamped span is the failure that looks like a bug: a `span={3}` inside a 2-up row opens
 * a third, empty implicit track and every sibling below it goes out of alignment.
 *
 * The default is the component's own `cols` default, so an `Item` rendered outside a grid (a
 * consumer's own wrapper, a test) behaves like one inside a default grid instead of throwing.
 */
const WidgetGridColsContext = createContext<ResolvedCols>({ sm: 2, lg: 2 })

export type WidgetGridProps = BasaltProps & {
  /** The DESKTOP column count (`lg` and up). Default `2`. Below that the law resolves it: `sm` gets
   * `min(cols, 2)`, a phone gets 1. Never a responsive object — see the module docblock. */
  cols?: WidgetGridCols
  /** The widgets. A plain child takes one column; wrap it in `WidgetGrid.Item` to span more. */
  children: ReactNode
}

export function WidgetGrid({ cols = 2, children, className, style }: WidgetGridProps) {
  const resolved = useMemo<ResolvedCols>(() => ({ sm: Math.min(cols, 2), lg: cols }), [cols])

  return (
    <WidgetGridColsContext.Provider value={resolved}>
      <div
        className={cx(classes.root, className)}
        data-cols={cols}
        style={
          {
            '--basalt-widget-grid-cols-sm': resolved.sm,
            '--basalt-widget-grid-cols-lg': resolved.lg,
            ...style,
          } as CSSProperties
        }
      >
        {children}
      </div>
    </WidgetGridColsContext.Provider>
  )
}

export type WidgetGridItemProps = BasaltProps & {
  /** The DESKTOP span, clamped to the live column count at every narrower breakpoint. Default `1`. */
  span?: WidgetGridCols
  /** The one widget this cell holds. */
  children: ReactNode
}

/**
 * One cell of a {@link WidgetGrid}, spanning more than one column. Reached as `WidgetGrid.Item`.
 */
function WidgetGridItem({ span = 1, children, className, style }: WidgetGridItemProps) {
  const cols = useContext(WidgetGridColsContext)

  return (
    <div
      className={cx(classes.item, className)}
      data-span={span}
      style={
        {
          '--basalt-widget-grid-span-sm': Math.min(span, cols.sm),
          '--basalt-widget-grid-span-lg': Math.min(span, cols.lg),
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}

WidgetGrid.Item = WidgetGridItem
