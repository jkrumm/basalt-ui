/**
 * The standard chart wrapper: a card with a `WidgetHeader tier="widget"` title row (icon, info,
 * value, delta, count, actions) over a clipped chart body. `WidgetHeader` is itself Mantine-free,
 * so `./charts` still resolves with no `@mantine/*` installed. The `actions` slot carries only
 * `data-basalt-tier="widget"`; a basalt control there sizes itself.
 *
 * The header renders only when one of title/info/value/actions/icon/count is set. A chart's
 * `legend={{ placement: 'header' }}` legend is drawn by the chart, at the top of the body under the
 * header, so it is in the server HTML and the header never grows on hydration.
 */
import { Children, isValidElement, useRef, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { HostTitleContext } from '../common/could-not-load'
import { cx, splitDataAttributes } from '../common/props'
import type { BasaltProps, DataAttributes, SlotStylesProps } from '../common/props'
import { DeltaBadge } from '../dashboard/delta-badge'
import type { DeltaPolarity } from '../dashboard/delta-badge'
import { WidgetHeader } from '../dashboard/widget-header'
import { VX } from '../tokens'
import { ChartCardContext } from './card-context'
import { BandStrip } from './BandStrip'
import { Lines } from './Lines'
import { StackedArea } from './StackedArea'
import classes from './chart-card.module.css'
import { ChartPlaceholder, resolveChartState } from './state'
import type { ChartState, ResponsiveChartHeight } from './types'

// Depth is `shadow-card` (a whisper shadow with the 1px ring baked in), never a border, so a
// ChartCard reads exactly like a Mantine Card. Only the body clips; the header must let
// `WidgetHeader`'s info bubble overhang the card edge.
const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  // Fills its grid cell (or a `h="100%"` anchor wrapper): two cards in one row end together, with
  // no wrapper background under the shorter one. In an auto-height parent it resolves to auto.
  height: '100%',
  minHeight: 0,
  containerType: 'inline-size',
  containerName: 'basalt-card',
  borderRadius: VX.radiusCard,
  boxShadow: VX.shadowCard,
  backgroundColor: VX.surface.panel,
}
/**
 * Below this rendered height the header folds its subtitle whatever the width (the header-economy
 * law): `data-basalt-card-short` is the hook `widget-header.module.css` reacts to. Leaving the
 * state needs `CARD_SHORT_HEIGHT + SHORT_EXIT_SLACK`: the fold changes the card's own height, and
 * without the band a card whose unfolded height sits just above the line flip-flops forever.
 */
const CARD_SHORT_HEIGHT = 280
const SHORT_EXIT_SLACK = 24

/** A `ChartBox` that states a height (any but `fill`): `box.tsx` writes `data-basalt-box`. */
const STATED_BOX = '[data-basalt-box]:not([data-basalt-box="fill"])'

