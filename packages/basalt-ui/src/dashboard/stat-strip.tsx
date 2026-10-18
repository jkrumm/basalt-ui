/**
 * StatStrip — the body of `StatGroup variant="strip"`: KPI cells joined into one surface and split
 * by hairlines, with an optional footer row of wider cells. Internal: reached through `StatGroup`.
 *
 * Cell anatomy: a mono caption (with `· qualifier` muted on the same line and the `info` glyph), the
 * hero `value` in the proportional sans, an optional `delta`, `visual` and `footer` line. `rows`
 * replaces the hero with aligned `label · visual · value · delta` rows (one cell, several signals).
 * `tone` inks the VALUE only, for a verdict; a null reading is `—`. A cell may carry BOTH: the hero
 * (e.g. VO2max) with `rows` under it; omit `value` to render the rows alone.
 *
 * `state` replaces the readings (hero, visual, rows, footer) with the cell's empty or error body, at
 * the cell's size. Empty: `—` in the value position and the reason, muted. Error: the shared error
 * anatomy compact — status dot, the word `Failed`, the message, the shared Retry. The caption stays.
 * A `visual` is a hero host: a zoned `Meter` in it does not repeat the value at its marker.
 *
 * Alignment: cells of one row align by PART (caption, value, hero footer, visual, rows, footer share
 * tracks via subgrid), and each cell spans only down to its last part, so its own box ends at its
 * content. A footer rides with what it captions (under the hero: its own track right below it).
 * The dividers belong to a row-high slot around the cell, so they run the whole row and the area
 * under a short cell is the strip's own surface. `action` sits at the end of the caption line (the
 * caption truncates first); a row with `hideValue` prints its label alone.
 *
 * Anchors: each cell is `data-shot="strip-<key>"` and each footer cell
 * `data-shot="strip-footer-<key>"` (derived — a consumer cannot choose another name).
 *
 * Mapping from a prototype: warden's JSX `qualifier` line UNDER the value is `footer`; the cell
 * `qualifier` is the short `· text` on the caption line. Cells are equal-weight: unequal column
 * weights are not supported. `stale` dims a cell while placeholder data shows.
 */
import { Card, Skeleton } from '@mantine/core'
import { useId } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { toErrorMessage } from '../common/errors'
import { cx } from '../common/props'
import type { BasaltProps, Tone } from '../common/props'
import { RetryButton } from '../common/retry-button'
import { StatusDot } from '../theme/status-dot'
import { VX } from '../tokens'
import { InfoGlyph } from './widget-header'
import classes from './stat-strip.module.css'
import { HOSTED, VisualSlotContext } from './visual-slot'

export type StatStripRow = {
  key: string
  label: string
  /** `null` = no reading, printed as `—`. Pre-join the unit (`'48 ms'`). */
  value: string | null
  visual?: ReactNode
  /** A `DeltaBadge`. */
  delta?: ReactNode
  /** The reading is already shown (the hero): print the label alone. `value` is ignored. */
  hideValue?: boolean
}

/** What a cell shows instead of its readings. Mirrors `StatCard`'s `query` branches. */
type StatStripCellState =
  | {
      kind: 'empty'
      /** Why there is no reading, one muted line (`'No sleep logged'`). */
      reason?: string
    }
  | {
      kind: 'error'
      /** Whatever was thrown; decoded like `ErrorState`'s. */
      error?: unknown
      /** Renders the shared Retry button. */
      onRetry?: () => void
      /** A refetch is in flight: Retry is inert. */
      retrying?: boolean
    }

