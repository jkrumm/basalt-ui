import { Children, isValidElement, useContext } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { resolveFrame } from '../core/phase'
import type { Empty, ErrorKind } from '../core/phase'
import { Card, cardVariants } from '../ui/card'
import { EmptyLine, ErrorLine } from './stat-cell'
import type { StatCellProps } from './stat-cell'
import {
  FrameDepthContext,
  MAX_DEPTH,
  StatGroupCollapsedContext,
  StatGroupContext,
  warnOnce,
} from './stat-group-shared'

/**
 * A group takes `StatCell`s and nothing else. The type is declared here because
 * `src/cards/contract.ts` has no `StatGroup` entry yet.
 */
export type StatCellElement = ReactElement<StatCellProps>

export type StatGroupProps = {
  /**
   * `strip` is one dense surface whose cells share their tracks; `cards` is one card per cell with
   * the bands aligned across them, two to a line when the container is narrow. `flush` is the strip
   * with no card: cells split by hairlines and a rule below, edge to edge under the view row of a
   * fill page. A ready or stale flush cell with no sub-line, delta, status, meter, chart or rows
   * does not render; a loading, empty, failed or offline cell keeps its slot.
   */
  variant: 'strip' | 'cards' | 'flush'
  /** Names the group for assistive tech (`Recovery`). */
  label?: string
  children: StatCellElement | readonly StatCellElement[]
}

/**
 * Two tracks and an odd count leave the last cell alone on its line beside a dead half cell: the
 * first cell takes both tracks of the first line instead (a lone cell counts too), so every line
 * is full. `of [data-slot=stat-cell]` counts the cells only, not the group's message, and the rule
 * applies from `@narrow` (two tracks) to `@regular`, where the tracks turn auto-fit.
 */
const ODD_FIRST_SPANS =
  '@narrow:@max-regular:[&>[data-slot=stat-cell]:first-child:nth-last-child(odd_of_[data-slot=stat-cell])]:col-span-2'

/**
 * Every cell's tracks are one set of rows: ten, in the order caption, figure, the delta with its base,
 * meter, chart, four rows and a foot line. A cell is `row-span-10` on a subgrid, so a track one cell
 * fills is as tall in all of them and a track nobody fills is 0 px. Each cell is ruled on its left
 * and top and carries its own padding; the grid sits 1 px up and left of the card, which clips the
 * outer rules, so a hairline only ever divides two cells. In a narrow container (under `@regular`,
 * 30 rem) the tracks are two (one under `@narrow`), so a phone lays out two stats per line, ruled
 * both ways; from `@regular` they are auto-fit 12 rem tracks.
 */
const STRIP = cn(
  'relative -mt-px -ml-px grid grid-cols-1 @narrow:grid-cols-2 @regular:grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]',
  ODD_FIRST_SPANS,
)

/**
 * One card per cell: two to a line in a narrow container (one under `@narrow`), auto-fit 14 rem
 * tracks from `@regular`. Nothing scrolls sideways. The padding and negative margin keep the cards'
 * ring and shadow inside the group's box.
 */
const CARDS = cn(
  'relative grid -mx-1 -mt-1 -mb-4 grid-cols-1 p-1 gap-x-3 @narrow:grid-cols-2 @regular:grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]',
  ODD_FIRST_SPANS,
)

/**
 * A row of `StatCell`s on shared tracks. `strip` draws them on one surface, ruled into cells, for
 * the status bar of a dashboard; `cards` draws one card each with the headline bands aligned across
 * them, two to a line in a narrow container. A cell fills the tracks it declares and the rest
 * collapse, so a loading cell is already its final height. Every cell carries a baseline: a delta
 * naming its base, a verdict, a meter or a trend; a group of bare numbers warns in development.
 *
 * `flush` is the summary strip of a list page: it sits under the `PageBar` of a fill page, with no
 * card, and every cell carries the line that gives its figure a base. A bare number does not
 * render there (the owner rejected the bare stat strip): a ready or stale cell with none of `sub`, `delta`,
 * `status`, `meter`, `chart` or `rows` is dropped, with a development warning; a loading, empty, failed or offline cell keeps its slot.
 *
 * @useWhen a page shows several headline figures side by side, a status bar or a row of KPIs
 * @neverWhen there is one figure (use a stat card), the figures are bare counts (put them in the footer of the card they belong to) or need a chart each (use chart cards)
 *
 * @example
 * <StatGroup variant="strip" label="Fleet health">
 *   <StatCell icon={Rocket} label="Deploys" value={164} delta={{ value: '+12%', polarity: 'up-good', label: 'vs prior 7 days' }} chart={perDay} phase={query} />
 *   <StatCell icon={Clock} label="Median duration" value={174} unit="s" delta={{ value: '-14 s', polarity: 'up-bad', label: 'vs prior 7 days' }} phase={query} />
 * </StatGroup>
 */
