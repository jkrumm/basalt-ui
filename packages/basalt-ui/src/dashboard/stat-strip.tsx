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
 * `loading` keeps the loaded shape: the value bar, the visual slot and the footer line at their loaded
 * height (the visual and footer are laid out hidden under a skeleton).
 *
 * `state` replaces the readings (hero, visual, rows, footer) with the cell's empty or error body, at
 * the cell's size. Empty: the reason, muted, in the value's place (`—` only when no reason is given). Error: the shared error
 * anatomy compact — status dot, the words `Could not load`, the message, the shared Retry. The caption stays.
 * A `visual` is a hero host: a zoned `Meter` in it does not repeat the value at its marker.
 *
 * Alignment: a cell is a plain column that ends at its content (the slot around it runs the whole
 * row, so the dividers do too). Cells of one row share a caption top and a value baseline BY
 * CONSTRUCTION: the caption line is one line (it truncates with a `title`), and when any cell has a
 * qualifier a narrow cell reserves the qualifier's own line, so the parts above the value have equal
 * height. Below the value nothing is shared: a visual starts right under it, rows follow, and a
 * footer rides with the last part it captions, so a short cell never holds a taller sibling's void.
 * `action` sits at the end of the caption line (the caption truncates first); a row with `hideValue`
 * prints its label alone.
 *
 * Anchors: each cell is `data-shot="strip-<key>"` and each footer cell
 * `data-shot="strip-footer-<key>"` (derived — a consumer cannot choose another name). A footer entry
 * with `under: '<cell key>'` qualifies that one cell and is PART of it, at every width: it renders in
 * the cell's own slot under its content, so it neither stretches its siblings nor opens a void, and it
 * follows its cell when the strip folds. An entry without `under` (or naming no cell) is full width
 * under the grid.
 *
 * Absence: a page that hides the strip in a declared shot state sets `shotAbsent` on the group
 * (`['empty']`): every derived anchor, cells and footer cells, then carries `data-shot-absent`. A
 * cell's own `shotAbsent` replaces the group's for that cell (the exception).
 *
 * Mapping from a prototype: warden's JSX `qualifier` line UNDER the value is `footer`; the cell
 * `qualifier` is the short `· text` on the caption line. Cells are equal-weight: unequal column
 * weights are not supported. `stale` dims a cell while placeholder data shows.
 */
import { Card, Skeleton } from '@mantine/core'
import { useId, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { toErrorMessage } from '../common/errors'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { cx, pickDataAttributes } from '../common/props'
import type { BasaltProps, DataAttributes, Tone } from '../common/props'
import { RetryButton } from '../common/retry-button'
import { StatusDot } from '../theme/status-dot'
import { VX } from '../tokens'
import { InfoGlyph } from './widget-header'
import classes from './stat-strip.module.css'
import { couldNotLoad } from '../common/could-not-load'
import { HOSTED, HOSTED_LOADING, HOSTED_COMPACT, VisualSlotContext } from './visual-slot'

/** The URL shot states an anchor can declare itself absent in (`data-shot-absent`). */
type StatStripShotState = 'empty' | 'loading' | 'error'

const absentAttr = (states: readonly StatStripShotState[] | undefined) =>
  states === undefined || states.length === 0 ? {} : { 'data-shot-absent': states.join(' ') }

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
  /** Muted, on the caption line: `CAPTION · qualifier`. It wraps whole under the caption when it
   * does not fit (by design: no truncation, so no `title`). */
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
  /**
   * Skeleton in place of the readings, in the loaded shape: the value bar, the `visual` slot and the
   * `footer` line keep the height they have loaded. Pass the same `visual` and `footer` as at rest
   * (empty data is fine): the slot is measured, never shown — a `Meter` in it draws its own loading
   * rows, any other visual is covered by one skeleton.
   */
  loading?: boolean
  /** Dims the cell while placeholder data shows. */
  stale?: boolean
  /** Empty or failed: replaces the readings; `loading` wins while pending. */
  state?: StatStripCellState
  /** The shot states this cell's anchor is absent in; replaces the group's `shotAbsent`. */
  shotAbsent?: readonly StatStripShotState[]
}

