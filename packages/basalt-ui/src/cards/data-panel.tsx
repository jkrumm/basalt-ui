import { useContext, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react'
import { HostTitleContext } from '../core/could-not-load'
import { FrameArmContext } from '../core/frame-arm'
import { PhaseBoundary } from '../core/phase-boundary'
import { resolvePhase } from '../core/phase'
import { cn } from '../core/cn'
import { useMessages } from '../core/messages/use-messages'
import { cards } from '../core/messages/cards'
import { CardMenu } from '../core/card-menu'
import { Card, CardInfo, CardPhase, IconTile, Inset } from '../ui/card'
import type { DataPanelProps, LegendEntry } from './contract'
import {
  FrameDepthContext,
  MAX_DEPTH,
  MAX_INLINE_CONTROLS,
  useAboutLabel,
  warnOnce,
} from './stat-group-shared'

/** The row height a `{ rows }` body is declared in until the table's row token is read: the `:root` default (dense) density, 2rem. */
const DEFAULT_ROW = 32

/**
 * The phase arms (error, empty) are laid out for 96 px, so a panel never draws a body shorter than
 * that, whatever `bodySize` asks for.
 */
const MIN_BODY = 96

/**
 * The body box height `bodySize` declares. A `rows` count is table rows at the table's row height
 * (`--basalt-row-h`, the head row included), so it is `rows` times that height. The loading, error,
 * empty and ready body all hold it.
 */
const bodyHeightOf = (size: DataPanelProps['bodySize'], rowPx: number): number => {
  const px = 'rows' in size ? Math.max(0, Math.round(size.rows)) * rowPx : Math.round(size.height)
  return Math.max(MIN_BODY, px)
}

/**
 * The same height as `bodyHeightOf` for a `rows` body, as CSS: the table row token is read by the
 * browser (the coarse-pointer tier is taller than the dense one), so the server HTML and the first client
 * render are one height before the token is measured. The fallback is the `:root` default, 2rem. The
 * `MIN_BODY` floor is `min-h-24` (6rem, 96 px) on the same box.
 */
const rowsHeightCss = (rows: number): string =>
  `calc(${Math.max(0, Math.round(rows))} * var(--basalt-row-h, 2rem))`

/**
 * The tallest phone row the kit draws: a title, two muted values and the answer, 66 px at 390 px, 74 px
 * where `onRowActivate` adds the Details door. Until a list is measured, a loading frame of a
 * `rows` body gives each data row one row this tall, so it never ends shorter than the loaded list.
 */
const CARD_TALL = 74

/** One phone card's px in a `rows` body: the `cardHeight` it names, else {@link CARD_TALL}. */
const cardHeightOf = (size: DataPanelProps['bodySize']): number =>
  'rows' in size ? Math.max(0, Math.round(size.cardHeight ?? CARD_TALL)) : CARD_TALL

/** The data rows a `rows` body names: its rows less the head row, at least one. */
const dataRowsOf = (size: DataPanelProps['bodySize']): number =>
  'rows' in size ? Math.max(1, Math.round(size.rows) - 1) : 1

/** The table row height token, in px: the rows the desktop box holds are counted in it. */
function rowHeightOf(el: HTMLElement): number {
  const raw = getComputedStyle(el).getPropertyValue('--basalt-row-h').trim()
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n)) return DEFAULT_ROW
  return raw.endsWith('rem')
    ? n * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
    : n
}

/** The table row height in px, read once the panel is mounted and before paint: a `rows` body is that many rows tall. */
function useRowPx(ref: RefObject<HTMLElement | null>, enabled: boolean): number {
  const [px, setPx] = useState(DEFAULT_ROW)
  useLayoutEffect(() => {
    const measure = (): void => {
      const el = ref.current
      if (!enabled || el === null) return
      const next = rowHeightOf(el)
      setPx((was) => (was === next ? was : next))
    }
    measure()
    return undefined
  })
  return px
}