export function StatGroup({ variant, label, children }: StatGroupProps): ReactElement | null {
  const depth = useContext(FrameDepthContext)
  if (depth >= MAX_DEPTH) {
    warnOnce(
      'depth',
      `A StatGroup sits ${depth} frames deep (over ${MAX_DEPTH}). Lay the frames out side by side instead of nesting them.`,
    )
  }
  const cells = variant === 'flush' ? withContext(children) : children
  // A flush strip with every cell dropped draws nothing, not an empty rule under the view row.
  if (variant === 'flush' && Array.isArray(cells) && cells.length === 0) return null
  // A flush strip has already dropped every cell without context.
  if (variant !== 'flush') warnBare(cells)
  const shared = sharedFailure(cells)
  // A flush strip is the strip's cells and message without its card.
  const drawn = variant === 'flush' ? 'strip' : variant
  const message =
    shared === null ? null : <GroupMessage failure={shared} label={label} variant={drawn} />
  return (
    <FrameDepthContext.Provider value={depth + 1}>
      <StatGroupContext.Provider value={drawn}>
        <StatGroupCollapsedContext.Provider value={shared !== null}>
          {variant === 'flush' ? (
            <FlushGroup label={label} message={message}>
              {cells}
            </FlushGroup>
          ) : variant === 'strip' ? (
            <StripGroup label={label} message={message}>
              {children}
            </StripGroup>
          ) : (
            <CardsGroup label={label} message={message}>
              {children}
            </CardsGroup>
          )}
        </StatGroupCollapsedContext.Provider>
      </StatGroupContext.Provider>
    </FrameDepthContext.Provider>
  )
}

/** Phases in which a cell draws its own state (a skeleton, an empty cause, an error, offline) in its slot. */
const DRAWS_ITS_STATE: ReadonlySet<string> = new Set(['loading', 'empty', 'error', 'offline'])

/**
 * True when a cell says what its figure is against (a sub-line, a delta, a verdict, a meter, a trend
 * or rows), or draws its state instead of a figure: a loading, empty, failed or offline cell keeps
 * its slot. A ready or stale cell shows a figure, so it needs the context.
 */
function hasContext(cell: StatCellProps): boolean {
  if (DRAWS_ITS_STATE.has(resolveFrame(cell).tag)) return true
  return (
    (cell.sub !== undefined && cell.sub !== '') ||
    cell.delta !== undefined ||
    cell.status !== undefined ||
    cell.meter !== undefined ||
    cell.chart !== undefined ||
    (cell.rows !== undefined && cell.rows.length > 0)
  )
}

/**
 * The cells a flush strip draws: those with context. A bare figure is dropped, and development
 * says which, so the strip never shows a row of numbers that compare nothing.
 */
function withContext(children: StatGroupProps['children']): StatCellElement[] {
  const kept: StatCellElement[] = []
  const dropped: string[] = []
  for (const child of Children.toArray(children)) {
    if (!isValidElement<StatCellProps>(child)) continue
    if (hasContext(child.props)) kept.push(child)
    else dropped.push(child.props.label)
  }
  if (dropped.length > 0) {
    warnOnce(
      'flush',
      `A flush StatGroup dropped ${dropped.length} cell(s) with no sub-line or context (${dropped.join(', ')}): give each a sub, a delta that names its base, a status, a meter or a trend.`,
    )
  }
  return kept
}

/**
 * Dev only: a group of two or more cells where none carries a delta, a verdict, a meter or a chart
 * is a row of bare numbers, which reads as four figures on a band and compares nothing.
 */
function warnBare(children: ReactNode): void {
  if (process.env.NODE_ENV === 'production') return
  const cells = Children.toArray(children).flatMap((child) =>
    isValidElement<StatCellProps>(child) ? [child.props] : [],
  )
  if (cells.length < 2) return
  const bare = cells.every(
    (cell) =>
      cell.delta === undefined &&
      cell.status === undefined &&
      cell.meter === undefined &&
      cell.chart === undefined,
  )
  if (!bare) return
  warnOnce(
    'bare',
    `A StatGroup of ${cells.length} cells shows bare numbers: give each cell a delta that names its base, a status, a meter or a trend, or put the counts in the footer of the card they belong to.`,
  )
}

