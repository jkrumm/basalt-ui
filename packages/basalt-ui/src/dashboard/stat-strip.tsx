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
import { cx } from '../common/props'
import type { BasaltProps, Tone } from '../common/props'
import { VX } from '../tokens'
import { InfoGlyph } from './widget-header'
import classes from './stat-strip.module.css'

export type StatStripRow = {
  key: string
  label: string
  /** `null` = no reading, printed as `—`. Pre-join the unit (`'48 ms'`). */
  value: string | null
  visual?: ReactNode
  /** A `DeltaBadge`. */
  delta?: ReactNode
}

export type StatStripCell = {
  key: string
  caption: string
  /** Muted, on the caption line: `CAPTION · qualifier`. */
  qualifier?: string
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

function StripCell({ cell }: { cell: StatStripCell }) {
  const captionId = useId()
  const { rows, loading } = cell
  const hasHero = cell.value !== undefined || rows === undefined
  return (
    <article
      className={classes.cell}
      data-strip-cell={cell.key}
      data-shot={`strip-${cell.key}`}
      aria-labelledby={captionId}
      {...(cell.stale && { 'data-stale': 'true' })}
    >
      <div className={classes.captionLine}>
        <span className={classes.caption} id={captionId} data-strip-caption>
          {cell.caption}
        </span>
        {cell.qualifier !== undefined && (
          <span className={classes.qualifier}>· {cell.qualifier}</span>
        )}
        {cell.info !== undefined && <InfoGlyph text={cell.info} />}
      </div>
      {hasHero &&
        (loading ? (
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
        ))}
      {cell.visual !== undefined && <div className={classes.visual}>{cell.visual}</div>}
      {rows !== undefined &&
        (loading ? (
          <div className={classes.rows} aria-hidden="true">
            {rows.map((row) => (
              <Skeleton key={row.key} className={classes.skeletonRow} radius="sm" />
            ))}
          </div>
        ) : (
          <ul className={classes.rows}>
            {rows.map((row) => (
              <li key={row.key} className={classes.row} data-strip-row={row.key}>
                <span className={classes.rowLabel}>{row.label}</span>
                <span className={classes.visual}>{row.visual}</span>
                <span className={classes.rowValue}>{row.value ?? EMPTY}</span>
                <span>{row.delta}</span>
              </li>
            ))}
          </ul>
        ))}
      {cell.footer !== undefined && <div className={classes.footer}>{cell.footer}</div>}
    </article>
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
