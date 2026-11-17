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
 * Every cell's tracks are one set of rows: nine, in the order caption, figure, meter, chart, four
 * rows and a foot line. A cell is `row-span-9` on a subgrid, so a track one cell fills is as tall
 * in all of them and a track nobody fills is 0 px. Rows have no gap; the space between wrapped
 * lines is the cells' bottom margin, which the last line gives back. In a narrow container (under
 * `@regular`, 30 rem) the tracks are 8 rem, so a phone lays out two stats per line; from `@regular`
 * they are 12 rem.
 */
const STRIP =
  'relative grid -mb-3 grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-x-6 @regular:grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))]'

/**
 * One card per cell on auto-fit tracks: two to a line (9 rem and up) in a narrow container, 14 rem
 * tracks from `@regular`. Nothing scrolls sideways. The padding and negative margin keep the cards'
 * ring and shadow inside the group's box.
 */
const CARDS =
  'relative grid -mx-1 -mt-1 -mb-4 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] p-1 gap-x-3 @regular:grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))]'

/**
 * A row of `StatCell`s on shared tracks. `strip` draws them on one surface for the dense status bar
 * of a dashboard; `cards` draws one card each with the headline bands aligned across them, two to a line
 * in a narrow container. A cell fills the tracks it
 * declares and the rest collapse, so a loading cell is already its final height.
 *
 * @useWhen a page shows several headline figures side by side, a status bar or a row of KPIs
 * @neverWhen there is one figure (use a stat card) or the figures need a chart each (use chart cards)
 *
 * @example
 * <StatGroup variant="strip" label="Link health">
 *   <StatCell label="Downstream" value={412} unit="Mbit/s" phase={query} />
 *   <StatCell label="Upstream" value={44} unit="Mbit/s" phase={query} />
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
      retry:
        retries.length === 0
          ? undefined
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
 * draw it on one card laid over the held row of cards, so the group keeps its height.
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
      className="absolute inset-x-0 top-4 flex h-8 min-w-0 items-center"
    >
      {line}
    </div>
  ) : (
    <div
      data-slot="stat-group-message"
      className={cn(
        cardVariants({ flush: true }),
        'absolute inset-1 justify-center px-(--card-edge)',
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
      <Card flush className="px-(--card-edge) py-3">
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