/** One failure or one cause every cell of a group shares: drawn once for the group, not per cell. */
type SharedFailure =
  | {
      tag: 'error'
      kind: ErrorKind | undefined
      message: string | undefined
      retry: (() => void) | undefined
    }
  | { tag: 'empty'; empty: Empty }

/**
 * A group whose cells all fail alike (the same error kind) or are all empty for the same cause
 * says it once. Cells that differ, a cell that is loading or ready, or a single cell stay per cell.
 */
function sharedFailure(children: ReactNode): SharedFailure | null {
  const cells = Children.toArray(children).flatMap((child) =>
    isValidElement<StatCellProps>(child) ? [resolveFrame(child.props)] : [],
  )
  if (cells.length < 2 || cells.length !== Children.count(children)) return null
  const [first] = cells
  if (first?.tag === 'error') {
    const errors = cells.flatMap((cell) => (cell.tag === 'error' ? [cell] : []))
    // A failed query's own error text is no sentence of the page's: it never tells two failures apart and
    // is never printed, so cells that differ only in it fail together and the group says it once.
    const said = (e: (typeof errors)[number]): string | undefined => (e.raw ? undefined : e.message)
    if (
      errors.length !== cells.length ||
      errors.some((e) => e.kind !== first.kind || said(e) !== said(first))
    )
      return null
    const retries = [...new Set(errors.flatMap((e) => (e.retry === undefined ? [] : [e.retry])))]
    return {
      tag: 'error',
      kind: first.kind,
      message: said(first),
      // One shared retry passes through unwrapped, so a frame beside the group recognises it.
      retry:
        retries.length <= 1
          ? retries[0]
          : () => {
              for (const retry of retries) retry()
            },
    }
  }
  if (first?.tag === 'empty') {
    const empties = cells.flatMap((cell) => (cell.tag === 'empty' ? [cell.empty] : []))
    if (empties.length !== cells.length || empties.some((e) => e.cause !== first.empty.cause))
      return null
    return { tag: 'empty', empty: first.empty }
  }
  return null
}

/**
 * The group's one message. A strip draws it across the figure track under the captions; cards
 * draw it on one card laid exactly over the held row of cards, so the group keeps its height and
 * the banner is as tall as the cards it stands for.
 */
function GroupMessage({
  failure,
  label,
  variant,
}: {
  failure: SharedFailure
  label: string | undefined
  variant: StatGroupProps['variant']
}): ReactElement {
  const line =
    failure.tag === 'error' ? (
      <ErrorLine
        kind={failure.kind}
        message={failure.message}
        retry={failure.retry}
        label={label}
      />
    ) : (
      <div className="flex min-w-0 items-center gap-2">
        <EmptyLine empty={failure.empty} />
      </div>
    )
  return variant === 'strip' ? (
    <div
      data-slot="stat-group-message"
      className="absolute inset-x-0 top-7 mt-px flex h-8 min-w-0 items-center px-(--card-edge) @regular:h-9"
    >
      {line}
    </div>
  ) : (
    <div
      data-slot="stat-group-message"
      className={cn(
        cardVariants({ flush: true }),
        // The cells are `mb-3` above the group's own bottom: the banner stops where their cards do.
        'absolute inset-x-1 top-1 bottom-4 justify-center px-(--card-edge)',
      )}
    >
      {line}
    </div>
  )
}

type BodyProps = {
  label: string | undefined
  message: ReactNode
  children: StatGroupProps['children']
}

function StripGroup({ label, message, children }: BodyProps): ReactElement {
  return (
    <div data-slot="stat-group" data-variant="strip" className="@container min-w-0">
      <Card flush>
        {/* The explicit role is deliberate: a `fieldset` carries form semantics and a UA border. */}
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
        <div role="group" aria-label={label} className={STRIP}>
          {children}
          {message}
        </div>
      </Card>
    </div>
  )
}

function FlushGroup({ label, message, children }: BodyProps): ReactElement {
  return (
    <div
      data-slot="stat-group"
      data-variant="flush"
      className="@container min-w-0 overflow-clip border-b border-border [--card-edge:--spacing(5)] @max-regular:[--card-edge:--spacing(3)]"
    >
      {/* The explicit role is deliberate: a `fieldset` carries form semantics and a UA border. */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <div role="group" aria-label={label} className={STRIP}>
        {children}
        {message}
      </div>
    </div>
  )
}

function CardsGroup({ label, message, children }: BodyProps): ReactElement {
  return (
    <div data-slot="stat-group" data-variant="cards" className="@container min-w-0">
      {/* The explicit role is deliberate: it names the group. */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <div data-slot="stat-scroll" role="group" aria-label={label} className={CARDS}>
        {children}
        {message}
      </div>
    </div>
  )
}
