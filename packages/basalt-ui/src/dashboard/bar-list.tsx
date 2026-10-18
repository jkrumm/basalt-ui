/**
 * BarList — a ranked list: label, an inline bar on ONE shared scale, a right-aligned sans value and
 * an optional muted secondary value. Choose it for "top N" (the bar ranks by length before anything
 * is read). The bar spans the label column only — values sit outside it, so a full-scale bar ends
 * before its value. Intended for 5–10 rows; past 10 use a table with an inline `Meter` cell. An
 * HTML/CSS primitive, not a chart kind.
 *
 * A row may carry its own `max` (points of 40 / 35 / 25): its bar fills value / row.max and the value
 * column reads "32 / 40". The shared scale — `max` prop, else the largest value — is computed over the
 * rows WITHOUT their own `max` only. A row's `tick` (on that row's scale) draws a hairline across the
 * bar, named for assistive tech. The default (`variant="thin"`) puts the label on its own line above a
 * thin bar with the value right-aligned on the label line; `variant="inline"` is the older heavy track
 * with the label inside it.
 *
 * Thin rows sit flush: no inline inset on the label or the rail. In a container wider than the compact
 * class (480px) a thin row reads `[label][value][secondary][track]` — the label column fits the longest
 * label, the value and secondary columns are right-aligned and shared, and the track takes the rest on
 * the one scale, so a name stays beside its value and a full-scale bar ends at the track end.
 *
 * Colour law: bars are neutral. `accentLeader` (opt-in) lets the top row take the accent — the
 * leader bar, and nothing else. Each value is rendered as text, never only a bar length.
 *
 * @example
 * import { BarList } from 'basalt-ui'
 *
 * // Recovery contributors on a fixed 0–100 scale, the qualitative level as the secondary value:
 * <BarList label="Recovery contributors" max={100} items={[{ label: 'Sleep', value: 82, secondary: 'Good' }]} />
 *
 * // Points of different maxima, a threshold tick ("32 / 40 pts"; the tick is named for AT):
 * <BarList
 *   label="Recovery contributors"
 *   format={(n, part) => (part === 'max' ? `${n} pts` : String(n))}
 *   items={[{ label: 'Sleep', value: 32, max: 40, tick: 30, tickLabel: 'Target' }, { label: 'HRV', value: 14, max: 35 }]}
 * />
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
import { asText, barPercent } from './scale'

type BarListItem = {
  label: string
  value: number
  secondary?: ReactNode
  key?: string
  /** This row's own scale end: the bar fills value / max and the value reads "value / max". */
  max?: number
  /** A hairline mark at this position on the row's scale (a threshold). */
  tick?: number
  /** Names the tick for assistive tech (visually hidden text in the track). Default "Threshold". */
  tickLabel?: string
}

export type BarListProps = BasaltProps & {
  /** Accessible name of the list. Required. */
  label: string
  /** Rows in display order (sort them yourself; the list does not reorder). */
  items: readonly BarListItem[]
  /**
   * Formats each number. `part` is `'max'` for a row's denominator, `'value'` otherwise (the value and
   * the tick), so a unit can sit on one side only: `'32 / 40 pts'`. Default: the number as written.
   */
  format?: (value: number, part: 'value' | 'max') => string
  /** Scale end shared by rows without their own `max`. Default: the largest of those rows' values. */
  max?: number
  /**
   * `thin` (default): label on its own line above a thin bar, value right-aligned on that line.
   * `inline`: the label sits inside a heavier track, the value outside it.
   */
  variant?: 'thin' | 'inline'
  /** The first row's bar takes the accent. Off by default. */
  accentLeader?: boolean
  /** Renders row-shaped skeletons. */
  loading?: boolean
  /** Skeleton rows while loading. Default 5. */
  loadingRows?: number
  /** Muted line shown when `items` is empty. */
  emptyText?: string
}

/** `null`, `undefined`, `false` and `true` render nothing, so they are not a secondary value. */
const hasContent = (node: ReactNode): boolean =>
  node !== undefined && node !== null && typeof node !== 'boolean'

export function BarList({
  label,
  items,
  format = asText,
  max,
  variant = 'thin',
  accentLeader = false,
  loading = false,
  loadingRows = 5,
  emptyText = 'No data',
  className,
  style,
}: BarListProps) {
  if (loading) {
    return (
      <div className={cx(classes.frame, className)} style={style}>
        <div className={classes.root} aria-busy="true">
          <VisuallyHidden>{`Loading ${label}`}</VisuallyHidden>
          {Array.from({ length: loadingRows }, (_, i) => (
            <Skeleton key={i} className={classes.skeletonRow} data-bar-skeleton />
          ))}
        </div>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div className={cx(classes.frame, className)} style={style}>
        <output className={classes.root} aria-label={label}>
          <span className={classes.empty}>{emptyText}</span>
        </output>
      </div>
    )
  }

  const scale =
    max ??
    items.reduce(
      (top, i) => (i.max === undefined && Number.isFinite(i.value) ? Math.max(top, i.value) : top),
      0,
    )
  const thin = variant === 'thin'
  const hasSecondary = items.some((i) => hasContent(i.secondary))
  return (
    // The frame is the width container the wide layout keys on (a container cannot restyle its own grid).
    <div className={cx(classes.frame, className)} style={style}>
      {/* The explicit role is deliberate: `list-style: none` makes Safari/VoiceOver drop the implicit one. */}
      <ul
        className={classes.root}
        // oxlint-disable-next-line jsx-a11y/no-redundant-roles
        role="list"
        aria-label={label}
        data-secondary={hasSecondary ? '' : undefined}
        data-variant={variant}
      >
        {items.map((item, i) => {
          const isLeader = accentLeader && i === 0
          const rowScale = item.max ?? scale
          const labelNode = (
            <span className={classes.label} title={item.label}>
              {item.label}
            </span>
          )
          const tickName =
            item.tick === undefined
              ? ''
              : `${item.tickLabel ?? 'Threshold'} ${format(item.tick, 'value')}`
          const track = (
            <span className={classes.track} data-bar-track>
              {/* theme-allow hidden-inline-style — the width is the row's data (a % of its scale), not styling */}
              <span
                className={cx(classes.bar, isLeader && classes.leader)}
                style={{ width: `${barPercent(item.value, rowScale)}%` }}
                data-bar-fill=""
                data-bar-leader={isLeader ? '' : undefined}
                aria-hidden
              />
              {item.tick !== undefined && (
                // theme-allow hidden-inline-style — the position is the row's data (a % of its scale)
                <span
                  className={classes.tick}
                  style={{ insetInlineStart: `${barPercent(item.tick, rowScale)}%` }}
                  data-bar-tick=""
                  aria-hidden
                />
              )}
              {!thin && labelNode}
              {/* Inside the track so it is never the row's last child (the value/secondary inset). */}
              {item.tick !== undefined && <VisuallyHidden>{tickName}</VisuallyHidden>}
            </span>
          )
          return (
            <li key={item.key ?? `${item.label}-${i}`} className={classes.row}>
              {thin && labelNode}
              {!thin && track}
              <span className={classes.value}>
                {Number.isFinite(item.value)
                  ? item.max === undefined
                    ? format(item.value, 'value')
                    : `${format(item.value, 'value')} / ${format(item.max, 'max')}`
                  : '—'}
              </span>
              {/* Kept empty on a row without one: the secondary column is shared, so every row has the cell. */}
              {hasSecondary && <span className={classes.secondary}>{item.secondary}</span>}
              {thin && track}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