export type StatStripCell = {
  key: string
  caption: string
  /** Muted, on the caption line: `CAPTION · qualifier`. */
  qualifier?: string
  /** A control at the end of the caption line (a popover trigger). Never wraps the line: the
   * caption truncates first. */
  action?: ReactNode
  /** The definition behind the caption, in the info-glyph tooltip. */
  info?: string
  /** `null` = no reading, printed as `—`. Omit only when `rows` carries the cell. */
  value?: string | null
  unit?: string
  /** A `DeltaBadge`. */
  delta?: ReactNode
  /** The micro-visual slot (Meter / Sparkline / BandStrip). */
  visual?: ReactNode
  /** A muted line pinned to the cell foot. */
  footer?: ReactNode
  /** Aligned signals under the hero (or alone when `value` is omitted). */
  rows?: readonly StatStripRow[]
  /** Inks the value only — set it when the reading is a verdict. */
  tone?: Tone
  /** Skeleton in place of the readings. */
  loading?: boolean
  /** Dims the cell while placeholder data shows. */
  stale?: boolean
  /** Empty or failed: replaces the readings; `loading` wins while pending. */
  state?: StatStripCellState
}

export type StatStripProps = BasaltProps & {
  /** The strip's accessible name. */
  label: string
  cells: readonly StatStripCell[]
  /** Wider cells under the cells. */
  footer?: readonly { key: string; content: ReactNode }[]
  /** The DESKTOP column count. Default: the cell count, capped at 6. */
  cols?: 2 | 3 | 4 | 5 | 6
}

const EMPTY = '—'

function CellState({ state }: { state: StatStripCellState }) {
  if (state.kind === 'empty') {
    return (
      <>
        <div className={classes.valueRow}>
          <span className={classes.value} data-strip-value>
            {EMPTY}
          </span>
        </div>
        {state.reason !== undefined && <p className={classes.reason}>{state.reason}</p>}
      </>
    )
  }
  const message = toErrorMessage(state.error, 'The request failed.')
  return (
    <div className={classes.error} role="alert" data-strip-state="error">
      <span className={classes.errorHead}>
        <StatusDot color={VX.status.bad} />
        Failed
      </span>
      <p className={classes.reason}>{message}</p>
      {state.onRetry !== undefined && (
        <RetryButton onClick={state.onRetry} retrying={state.retrying ?? false} />
      )}
    </div>
  )
}

/** The last of the six shared tracks (caption, hero, hero footer, visual, rows, footer) a cell paints into. */
function lastTrackOf(cell: StatStripCell, state: StatStripCellState | undefined, hasHero: boolean) {
  if (state !== undefined) return state.kind === 'empty' && state.reason !== undefined ? 4 : 2
  if (cell.rows !== undefined)
    return cell.footer !== undefined ? 6 : cell.visual !== undefined ? 5 : 4
  if (cell.visual !== undefined) return 4
  if (!hasHero) return 1
  return cell.footer !== undefined ? 3 : 2
}

