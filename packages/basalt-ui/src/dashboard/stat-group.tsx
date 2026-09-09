/**
 * StatGroup — the KPI row, and the second half of the column law `WidgetGrid` owns for widgets
 * (audit B #6/#7). Same argument, different numbers: a KPI is a short pre-formatted string, so it
 * packs tighter than a chart card and the law starts at TWO on a phone.
 *
 * **`cols` is the DESKTOP count** and the only number a consumer states; the law is
 * `base 2 → sm min(cols, 3), except 4 → 2 → lg cols`. Five is the ceiling — past that the cells are narrower than
 * a formatted currency value and the row is a table.
 *
 * **`lg` enters the package here and in `WidgetGrid`, nowhere else.** `sm` stays the only
 * breakpoint a consumer writes (`docs/CONTROLS-SPEC.md` §2).
 *
 * **The column law keys on the CONTAINER, not the viewport.** `StatGroup` renders its own
 * `container-type: inline-size` box around the grid, so the counts follow the width the row
 * ACTUALLY has — a `PageAside` claiming 300px, a collapsed sidebar giving 208px back, a consumer's
 * split pane — rather than the viewport width, which changes for none of those. See
 * `stat-group.module.css`'s header for the measured defect and the pre-2023 fallback.
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
  /** The DESKTOP column count (`lg` and up). Default `4`. `sm` gets `min(cols, 3)` — except `4`, which gets 2 rather than an orphan row. A phone gets 2.
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
  // `4 -> 2`, not `4 -> 3`. `min(cols, 3)` is the general rule and it is right for 2, 3 and 5, but
  // FOUR is the default and the overwhelmingly common count, and three columns leave a four-KPI row
  // as 3 + 1 — one orphan cell against two thirds of empty track. MEASURED on the playground
  // dashboard with a `PageAside` claimed (group 916px): three cells of ~273px plus an orphan, where
  // two of ~450px read as one balanced block. A KPI row is a set of peers; a ragged last row says
  // one of them is different, which is the one thing it must not say.
  const smCols = cols === 4 ? 2 : Math.min(cols, 3)

  return (
    // Two boxes, and the outer one is not decoration: a size container is a container for its
    // DESCENDANTS, never for itself, so the grid whose tracks the query decides has to sit inside
    // the box being measured. `className`/`style` land on the OUTER box because that is the root
    // element a consumer positions (`BasaltProps`) — and because measuring the box the consumer
    // sized is the whole point. `container-type: inline-size` contains the inline axis only, so the
    // wrapper's block size still comes from the grid: no percentage height resolves differently,
    // and there is no paint containment, so nothing inside is clipped.
    <div className={cx(classes.container, className)} style={style}>
      <div
        className={classes.root}
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
          } as CSSProperties
        }
      >
        {children}
      </div>
    </div>
  )
}
