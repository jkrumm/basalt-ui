/**
 * StatGroup — the KPI row, and the second half of the column law `WidgetGrid` owns for widgets
 * (audit B #6/#7). Same argument, different numbers: a KPI is a short pre-formatted string, so it
 * packs tighter than a chart card and the law starts at TWO on a phone.
 *
 * **`cols` is the DESKTOP count** and the only number a consumer states; the law is
 * `base 2 → sm min(cols, 3) → lg cols`. Five is the ceiling — past that the cells are narrower than
 * a formatted currency value and the row is a table.
 *
 * **`lg` enters the package here and in `WidgetGrid`, nowhere else.** `sm` stays the only
 * breakpoint a consumer writes (`docs/CONTROLS-SPEC.md` §2).
 *
 * `divided` swaps the column gap for a hairline rail between cells — the bare-metric-row look, for
 * KPIs that are one reading split several ways rather than several independent cards. It draws the
 * rule on the GROUP, so the cells stay whatever they are; on `StatCard`s (which carry their own
 * panel and shadow ring) the rail reads as a second frame, so pair it with unadorned children.
 *
 * @example
 * import { StatCard, StatGroup } from 'basalt-ui'
 *
 * <StatGroup cols={4}>
 *   {kpis.map((kpi) => (
 *     <StatCard key={kpi.key} title={kpi.title} value={kpi.value} delta={kpi.delta} />
 *   ))}
 * </StatGroup>
 */
import type { CSSProperties, ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import classes from './stat-group.module.css'

/** The desktop KPI column count. */
export type StatGroupCols = 2 | 3 | 4 | 5

export type StatGroupProps = BasaltProps & {
  /** The DESKTOP column count (`lg` and up). Default `4`. `sm` gets `min(cols, 3)`, a phone gets 2.
   * Never a responsive object — the law is basalt's, see the module docblock. */
  cols?: StatGroupCols
  /** Swap the column gap for a hairline rail between cells. Default `false`. */
  divided?: boolean
  /** The KPI cells — normally `StatCard`s. */
  children: ReactNode
}

export function StatGroup({
  cols = 4,
  divided = false,
  children,
  className,
  style,
}: StatGroupProps) {
  const smCols = Math.min(cols, 3)

  return (
    <div
      className={cx(classes.root, className)}
      data-cols={cols}
      data-sm-cols={smCols}
      // An ATTRIBUTE, not a second class: the rail's rules key off the resolved column count
      // (`[data-cols]`/`[data-sm-cols]`) already, so one selector shape carries the whole law —
      // same idiom `stat-card.module.css` uses for `[data-placement]`.
      {...(divided && { 'data-divided': 'true' })}
      style={
        {
          '--basalt-stat-group-cols-sm': smCols,
          '--basalt-stat-group-cols-lg': cols,
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  )
}