export type StatStripFooterEntry = {
  key: string
  content: ReactNode
  /** The `key` of the cell this entry qualifies: it renders inside that cell, under its content, at
   * every width, as a sibling AFTER the article (outside its `aria-labelledby` region). For a key that
   * names no cell it takes the full width under the grid. */
  under?: string
  /** The shot states this entry is absent in; replaces the strip's `shotAbsent` (an entry production
   * omits where the strip itself shows, e.g. a fact that needs data the empty state lacks). */
  shotAbsent?: readonly StatStripShotState[]
}

export type StatStripProps = BasaltProps &
  DataAttributes & {
    /** The strip's accessible name. */
    label: string
    cells: readonly StatStripCell[]
    /** Wider cells under the cells. */
    footer?: readonly StatStripFooterEntry[]
    /** The DESKTOP column count. Default: the cell count, capped at 6. A lone cell takes the whole strip
     * whatever `cols` says. */
    cols?: 2 | 3 | 4 | 5 | 6
    /** The shot states the page hides the whole strip in (`data-shot-absent` on every derived anchor). */
    shotAbsent?: readonly StatStripShotState[]
  }

const EMPTY = '—'

function CellState({ state, caption }: { state: StatStripCellState; caption: string }) {
  if (state.kind === 'empty') {
    // A stated reason IS the gap: it takes the value's place, so no bare dash sits above it.
    if (state.reason !== undefined) {
      return (
        <p className={classes.reason} data-strip-reason>
          {state.reason}
        </p>
      )
    }
    return (
      <div className={classes.valueRow}>
        <span className={classes.value} data-strip-value>
          {EMPTY}
        </span>
      </div>
    )
  }
  const message = toErrorMessage(state.error, 'The request failed.')
  return (
    <div className={classes.error} role="alert" data-strip-state="error">
      <span className={classes.errorHead}>
        <StatusDot color={VX.status.bad} />
        {couldNotLoad(caption)}
      </span>
      <p className={classes.reason}>{message}</p>
      {state.onRetry !== undefined && (
        <RetryButton onClick={state.onRetry} retrying={state.retrying ?? false} />
      )}
    </div>
  )
}

function FooterCell({
  entry,
  shotAbsent,
  under,
}: {
  entry: StatStripFooterEntry
  shotAbsent: readonly StatStripShotState[] | undefined
  under: boolean
}) {
  return (
    <div
      className={under ? classes.underCell : classes.footerCell}
      data-strip-footer-cell={entry.key}
      data-shot={`strip-footer-${entry.key}`}
      {...absentAttr(entry.shotAbsent ?? shotAbsent)}
      {...(under && { 'data-under': entry.under })}
    >
      {entry.content}
    </div>
  )
}