/**
 * A `{ rows }` body shows whole rows. As a table its rows run past the declared height, the rows
 * are cut after the last one that fits, so no row is clipped through its text; a table that fits
 * takes the height of its rows, so no blank row is left under the last one; in a grid row that stretches the panel
 * the table takes the whole box and its rows share the extra height, so no band is left under the last row. The loading skeleton
 * still draws the declared height. As phone cards (the table's rows are grids) the cards are taller
 * than a table row, so the box takes the height of the data cards its rows name (`dataRowsOf`: the
 * rows less the head row): every one of them is whole, none is left behind the box, and a shorter
 * list ends at its last card. The measure reads the rows against the declared height, or the taller
 * box a stretched grid row gives the panel, so it holds under a resize and a refetch. Bodies that draw no table rows get no cut.
 */
function useWholeRows(
  size: DataPanelProps['bodySize'],
  declared: number,
): {
  ref: RefObject<HTMLDivElement | null>
  fit: number | undefined
  cards: boolean
  measured: boolean
  /** Every row fits and a stretched grid row left room: the table takes the box, its rows share the extra. */
  fills: boolean
} {
  const ref = useRef<HTMLDivElement | null>(null)
  const [snapped, setSnapped] = useState<{
    fit: number | undefined
    cards: boolean
    measured: boolean
    fills: boolean
  }>({
    fit: undefined,
    cards: false,
    measured: false,
    fills: false,
  })
  const enabled = 'rows' in size
  const dataRows = dataRowsOf(size)
  useLayoutEffect(() => {
    const box = ref.current?.querySelector('[data-slot="data-panel-rows"]')
    if (!enabled || !(box instanceof HTMLElement)) return undefined
    const measure = (): void => {
      // The rows are measured at their own height, so the stretch (a table that fills the box) is off while they are read, and stays off for a body with no rows.
      box.removeAttribute('data-fill')
      const rows = box.querySelectorAll('tbody [data-slot="table-row"]')
      const first = rows[0]
      if (first === undefined) return
      // A row's place in the box is its place in the table's own scroll: a focus that scrolls the table to a row must not move where the rows end.
      const scroller = box.querySelector('[data-slot="table-scroller"]')
      const top = box.getBoundingClientRect().top - (scroller?.scrollTop ?? 0)
      if (getComputedStyle(first).display === 'grid') {
        const last = rows[Math.min(dataRows, rows.length) - 1]!
        const bottom = Math.ceil(last.getBoundingClientRect().bottom - top)
        setSnapped((was) =>
          was.cards && was.fit === bottom && was.measured && !was.fills
            ? was
            : { fit: bottom, cards: true, measured: true, fills: false },
        )
        return
      }
      // A panel stretched by its grid row has more room than it declared: cut at the box it has. Only a
      // box taller than its own stated height is stretched; a loading estimate is not room.
      const phaseBox = box.parentElement
      // the frame's own height is CSS (a calc on the row token) until a list is measured: that is `declared`
      const parsed = Number.parseFloat(phaseBox?.style.height ?? '')
      const stated = Number.isFinite(parsed) ? parsed : declared
      const grown = phaseBox !== null && phaseBox.clientHeight > stated + 0.5
      const limit = grown ? Math.max(declared, phaseBox.clientHeight) : declared
      let fit: number | undefined
      let last = 0
      for (const row of rows) {
        last = row.getBoundingClientRect().bottom - top
        if (last <= limit + 0.5) fit = last
      }
      const next = fit === undefined ? undefined : Math.ceil(fit)
      // Every row fits and the stretched grid row left room under them: the table takes the box, so no blank band is left.
      const fills = grown && last <= limit + 0.5 && phaseBox.clientHeight > Math.ceil(last) + 1
      if (fills) box.setAttribute('data-fill', '')
      setSnapped((was) =>
        !was.cards && was.fit === next && was.measured && was.fills === fills
          ? was
          : { fit: next, cards: false, measured: true, fills },
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    for (const child of box.children) observer.observe(child)
    // A row that settles a pixel taller or shorter (a font arriving, a wrapped id) moves where the whole rows end, though the fixed box around it does not resize.
    for (const row of box.querySelectorAll('tbody [data-slot="table-row"]')) observer.observe(row)
    if (box.parentElement !== null) observer.observe(box.parentElement)
    return () => observer.disconnect()
  })
  return {
    ref,
    fit: snapped.fit === undefined ? undefined : Math.max(MIN_BODY, snapped.fit),
    cards: snapped.cards,
    measured: snapped.measured,
    fills: snapped.fills,
  }
}

/** Calls the body as a component, so a throw lands in the boundary and not in the panel. */
function ArmBody({ body, height }: { body: DataPanelProps['body']; height: number }): ReactNode {
  return body({ height, phase: 'ready' })
}

const BAR = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'

/**
 * The loading shape. In a panel as narrow as a phone (`@max-regular`) the rows are cards that share
 * the box, as tall as a card; a container query lays that out, so the server HTML and the first client
 * render are one picture.
 */
function PanelSkeleton({ size }: { size: DataPanelProps['bodySize'] }): ReactElement {
  if ('rows' in size) {
    return (
      <div aria-hidden="true" className="flex h-full flex-col gap-2 overflow-clip">
        {Array.from({ length: Math.max(0, Math.round(size.rows)) }, (_, i) => (
          <div
            key={i}
            className={cn(
              BAR,
              'h-8 shrink-0 @max-regular:h-auto @max-regular:min-h-8 @max-regular:flex-1 @max-regular:shrink',
            )}
          />
        ))}
      </div>
    )
  }
  return (
    <div aria-hidden="true" className="h-full">
      <div className={cn(BAR, 'h-full')} />
    </div>
  )
}

const FILL = 'bg-(--swatch-light) dark:bg-(--swatch-dark)'
const EDGE = 'border-[1.5px] border-(color:--swatch-light) dark:border-(color:--swatch-dark)'

/** The swatch per entry shape, the chart legend's: a line key, a dot, a ring, a square or an open square. */
const SWATCH: Readonly<Record<NonNullable<LegendEntry['swatch']>, string>> = {
  solid: cn('size-2 rounded-xs', FILL),
  dashed:
    'h-0 w-3 border-t-2 border-dashed border-(color:--swatch-light) dark:border-(color:--swatch-dark)',
  dot: cn('size-2 rounded-full', FILL),
  ring: cn('size-2 rounded-full', EDGE),
  bar: cn('size-2 rounded-xs', FILL),
  hollow: cn('size-2 rounded-xs', EDGE),
}

/** The legend row of a card: one swatch and label per entry, under the header. `BarList` draws it too. */
export function Legend({ entries }: { entries: readonly LegendEntry[] }): ReactElement {
  const t = useMessages(cards)
  return (
    <ul
      data-slot="data-panel-legend"
      // The explicit role is deliberate: `list-style: none` makes Safari drop the implicit one.
      // oxlint-disable-next-line jsx-a11y/no-redundant-roles
      role="list"
      className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 px-(--card-edge) pb-2 text-xs text-muted-foreground"
    >
      {entries.map((entry) => (
        <li key={entry.key} className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            style={
              {
                '--swatch-light': entry.color.light,
                '--swatch-dark': entry.color.dark,
              } as CSSProperties
            }
            data-swatch={entry.swatch ?? 'solid'}
            className={cn(
              'shrink-0',
              SWATCH[entry.swatch ?? 'solid'],
              entry.failed === true && 'opacity-40',
            )}
          />
          <span className="truncate">
            {entry.failed === true ? `${entry.label} (${t('cards.unavailable')})` : entry.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

/**
 * The panel header: an icon tile, the title and its definition glyph, a subtitle, the inline controls
 * and the menu, on the card's left edge. Below `@regular` the controls wrap to a second row; they are
 * rendered once, so a bound control is never a CSS twin of itself.
 */
function PanelHead(
  props: Pick<
    DataPanelProps,
    'title' | 'subtitle' | 'icon' | 'info' | 'controls' | 'menu' | 'contextMenu'
  >,
): ReactElement {
  const { title, subtitle, icon: Icon, info, controls, menu, contextMenu } = props
  const about = useAboutLabel()
  return (
    <div
      data-slot="card-band"
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-(--card-edge) pt-3 pb-2"
    >
      {Icon !== undefined && (
        <IconTile>
          <Icon className="size-icon" aria-hidden="true" />
        </IconTile>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex h-5 min-w-0 items-center gap-1">
          <p className="truncate text-md font-semibold tracking-tight text-foreground">{title}</p>
          {info !== undefined && (
            <CardInfo label={about(title)} className="-my-0.5">
              {info}
            </CardInfo>
          )}
        </div>
        {subtitle !== undefined && (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {controls !== undefined && (
        <div
          data-slot="data-panel-controls"
          className="order-1 flex w-full flex-wrap items-center gap-2 @regular:order-none @regular:w-auto @regular:shrink-0"
        >
          {controls.render()}
        </div>
      )}
      {menu !== undefined && (
        <div data-slot="data-panel-menu" className="flex shrink-0 items-center">
          <CardMenu
            menu={menu}
            label={`Actions for ${title}`}
            contextMenu={contextMenu !== false}
          />
        </div>
      )}
    </div>
  )
}

/**
 * The frame for a body that is not a chart: the same header and phase handling as the other cards,
 * around a table, a list or a board. The body is one box slot at the height the required `bodySize`
 * declares, so a loading, empty or error panel is as tall as a ready one; in a grid row the panel
 * takes the row's height and the box grows past that floor, so the cards of a row end level and a
 * table shows the whole rows the taller box holds; a body shorter than the box (fewer rows than it
 * holds) takes the height of its rows, and in a stretched grid row it fills the box, its rows sharing the extra height,
 * so no band is left under its last row (a body that is no table keeps its own height and the extra sits below it). The body is called in `ready` and `stale`; in `empty` and `error` it is called too, so a table in it
 * keeps its column header row and draws the arm under it (a body that draws no table stays hidden
 * there and the panel draws its own arm). A `rows` count is table rows at the table's row height
 * (`--basalt-row-h`, the head row included), so the box is `rows` x that height: declare N data rows
 * as `rows: N + 1`, and the desktop box holds the head row and all N with no blank row; a table with
 * fewer rows than that takes the height of its rows once measured (the desktop box keeps the declared
 * height until then), so no blank row is left under the last, or the whole stretched box when a grid row grew the panel; a table
 * with more rows than the box shows whole rows, cut after the last that fits. Where the table folds to phone
 * cards the rows are taller than a table row (66 px, 74 px with a Details door), so the box is as tall as
 * the N data rows and a shorter list ends at its last row: every row is whole at 390 px. A loading
 * frame has no cards to measure: until a list has been measured it gives each data row one row (74 px, or `bodySize.cardHeight`),
 * then the height it had; the panel never runs the body in loading, so it cannot see that a table is `phone: 'columns'`: such a
 * table keeps its rows at 390 px, and its caller passes `bodySize.cardHeight` as that row (33 at the default density), or the
 * loading frame runs one 74 px row per row. A table body with `height="fill"`
 * takes the box's height and scrolls inside it, so a chart focus brings its joined row into view. The
 * box clips with `overflow: clip`, never `hidden`, so a table head that sticks to the page keeps sticking.
 *
 * @useWhen a page needs the card frame around a table, a row list or a board, with a header, controls and a legend
 * @neverWhen the body is a chart (use a chart card) or a single figure (use a stat card or a stat cell)
 *
 * @example
 * <DataPanel
 *   title="Open pull requests"
 *   subtitle="by age"
 *   phase={query}
 *   empty={rows.length ? null : { cause: 'Nothing open' }}
 *   bodySize={{ rows: 6 }}
 *   body={(box) => <PullTable rows={rows} height={box.height} />}
 * />
 */
export function DataPanel(props: DataPanelProps): ReactElement {
  const { title, controls, toolbar, legend } = props
  const { phase, empty, bodySize, body } = props
  const depth = useContext(FrameDepthContext)
  if (controls !== undefined && controls.count > MAX_INLINE_CONTROLS) {
    warnOnce(
      'controls',
      `DataPanel "${title}" has ${controls.count} inline controls (over ${MAX_INLINE_CONTROLS}). Move the filters to the toolbar.`,
    )
  }
  if (depth >= MAX_DEPTH) {
    warnOnce(
      'depth',
      `DataPanel "${title}" sits ${depth} frames deep (over ${MAX_DEPTH}). Lay the frames out side by side instead of nesting them.`,
    )
  }
  const rootRef = useRef<HTMLDivElement | null>(null)
  const rowPx = useRowPx(rootRef, 'rows' in bodySize)
  const declared = bodyHeightOf(bodySize, rowPx)
  const { ref: insetRef, fit, measured, fills } = useWholeRows(bodySize, declared)
  // A measured list takes the height its whole rows or cards fill (`fit`), else the declared height.
  const boxHeight = fit ?? declared
  const [claims, setClaims] = useState(0)
  // oxlint-disable-next-line react/hook-use-state -- the lazy initialiser holds one stable function for the context; there is no setter to name
  const [claim] = useState(() => (): (() => void) => {
    setClaims((n) => n + 1)
    return () => setClaims((n) => n - 1)
  })
  const resolved = resolvePhase({ phase: props.phase, empty })
  // Before a list is ever measured, a phone's loading frame (a panel under `@regular`) gives each data
  // row the tallest card, so it never ends shorter than the loaded list, and every phase holds that height
  // until a table has been measured (the phases of one panel stay one height). A CSS floor on the frame,
  // not a measured width: the server render and the browser draw the same height.
  const cardsFloor = 'rows' in bodySize && !measured
  const arm = resolved.tag === 'empty' || resolved.tag === 'error' ? resolved : undefined
  const claimed = arm !== undefined && claims > 0
  return (
    <div
      ref={rootRef}
      data-slot="data-panel"
      className="@container h-full min-w-0"
      style={
        cardsFloor
          ? ({
              '--panel-cards': `${dataRowsOf(bodySize) * cardHeightOf(bodySize)}px`,
            } as CSSProperties)
          : undefined
      }
    >
      <Card flush className="h-full">
        <PanelHead {...props} />
        {toolbar !== undefined && (
          <div
            data-slot="data-panel-toolbar"
            className="flex flex-wrap items-center gap-2 px-(--card-edge) pb-2"
          >
            {toolbar.render()}
          </div>
        )}
        {legend !== undefined && legend.length > 0 && <Legend entries={legend} />}
        <Inset ref={insetRef} className="flex grow flex-col">
          <HostTitleContext.Provider value={title}>
            <FrameDepthContext.Provider value={depth + 1}>
              {!claimed && (
                <CardPhase
                  phase={phase}
                  empty={empty}
                  height={boxHeight}
                  style={
                    fit === undefined && 'rows' in bodySize
                      ? { height: rowsHeightCss(bodySize.rows) }
                      : undefined
                  }
                  className={cn(
                    'grow',
                    fit === undefined && 'rows' in bodySize && 'min-h-24',
                    cardsFloor && '@max-regular:min-h-(--panel-cards)',
                  )}
                  skeleton={<PanelSkeleton size={bodySize} />}
                >
                  {(box) => (
                    <div
                      data-slot="data-panel-rows"
                      className="h-full overflow-clip [&[data-fill]_[data-slot=table-root]]:h-full [&[data-fill]_[data-slot=table-scroller]]:h-full [&[data-fill]_table]:h-full"
                      style={fit === undefined || fills ? undefined : { height: fit }}
                    >
                      {body(box)}
                    </div>
                  )}
                </CardPhase>
              )}
              {arm !== undefined && (
                // A table in the body draws the arm itself under its column header row (claim); the
                // body is no table when nothing claims, and stays hidden behind the frame's own arm.
                <div
                  hidden={!claimed}
                  data-slot={claimed ? 'card-phase' : undefined}
                  data-phase={claimed ? arm.tag : undefined}
                  style={claimed ? { height: boxHeight } : undefined}
                  className={cn(
                    'relative min-w-0 shrink-0 overflow-clip',
                    cardsFloor && '@max-regular:min-h-(--panel-cards)',
                  )}
                >
                  <FrameArmContext.Provider value={{ arm, height: boxHeight, claim }}>
                    <PhaseBoundary fallback={() => null}>
                      <ArmBody body={body} height={boxHeight} />
                    </PhaseBoundary>
                  </FrameArmContext.Provider>
                </div>
              )}
            </FrameDepthContext.Provider>
          </HostTitleContext.Provider>
        </Inset>
      </Card>
    </div>
  )
}