/** The card's measured height through the hysteresis band above. */
function useShortCard(): { ref: (el: HTMLDivElement | null) => void; short: boolean } {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [short, setShort] = useState(false)
  const shortRef = useRef(false)
  useIsomorphicLayoutEffect(() => {
    if (!node) return
    // A card holding a chart box that states its own height (the law default included) is short, or
    // not, by that box in CSS (`data-basalt-chart-short`, written by `ChartBox`, `box.tsx`);
    // measuring it as well would flip it after hydration. A `fill` box states nothing, so it is
    // measured like any other body. The answer cannot change while the box is mounted.
    if (node.querySelector(STATED_BOX)) {
      shortRef.current = false
      setShort(false)
      return
    }
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.borderBoxSize?.[0]?.blockSize ?? node.offsetHeight
      const limit = shortRef.current ? CARD_SHORT_HEIGHT + SHORT_EXIT_SLACK : CARD_SHORT_HEIGHT
      const next = height > 0 && height < limit
      if (next === shortRef.current) return
      shortRef.current = next
      setShort(next)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return { ref: setNode, short }
}
const bodyClipStyle: CSSProperties = {
  borderBottomLeftRadius: VX.radiusCard,
  borderBottomRightRadius: VX.radiusCard,
  overflow: 'hidden',
  flex: '1 1 auto',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  padding: '2px var(--vx-space-card-inset-x, 1rem) var(--vx-space-card-inset-y, 0.75rem)',
}

const PERIOD_SEPARATOR = '· '

/**
 * A period list joins with `·`; behind a unit it leads with one too, so a one-item list is
 * separated from the unit as the items are from each other (an item that already leads with it
 * is not doubled). A plain string is written as is.
 */
function periodText(period: string | readonly string[], afterUnit: boolean): string {
  if (typeof period === 'string') return period
  if (period.length === 0) return ''
  const text = period.join(' · ')
  return afterUnit && !text.startsWith(PERIOD_SEPARATOR.trim()) ? PERIOD_SEPARATOR + text : text
}

/** A comparison that renders something: `cond && <DeltaBadge />` leaves `false`, `null` or `''`. */
const hasComparison = (node: ReactNode): boolean =>
  node !== undefined && node !== null && node !== false && node !== ''

/**
 * A plain-text comparison with a leading sign ("+0.3", "-4%") reads as a delta: the sign becomes
 * DeltaBadge's direction glyph (▲/▼). Any other node (a `DeltaBadge`, which carries its own) is as is.
 */
function Comparison({ node }: { node: ReactNode }): ReactNode {
  if (typeof node !== 'string') return node
  const sign = /^\s*([+\-−])\s*(.+)$/.exec(node)
  if (sign === null) return node
  return (
    <>
      <span aria-hidden="true" className={classes.factGlyph}>
        {sign[1] === '+' ? '▲' : '▼'}
      </span>
      {sign[2]}
    </>
  )
}

/** One headline figure: the value is the hero, then its unit, a comparison node and the period. */
export type ChartFact = {
  value: ReactNode
  unit?: string | undefined
  /** Usually a `DeltaBadge`. */
  comparison?: ReactNode
  /** Plain text the figure covers, e.g. `last 30 d`. A list is joined by ` · ` (`['last entry 3 d
   * ago', '12 entries']`) and, behind a `unit`, led by one. */
  period?: string | readonly string[] | undefined
  /** Ink for the comparison, with its direction glyph (text only, never a fill): an off-target
   * change reads `warn`. A fact with no comparison inks its value instead. A `DeltaBadge` comparison keeps
   * its own polarity ink (it is inline), so `tone` is for plain-text comparisons. */
  tone?: ChartFactTone | undefined
}

/** The status inks a fact can take, plus the muted one. */
export type ChartFactTone = 'good' | 'warn' | 'bad' | 'muted'

/** The three boxes a `ChartCard` paints. */
export type ChartCardSlot = 'root' | 'header' | 'body'

type ChartCardBaseProps = BasaltProps &
  DataAttributes &
  SlotStylesProps<ChartCardSlot> & {
    title?: string | undefined
    icon?: ReactNode
    /** A muted line below the title row; does not by itself render the header. With `facts` it is the
     * basis/as-of line after the facts row (always visible, never folded into the info glyph). */
    subtitle?: string | undefined
    /** `WidgetHeader`'s info glyph beside the title. */
    info?: string | undefined
    /** A pre-formatted metric value, with `delta` on the hero row. */
    value?: string | undefined
    delta?: number | undefined
    deltaPeriod?: string | undefined
    deltaPolarity?: DeltaPolarity | undefined
    /** A mono count tag after the title. */
    count?: number | undefined
    /** Right-aligned controls. A `<Text size="xs">` caption here renders at 11 (the chart-text step,
     * beside the plot's ticks); wrap it in a `span` or give it your own class to opt out. */
    actions?: ReactNode
    /** A resolved state replaces `children` with its placeholder; the header stays. The card learns
     * a state only from here: a body that draws its own loading or empty line (`Meter loading`,
     * `BarList emptyText`) must ALSO be reported here (`{ pending: true }`, `{ empty }`), or the
     * `facts` above it render over a state they contradict. */
    state?: ChartState | undefined
    /** Body height while a placeholder shows. Default: the chart height law, i.e. exactly the box an
     * unsized chart takes — pass the chart's own `height` when it states one, so a `<Suspense
     * fallback={<ChartCard state={{ pending: true }} …/>}>` reserves the final size.
     * `'content'` is for a body that is not a chart (a list, a `Meter`): an error or empty state
     * ends at its content. A pending state renders `children` as they are, so the body must draw
     * its own loading (`BarList loading`, a loading `Meter`); a children-less `<Suspense
     * fallback>` should pass a numeric height instead. */
    placeholderHeight?: number | ResponsiveChartHeight | 'content' | undefined
    /** The pending plot's ghost: `'bars'` (default), `'line'` for a line or area chart, or the bar
     * count when the loaded chart's data length is known, `'band'` for a `BandStrip`. Omitted, a
     * `Lines` or `StackedArea` body (bare, or inside plain elements) loads as a line, a `BandStrip`
     * as one band row at its own `height`; a body wrapped in your own component hides
     * its kind from the card, so pass `ghost="line"` there. */
    ghost?: 'bars' | 'line' | 'band' | number | undefined
    /** Placeholder data is showing: the facts row dims with the plot (a strip cell's `stale`). */
    stale?: boolean | undefined
    /** What an errored `state` names: "Could not load {stateNoun}". Default: the card's `title`; with
     * neither, the title is a bare "Could not load". A leading capital is lowercased unless the next
     * character is a capital or a non-letter ("Revenue" → "revenue", "KPI" and "2024 sales" stay). */
    stateNoun?: string | undefined
    /** An errored `state` shows the shared Retry button (the one `ErrorState` renders). */
    onRetry?: (() => void) | undefined
    /** A refetch is in flight: Retry is inert and marked busy. */
    retrying?: boolean | undefined
    /** Any other action under the placeholder, e.g. a "clear filters" link; after Retry. */
    stateAction?: ReactNode
    children?: ReactNode
  }

/**
 * `facts` replaces the legacy `value`/`delta` hero: the two are mutually exclusive in the type. The
 * figures show only at rest: while `state` is errored or empty one would sit above a placeholder that
 * contradicts it, so the header keeps its title row alone. While pending the row keeps its footprint
 * as a skeleton (a figure bar and, with a `subtitle`, a basis line), never the stale figure.
 */
export type ChartCardProps = ChartCardBaseProps &
  (
    | {
        /** The headline figure(s) under the title: value, unit, comparison, period. Wraps at half
         * width, never clips. Replaces `value`/`delta`. */
        facts: ChartFact | readonly ChartFact[]
        value?: undefined
        delta?: undefined
      }
    | { facts?: undefined }
  )

/** The legacy `value`/`delta` hero as the one fact the headline row draws. */
function legacyFact(header: {
  value?: string | undefined
  delta?: number | undefined
  deltaPeriod?: string | undefined
  deltaPolarity?: DeltaPolarity | undefined
}): ChartFact | undefined {
  const { value, delta, deltaPeriod, deltaPolarity } = header
  if (value === undefined && delta === undefined) return undefined
  return {
    value: value ?? null,
    ...(delta !== undefined && {
      comparison: (
        <DeltaBadge
          value={delta}
          period={deltaPeriod}
          {...(deltaPolarity !== undefined && { polarity: deltaPolarity })}
        />
      ),
    }),
  }
}

/** Drops explicit `undefined`s: `WidgetHeader` is exact-optional, this props type is not. */
const definedOnly = <T extends object>(o: T): { [K in keyof T]?: Exclude<T[K], undefined> } =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>
  }

/** A header renders when one of these is set (a subtitle or delta alone does not). */
const HEADER_TRIGGERS = ['title', 'info', 'value', 'icon', 'count'] as const

function Facts({
  facts,
  basis,
  stale,
}: {
  facts: ChartFact | readonly ChartFact[]
  basis?: string | undefined
  stale?: boolean | undefined
}): ReactElement {
  const list: readonly ChartFact[] = Array.isArray(facts) ? facts : [facts as ChartFact]
  return (
    <div data-basalt-facts="" className={classes.facts}>
      <div
        data-basalt-facts-row=""
        {...(stale && { 'data-stale': 'true' })}
        className={classes.factsRow}
      >
        {list.map((f, i) => {
          const period = f.period === undefined ? '' : periodText(f.period, f.unit !== undefined)
          return (
            <span
              key={i}
              data-basalt-fact=""
              {...(f.tone !== undefined && { 'data-tone': f.tone })}
              className={classes.fact}
            >
              {f.value !== null && f.value !== undefined && f.value !== '' && (
                <span
                  data-basalt-fact-value=""
                  {...(!hasComparison(f.comparison) && { 'data-basalt-fact-tone': '' })}
                  className={cx(
                    classes.factValue,
                    !hasComparison(f.comparison) && classes.factTone,
                  )}
                >
                  {f.value}
                </span>
              )}
              {f.unit !== undefined && <span className={classes.factUnit}>{f.unit}</span>}
              {hasComparison(f.comparison) && (
                <span
                  data-basalt-fact-delta=""
                  data-basalt-fact-tone=""
                  className={classes.factTone}
                >
                  <Comparison node={f.comparison} />
                </span>
              )}
              {period !== '' && <span className={classes.factPeriod}>{period}</span>}
            </span>
          )
        })}
      </div>
      {basis !== undefined && (
        <p data-basalt-facts-basis="" className={classes.factsBasis}>
          {basis}
        </p>
      )}
    </div>
  )
}

/** The facts row of a pending card: bars at the loaded row's height, no figure. */
function FactsSkeleton({ basis }: { basis: boolean }): ReactElement {
  return (
    <div data-basalt-facts-skeleton="" aria-hidden="true" className={classes.facts}>
      <div className={classes.factsRow}>
        <span className={classes.skeletonFigure} />
      </div>
      {basis && <p className={cx(classes.factsBasis, classes.skeletonBasis)} />}
    </div>
  )
}

/** A stated `BandStrip` height the placeholder can take: a px number or the per-class object. */
function isChartHeight(value: unknown): value is number | ResponsiveChartHeight {
  return (
    typeof value === 'number' ||
    (typeof value === 'object' &&
      value !== null &&
      typeof (value as { base?: unknown }).base === 'number')
  )
}

type BodyKind = { ghost: 'line' | 'band'; height?: number | ResponsiveChartHeight; legend?: true }

/**
 * What a pending body draws when `ghost` is not passed: a line for a `Lines` or `StackedArea` body,
 * one band row at the strip's own `height` for a `BandStrip` (found through plain elements such as a
 * `Box`), the default bars otherwise, so a loading chart is drawn as its kind, at its loaded height.
 */
function bodyKindOf(node: ReactNode): BodyKind | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode; height?: unknown }>(child)) continue
    if (child.type === Lines || child.type === StackedArea) return { ghost: 'line' }
    if (child.type === BandStrip) {
      const { height, states, legend } = child.props as {
        height?: unknown
        states?: readonly unknown[]
        legend?: unknown
      }
      return {
        ghost: 'band',
        ...(isChartHeight(height) && { height }),
        // The loaded strip's legend row sits under the box: the ghost keeps its room.
        ...(legend !== false && (states?.length ?? 0) > 1 && { legend: true as const }),
      }
    }
    const inner = bodyKindOf(child.props.children)
    if (inner !== undefined) return inner
  }
  return undefined
}