function StripCell({
  cell,
  shotAbsent,
  under,
}: {
  cell: StatStripCell
  shotAbsent: readonly StatStripShotState[] | undefined
  under: readonly StatStripFooterEntry[]
}) {
  const captionId = useId()
  const { rows, loading } = cell
  const state = loading ? undefined : cell.state
  const hasHero = cell.value !== undefined || rows === undefined
  // The cell's verdict colours a plain Meter in its visual too (a hero host only). While loading, a
  // Meter in the slot draws its own loading state (the loaded rows, text painted as skeleton).
  const hostSlot = !hasHero
    ? loading
      ? HOSTED_LOADING
      : null
    : cell.tone === undefined
      ? loading
        ? HOSTED_LOADING
        : HOSTED
      : { tone: cell.tone, ...(loading && { loading }) }
  // A footer rides with what it captions: it follows the cell's last part, whatever a sibling holds.
  // Loading keeps its box (so a wrapping footer keeps its lines) and lays a skeleton over it.
  const footerEl = cell.footer !== undefined && (
    <div
      className={cx(classes.footer, loading && classes.hold)}
      data-strip-footer
      {...(loading && { 'aria-hidden': true, inert: true })}
    >
      {cell.footer}
      {loading && <Skeleton className={classes.holdSkeleton} radius="sm" />}
    </div>
  )
  // A delta can wrap under the value in a narrow cell: with one, loading lays out the loaded value row
  // (hidden) under the skeleton bar, so the cell has the lines the loaded one has.
  const heroEl = loading ? (
    cell.delta === undefined ? (
      <Skeleton className={classes.skeletonValue} radius="sm" />
    ) : (
      <div className={cx(classes.valueRow, classes.hold)} aria-hidden inert>
        <span className={classes.value}>{cell.value ?? EMPTY}</span>
        {cell.delta}
        <Skeleton className={classes.holdHero} radius="sm" />
      </div>
    )
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
    // The slot owns the dividers and runs the row; the article inside ends at its content.
    <div className={classes.cell} data-strip-slot>
      <article
        className={classes.content}
        data-strip-cell={cell.key}
        data-shot={`strip-${cell.key}`}
        aria-labelledby={captionId}
        {...absentAttr(cell.shotAbsent ?? shotAbsent)}
        {...(state !== undefined && { 'data-strip-has-state': '' })}
        {...(state === undefined && cell.visual !== undefined && { 'data-strip-has-visual': '' })}
        {...(state === undefined && rows !== undefined && { 'data-strip-has-rows': '' })}
        {...(cell.stale && { 'data-stale': 'true' })}
      >
        <div className={classes.head} data-strip-head data-basalt-header-block>
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
          {state !== undefined && <CellState state={state} caption={cell.caption} />}
          {state === undefined && hasHero && heroEl}
        </div>
        {state === undefined && cell.visual !== undefined && (
          <div
            className={cx(classes.visual, loading && classes.hold)}
            data-strip-visual
            {...(loading && { 'aria-hidden': true, inert: true })}
          >
            <VisualSlotContext.Provider value={hostSlot}>{cell.visual}</VisualSlotContext.Provider>
            {loading && <Skeleton className={classes.holdSkeleton} radius="sm" />}
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
                  <span className={classes.visual}>
                    <VisualSlotContext.Provider value={HOSTED_COMPACT}>
                      {row.visual}
                    </VisualSlotContext.Provider>
                  </span>
                  <span className={classes.rowValue} data-strip-row-value>
                    {row.hideValue ? null : (row.value ?? EMPTY)}
                  </span>
                  <span>{row.delta}</span>
                </li>
              ))}
            </ul>
          ))}
        {state === undefined && footerEl}
      </article>
      {under.map((entry) => (
        <FooterCell key={entry.key} entry={entry} shotAbsent={shotAbsent} under />
      ))}
    </div>
  )
}

/**
 * One anatomy, a shared visual line: the cells of a row put the top of their drawn mark (Meter track, plot) on one line.
 * Each cell's head (caption line, qualifier, value row) keeps its own height, so a longer qualifier
 * pushes only its own value down; a visual cell whose head is shorter than a sibling's visual offset
 * grows ITS head's min-height by the difference. Cells without a visual are untouched, so a footer
 * still hugs its value and no sibling is stretched.
 */
const DRAWN_MARK = '[data-meter-track], [data-basalt-sparkline], [data-basalt-chart]'

