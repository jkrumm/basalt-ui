import { Children, isValidElement, useContext } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { resolvePhase } from '../core/phase'
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
   * the bands aligned across them, two to a line when the container is narrow.
   */
  variant: 'strip' | 'cards'
  /** Names the group for assistive tech (`Recovery`). */
  label?: string
  children: StatCellElement | readonly StatCellElement[]
}

/**
 * Every cell's tracks are one set of rows: ten, in the order caption, figure, the delta with its base,
 * meter, chart, four rows and a foot line. A cell is `row-span-10` on a subgrid, so a track one cell
 * fills is as tall in all of them and a track nobody fills is 0 px. Each cell is ruled on its left
 * and top and carries its own padding; the grid sits 1 px up and left of the card, which clips the
 * outer rules, so a hairline only ever divides two cells. In a narrow container (under `@regular`,
 * 30 rem) the tracks are 8 rem, so a phone lays out two stats per line, ruled both ways; from
 * `@regular` they are 12 rem.
 */
const STRIP =
  'relative -mt-px -ml-px grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] @regular:grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]'

/**
 * One card per cell on auto-fit tracks: two to a line (9 rem and up) in a narrow container, 14 rem
 * tracks from `@regular`. Nothing scrolls sideways. The padding and negative margin keep the cards'
 * ring and shadow inside the group's box.
 */
const CARDS =
  'relative grid -mx-1 -mt-1 -mb-4 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] p-1 gap-x-3 @regular:grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]'

/**
 * A row of `StatCell`s on shared tracks. `strip` draws them on one surface, ruled into cells, for
 * the status bar of a dashboard; `cards` draws one card each with the headline bands aligned across
 * them, two to a line in a narrow container. A cell fills the tracks it declares and the rest
 * collapse, so a loading cell is already its final height. Every cell carries a baseline: a delta
 * naming its base, a verdict, a meter or a trend; a group of bare numbers warns in development.
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
export function StatGroup({ variant, label, children }: StatGroupProps): ReactElement {
  const depth = useContext(FrameDepthContext)
  if (depth >= MAX_DEPTH) {
    warnOnce(
      'depth',
      `A StatGroup sits ${depth} frames deep (over ${MAX_DEPTH}). Lay the frames out side by side instead of nesting them.`,
    )
  }
  warnBare(children)
  const shared = sharedFailure(children)
  const message =
    shared === null ? null : <GroupMessage failure={shared} label={label} variant={variant} />
  return (
    <FrameDepthContext.Provider value={depth + 1}>
      <StatGroupContext.Provider value={variant}>
        <StatGroupCollapsedContext.Provider value={shared !== null}>
          {variant === 'strip' ? (
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
    isValidElement<StatCellProps>(child) ? [resolvePhase(child.props)] : [],
  )
  if (cells.length < 2 || cells.length !== Children.count(children)) return null
  const [first] = cells
  if (first?.tag === 'error') {
    const errors = cells.flatMap((cell) => (cell.tag === 'error' ? [cell] : []))
    if (errors.length !== cells.length || errors.some((e) => e.kind !== first.kind)) return null
    const retries = [...new Set(errors.flatMap((e) => (e.retry === undefined ? [] : [e.retry])))]
    return {
      tag: 'error',
      kind: first.kind,
      message: first.message,
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