function StripCell({ cell }: { cell: StatStripCell }) {
  const captionId = useId()
  const { rows, loading } = cell
  const state = loading ? undefined : cell.state
  const hasHero = cell.value !== undefined || rows === undefined
  // A footer under a visual (and no rows) rides with it, so it hugs that visual instead of dropping
  // to a taller sibling's; under a hero alone it rides with the value; only under rows does it take
  // the row's shared footer track.
  const ownFooter = cell.visual !== undefined && rows === undefined
  const heroFooter = hasHero && cell.visual === undefined && rows === undefined
  // The cell spans the tracks down to its last part, so its box ends at its content (the slot
  // around it still runs the whole row for the dividers).
  const lastTrack = lastTrackOf(cell, state, hasHero)
  const footerEl = cell.footer !== undefined && (
    <div className={cx(classes.footer, heroFooter && classes.heroFooter)} data-strip-footer>
      {cell.footer}
    </div>
  )
  const heroEl = loading ? (
    <Skeleton className={classes.skeletonValue} radius="sm" />
  ) : (
    <div className={classes.valueRow}>
      <span
        className={classes.value}
        data-strip-value
        style={cell.tone !== undefined ? { color: VX.status[cell.tone] } : undefined}
      >
        {cell.value ?? EMPTY}
      </span>
      {cell.value !== undefined && cell.value !== null && cell.unit !== undefined && (
        <span className={classes.unit}>{cell.unit}</span>
      )}
      {cell.delta}
    </div>
  )
  return (
    // The slot owns the dividers and stretches to the row; the article inside ends at its content.
    <div className={classes.cell} data-strip-slot>
      <article
        className={classes.content}
        style={{ '--basalt-strip-span': lastTrack } as CSSProperties}
        data-strip-cell={cell.key}
        data-shot={`strip-${cell.key}`}
        aria-labelledby={captionId}
        {...(state === undefined && cell.visual !== undefined && { 'data-strip-has-visual': '' })}
        {...(state === undefined && rows !== undefined && { 'data-strip-has-rows': '' })}
        {...(cell.stale && { 'data-stale': 'true' })}
      >
        <div className={classes.captionLine}>
          <div className={classes.captionMain}>
            {/* The caption and its info glyph are one unit: the qualifier wraps whole, never between them. */}
            <span className={classes.lead}>
              <span
                className={classes.caption}
                id={captionId}
                title={cell.caption}
                data-strip-caption
              >
                {cell.caption}
              </span>
              {cell.info !== undefined && <InfoGlyph text={cell.info} />}
            </span>
            {cell.qualifier !== undefined && (
              <span className={classes.qualifier}>{cell.qualifier}</span>
            )}
          </div>
          {cell.action !== undefined && (
            <span className={classes.action} data-strip-action>
              {cell.action}
            </span>
          )}
        </div>
        {state !== undefined && <CellState state={state} />}
        {state === undefined && hasHero && heroEl}
        {state === undefined && heroFooter && footerEl}
        {state === undefined && cell.visual !== undefined && (
          <div className={classes.visualStack}>
            <div className={classes.visual} data-strip-visual>
              <VisualSlotContext.Provider value={hasHero ? HOSTED : null}>
                {cell.visual}
              </VisualSlotContext.Provider>
            </div>
            {ownFooter && footerEl}
          </div>
        )}
        {state === undefined &&
          rows !== undefined &&
          (loading ? (
            <div className={classes.rows} aria-hidden="true">
              {rows.map((row) => (
                <Skeleton key={row.key} className={classes.skeletonRow} radius="sm" />
              ))}
            </div>
          ) : (
            <ul className={classes.rows} data-strip-rows>
              {rows.map((row) => (
                <li key={row.key} className={classes.row} data-strip-row={row.key}>
                  <span className={classes.rowLabel}>{row.label}</span>
                  <span className={classes.visual}>{row.visual}</span>
                  <span className={classes.rowValue}>
                    {row.hideValue ? null : (row.value ?? EMPTY)}
                  </span>
                  <span>{row.delta}</span>
                </li>
              ))}
            </ul>
          ))}
        {state === undefined && !ownFooter && !heroFooter && footerEl}
      </article>
    </div>
  )
}

export function StatStrip({ label, cells, footer, cols, className, style }: StatStripProps) {
  const desktop = cols ?? Math.min(Math.max(cells.length, 2), 6)
  // `StatGroup`'s rule: four is 2 + 2 below the full count, never 3 + 1.
  const mid = desktop === 4 ? 2 : Math.min(desktop, 3)
  return (
    <div className={cx(classes.container, className)} style={style}>
      <Card>
        <Card.Section
          component="section"
          aria-label={label}
          className={classes.clip}
          style={
            {
              '--basalt-strip-cols': desktop,
              '--basalt-strip-cols-sm': mid,
            } as CSSProperties
          }
        >
          <div className={classes.cells}>
            {cells.map((cell) => (
              <StripCell key={cell.key} cell={cell} />
            ))}
          </div>
          {footer !== undefined && footer.length > 0 && (
            <div className={classes.footerRow}>
              {footer.map((entry) => (
                <div
                  key={entry.key}
                  className={classes.footerCell}
                  data-strip-footer-cell={entry.key}
                  data-shot={`strip-footer-${entry.key}`}
                >
                  {entry.content}
                </div>
              ))}
            </div>
          )}
        </Card.Section>
      </Card>
    </div>
  )
}