function alignVisuals(root: HTMLElement): void {
  const rows = new Map<number, { head: HTMLElement; natural: number; offset: number }[]>()
  for (const head of root.querySelectorAll<HTMLElement>('[data-strip-head]')) {
    const article = head.parentElement
    const visual = article?.querySelector<HTMLElement>('[data-strip-visual]')
    // The shared line is the top of the drawn MARK (Meter track, sparkline or chart plot): a Meter's
    // caption or tick-label row above its track sits above that line.
    const plot = visual?.querySelector(DRAWN_MARK) ?? visual?.firstElementChild
    const last = head.lastElementChild
    if (!article || !plot || !last) continue
    const { top, bottom } = head.getBoundingClientRect()
    const articleTop = article.getBoundingClientRect().top
    // The head's own height (its content, bottom of the last part) without any min-height we set.
    const natural = last.getBoundingClientRect().bottom - top
    const grown = bottom - top - natural
    const key = Math.round(articleTop)
    rows.set(key, [
      ...(rows.get(key) ?? []),
      { head, natural, offset: plot.getBoundingClientRect().top - articleTop - Math.max(grown, 0) },
    ])
  }
  for (const cells of rows.values()) {
    const target = cells.length < 2 ? 0 : Math.max(...cells.map((c) => c.offset))
    for (const { head, natural, offset } of cells) {
      const grow = target - offset
      const next = grow > 0.5 ? `${natural + grow}px` : ''
      if (head.style.minHeight !== next) head.style.minHeight = next
    }
  }
}

export function StatStrip({
  label,
  cells,
  footer,
  cols,
  shotAbsent,
  className,
  style,
  ...domProps
}: StatStripProps) {
  // A lone cell is the whole strip: a stated `cols` would leave it one track of an empty grid.
  const desktop = cells.length === 1 ? 1 : (cols ?? Math.min(Math.max(cells.length, 2), 6))
  // `StatGroup`'s rule: four is 2 + 2 below the full count, never 3 + 1.
  const mid = desktop === 4 ? 2 : Math.min(desktop, 3)
  const keys = new Set(cells.map((cell) => cell.key))
  const underOf = (key: string) => footer?.filter((entry) => entry.under === key) ?? []
  const rest = footer?.filter((entry) => entry.under === undefined || !keys.has(entry.under)) ?? []
  const hasQualifier = cells.some((cell) => cell.qualifier !== undefined)
  const hasAction = cells.some((cell) => cell.action !== undefined)
  const gridRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<ResizeObserver | null>(null)
  const watched = useRef('')
  // Mount-only: one observer; a resize or a late font re-levels in the next frame (a write inside the
  // callback would resize the observed grid in the same frame).
  useIsomorphicLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid || typeof ResizeObserver === 'undefined') return
    let frame = 0
    let live = true
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => alignVisuals(grid))
    }
    const observer = new ResizeObserver(schedule)
    observerRef.current = observer
    void document.fonts?.ready?.then(() => {
      if (live) schedule()
    })
    return () => {
      live = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      observerRef.current = null
      watched.current = ''
    }
  }, [])
  // Re-level when the cells change, and watch the heads that now exist: a head that rewraps without
  // changing the grid's height re-levels too.
  useIsomorphicLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    alignVisuals(grid)
    const observer = observerRef.current
    const key = cells.map((cell) => cell.key).join('|')
    if (!observer || watched.current === key) return
    watched.current = key
    observer.disconnect()
    observer.observe(grid)
    for (const head of grid.querySelectorAll('[data-strip-head]')) observer.observe(head)
  }, [cells, footer])
  return (
    <div
      {...pickDataAttributes(domProps)}
      className={cx(classes.container, className)}
      style={style}
    >
      <Card>
        <Card.Section
          component="section"
          aria-label={label}
          className={classes.clip}
          {...(hasQualifier && { 'data-strip-qualifier': '' })}
          {...(hasAction && { 'data-strip-action-row': '' })}
          style={
            {
              '--basalt-strip-cols': desktop,
              '--basalt-strip-cols-sm': mid,
            } as CSSProperties
          }
        >
          <div ref={gridRef} className={classes.cells}>
            {cells.map((cell) => (
              <StripCell
                key={cell.key}
                cell={cell}
                shotAbsent={shotAbsent}
                under={underOf(cell.key)}
              />
            ))}
          </div>
          {rest.length > 0 && (
            <div className={classes.footerRow}>
              {rest.map((entry) => (
                <FooterCell key={entry.key} entry={entry} shotAbsent={shotAbsent} under={false} />
              ))}
            </div>
          )}
        </Card.Section>
      </Card>
    </div>
  )
}