/** The loaded strip's legend row keeps its room under a pending box; other placeholders get no wrapper. */
function reserveLegend(reserve: boolean, placeholder: ReactElement): ReactElement {
  return reserve ? (
    <div className={classes.legendReserve} data-basalt-legend-reserve="">
      {placeholder}
    </div>
  ) : (
    placeholder
  )
}

export function ChartCard({
  actions,
  state,
  placeholderHeight,
  stateAction,
  stale,
  stateNoun,
  ghost,
  onRetry,
  retrying,
  className,
  classNames,
  style,
  children,
  facts,
  ...headerAndData
}: ChartCardProps): ReactElement {
  const { data, rest: header } = splitDataAttributes(headerAndData)
  const { ref, short } = useShortCard()
  const resolved = resolveChartState(state)
  // The noun an error names: `stateNoun`, else the card's own title ("Revenue" → "revenue").
  const noun = stateNoun ?? header.title
  const kind = resolved === 'pending' ? bodyKindOf(children) : undefined
  const plotGhost = ghost ?? kind?.ghost
  // `ghost` changes the shape only: the wrapped strip's height still sizes the pending box.
  const pendingHeight = placeholderHeight ?? kind?.height
  // One headline anatomy: the legacy `value`/`delta` hero is drawn as a fact (title, then value, delta
  // and period in one baseline group), never pushed to the far edge of the title row.
  const headline = facts ?? legacyFact(header)
  const showFacts = headline !== undefined && resolved === null
  const skeletonFacts = headline !== undefined && resolved === 'pending'
  const hasHeader =
    actions !== undefined ||
    showFacts ||
    skeletonFacts ||
    HEADER_TRIGGERS.some((k) => header[k] !== undefined)
  // With facts the subtitle is the basis line after them, not WidgetHeader's foldable row.
  // The hero props are drawn by the facts row below, so `WidgetHeader` never sees them.
  const { subtitle, value: _v, delta: _d, deltaPeriod: _p, deltaPolarity: _pol, ...rest } = header
  const headerProps = headline === undefined ? header : rest

  const hostBody = <HostTitleContext value={header.title}>{children}</HostTitleContext>

  return (
    <ChartCardContext.Provider value>
      <div
        ref={ref}
        {...data}
        data-basalt-chart-card=""
        className={cx(classNames?.root, className)}
        style={{ ...cardStyle, ...style }}
        {...(resolved === 'pending' && { 'aria-busy': 'true' })}
        {...(short && { 'data-basalt-card-short': '' })}
      >
        {hasHeader && (
          <div data-basalt-chart-header="" className={cx(classes.header, classNames?.header)}>
            <WidgetHeader
              tier="widget"
              {...definedOnly(headerProps)}
              title={header.title ?? ''}
              {...(actions !== undefined && {
                actions: <span data-basalt-tier="widget">{actions}</span>,
              })}
            />
            {showFacts && <Facts facts={headline} basis={subtitle} stale={stale} />}
            {skeletonFacts && <FactsSkeleton basis={subtitle !== undefined} />}
          </div>
        )}
        <div
          {...(classNames?.body !== undefined && { className: classNames.body })}
          style={bodyClipStyle}
        >
          {resolved === null || (resolved === 'pending' && placeholderHeight === 'content')
            ? hostBody
            : reserveLegend(
                kind?.legend === true,
                <ChartPlaceholder
                  state={state}
                  {...(pendingHeight !== undefined && { height: pendingHeight })}
                  {...(noun !== undefined && { noun })}
                  {...(plotGhost !== undefined && { ghost: plotGhost })}
                  {...(onRetry !== undefined && { onRetry })}
                  {...(retrying !== undefined && { retrying })}
                  action={stateAction}
                />,
              )}
        </div>
      </div>
    </ChartCardContext.Provider>
  )
}
