/**
 * BarList — a ranked list: label, an inline bar on ONE shared scale, a mono right-aligned value and
 * an optional muted secondary value. Choose it for "top N" (the bar ranks by length before anything
 * is read). Intended for 5–10 rows; past 10 use a table with an inline `Meter` cell. An HTML/CSS
 * primitive, not a chart kind.
 *
 * Colour law: bars are neutral. `accentLeader` (opt-in) lets the top row take the accent — the
 * leader bar, and nothing else. Each value is rendered as text, never only a bar length.
 *
 * @example
 * import { BarList } from 'basalt-ui'
 *
 * <BarList
 *   label="Top projects by tokens"
 *   items={[{ label: 'argo', value: 1840, secondary: '41%' }, { label: 'rb', value: 920 }]}
 *   format={compact}
 *   accentLeader
 * />
 */
import { Skeleton, VisuallyHidden } from '@mantine/core'
import type { ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps } from '../common/props'
import classes from './bar-list.module.css'

export type BarListProps = BasaltProps & {
  /** Accessible name of the list. Required. */
  label: string
  /** Rows in display order (sort them yourself; the list does not reorder). */
  items: readonly { label: string; value: number; secondary?: ReactNode; key?: string }[]
  /** Formats each value. Default: the number as written. */
  format?: (value: number) => string
  /** Scale end shared by every bar. Default: the largest value. */
  max?: number
  /** The first row's bar takes the accent. Off by default. */
  accentLeader?: boolean
  /** Renders row-shaped skeletons. */
  loading?: boolean
  /** Skeleton rows while loading. Default 5. */
  loadingRows?: number
  /** Muted line shown when `items` is empty. */
  emptyText?: string
}

const asText = (n: number): string => String(n)

export function BarList({
  label,
  items,
  format = asText,
  max,
  accentLeader = false,
  loading = false,
  loadingRows = 5,
  emptyText = 'No data',
  className,
  style,
}: BarListProps) {
  if (loading) {
    return (
      <div className={cx(classes.root, className)} style={style} aria-busy="true">
        <VisuallyHidden>{`Loading ${label}`}</VisuallyHidden>
        {Array.from({ length: loadingRows }, (_, i) => (
          <Skeleton key={i} className={classes.skeletonRow} data-bar-skeleton />
        ))}
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className={cx(classes.root, className)} style={style}>
        <span className={classes.empty}>{emptyText}</span>
      </div>
    )
  }

  const scale = max ?? Math.max(...items.map((i) => i.value))
  return (
    <ul className={cx(classes.root, className)} style={style} aria-label={label}>
      {items.map((item, i) => {
        const pct = scale > 0 ? Math.min(1, Math.max(0, item.value / scale)) * 100 : 0
        return (
          <li key={item.key ?? item.label} className={classes.row}>
            {/* theme-allow hidden-inline-style — the width is the row's data (a % of the shared scale), not styling */}
            <span
              className={cx(classes.bar, accentLeader && i === 0 && classes.leader)}
              style={{ width: `${pct}%` }}
              data-bar-pct={pct}
              {...(accentLeader && i === 0 && { 'data-bar-leader': '' })}
              aria-hidden
            />
            <span className={classes.label} title={item.label}>
              {item.label}
            </span>
            <span className={classes.value}>{format(item.value)}</span>
            {item.secondary !== undefined && (
              <span className={classes.secondary}>{item.secondary}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
