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
 * The secondary column aligns by content (override: `secondaryAlign`): a text secondary (a status word,
 * `StatusVerdict`/`StatusDot`) starts on one x so the dots line up; figures ("41%", "+€7"), numbers and a
 * `DeltaBadge` end. A delta column also gets a fixed-width glyph slot and a tabular figure slot, so the
 * glyphs AND the figures' right edges line up (a column of deltas is table-like, D33 allows tabular there).
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
import { EmptyState } from './empty-state'
import { isValidElement } from 'react'
import type { ReactNode } from 'react'
import { cx, pickDataAttributes } from '../common/props'
import type { BasaltProps, DataAttributes } from '../common/props'
import classes from './bar-list.module.css'
import { StatusDot } from '../theme/status-dot'
import { StatusVerdict } from '../theme/status-verdict'
import { skeletonRowCount } from './event-list-model'
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

export type BarListProps = BasaltProps &
  DataAttributes & {
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
    /**
     * Which edge the secondary column aligns to. Default: by content — text (a status word, a status
     * mark) starts, figures and other elements end.
     */
    secondaryAlign?: 'start' | 'end'
    /** Renders row-shaped skeletons. */
    loading?: boolean
    /** Skeleton rows while loading. Default: the rows `items` holds now (a refetch, capped at 30), else 5. */
    loadingRows?: number
    /** Title of the `EmptyState` tile shown when `items` is empty. Default "No items to compare yet"; pass the cause for your list. */
    emptyText?: string
  }

/** `null`, `undefined`, `false` and `true` render nothing, so they are not a secondary value. */
const hasContent = (node: ReactNode): boolean =>
  node !== undefined && node !== null && typeof node !== 'boolean'

const isFigure = (node: ReactNode): boolean =>
  typeof node === 'number' || (typeof node === 'string' && /^[\s+\-−±▲▼]*[€$£¥]?\d/.test(node))

/**
 * The column's edge by content. A string that is not a figure and a status mark (`StatusVerdict`,
 * `StatusDot`) are text and start on one x so the dots line up; a number, a numeric string and any other
 * element (a `DeltaBadge`) are figures and keep the end edge.
 */
const isText = (node: ReactNode): boolean =>
  typeof node === 'string'
    ? !isFigure(node)
    : isValidElement(node) && (node.type === StatusVerdict || node.type === StatusDot)

export function BarList({
  label,
  items,
  format = asText,
  max,
  variant = 'thin',
  accentLeader = false,
  secondaryAlign,
  loading = false,
  loadingRows,
  emptyText = 'No items to compare yet',
  className,
  style,
  ...rest
}: BarListProps) {
  const data = pickDataAttributes(rest)
  if (loading) {
    // Each row is a real, empty row with a skeleton laid over it, so the list takes the height of
    // the rows it will become in every layout instead of a fixed guess.
    return (
      <div {...data} className={cx(classes.frame, className)} style={style}>
        <div className={classes.root} aria-busy="true" data-variant={variant}>
          <VisuallyHidden>{`Loading ${label}`}</VisuallyHidden>
          {Array.from({ length: skeletonRowCount(loadingRows, items.length) }, (_, i) => (
            <div
              key={i}
              className={cx(classes.row, classes.skeletonRow)}
              data-bar-skeleton
              aria-hidden
            >
              <span className={classes.label}>{'\u00a0'}</span>
              <span className={classes.value} />
              <span className={classes.track} />
              <Skeleton className={classes.skeletonFill} />
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (items.length === 0) {
    return (
      <div {...data} className={cx(classes.frame, className)} style={style}>
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a polite live region whose name is the visually hidden label inside; `<output>` cannot hold the tile's block content */}
        <div className={classes.root} role="status">
          <VisuallyHidden>{label}</VisuallyHidden>
          <EmptyState tier="section" title={emptyText} className={classes.empty} />
        </div>
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
  const align = secondaryAlign ?? (items.some((i) => isText(i.secondary)) ? 'start' : 'end')
  return (
    // The frame is the width container the wide layout keys on (a container cannot restyle its own grid).
    <div {...data} className={cx(classes.frame, className)} style={style}>
      {/* The explicit role is deliberate: `list-style: none` makes Safari/VoiceOver drop the implicit one. */}
      <ul
        className={classes.root}
        // oxlint-disable-next-line jsx-a11y/no-redundant-roles
        role="list"
        aria-label={label}
        data-secondary={hasSecondary ? '' : undefined}
        data-secondary-align={hasSecondary ? align : undefined}
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
