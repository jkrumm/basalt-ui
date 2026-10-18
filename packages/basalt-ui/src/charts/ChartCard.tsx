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
import { useRef, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { useIsomorphicLayoutEffect } from '../common/isomorphic-layout-effect'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import type { DeltaPolarity } from '../dashboard/delta-badge'
import { WidgetHeader } from '../dashboard/widget-header'
import { VX } from '../tokens'
import { ChartCardContext } from './card-context'
import classes from './chart-card.module.css'
import { ChartPlaceholder, resolveChartState } from './state'
import type { ChartState, ResponsiveChartHeight } from './types'

// Depth is `shadow-card` (a whisper shadow with the 1px ring baked in), never a border, so a
// ChartCard reads exactly like a Mantine Card. Only the body clips; the header must let
// `WidgetHeader`'s info bubble overhang the card edge.
const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
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

/** One headline figure: the value is the hero, then its unit, a comparison node and the period. */
export type ChartFact = {
  value: ReactNode
  unit?: string | undefined
  /** Usually a `DeltaBadge`. */
  comparison?: ReactNode
  /** Plain text the figure covers, e.g. `last 30 d`. A list is joined by ` · ` (`['last entry 3 d
   * ago', '12 entries']`). */
  period?: string | readonly string[] | undefined
  /** Ink for the whole fact (text only, never a fill): a stale or off-target figure reads `warn`. */
  tone?: ChartFactTone | undefined
}

/** The status inks a fact can take, plus the muted one. */
export type ChartFactTone = 'good' | 'warn' | 'bad' | 'muted'

/** The three boxes a `ChartCard` paints. */
export type ChartCardSlot = 'root' | 'header' | 'body'

type ChartCardBaseProps = BasaltProps &
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
    /** Right-aligned controls. */
    actions?: ReactNode
    /** A resolved state replaces `children` with its placeholder; the header stays. */
    state?: ChartState | undefined
    /** Body height while a placeholder shows. Default: the chart height law, i.e. exactly the box an
     * unsized chart takes — pass the chart's own `height` when it states one, so a `<Suspense
     * fallback={<ChartCard state={{ pending: true }} …/>}>` reserves the final size. */
    placeholderHeight?: number | ResponsiveChartHeight | undefined
    /** An errored `state` shows the shared Retry button (the one `ErrorState` renders). */
    /** Placeholder data is showing: the facts dim with the plot (a strip cell's `stale`). */
    stale?: boolean | undefined
    /** What an errored `state` names: "Could not load {stateNoun}". Default: no noun. */
    stateNoun?: string | undefined
    onRetry?: (() => void) | undefined
    /** A refetch is in flight: Retry is inert and marked busy. */
    retrying?: boolean | undefined
    /** Any other action under the placeholder, e.g. a "clear filters" link; after Retry. */
    stateAction?: ReactNode
    children?: ReactNode
  }

/**
 * `facts` replaces the legacy `value`/`delta` hero: the two are mutually exclusive in the type. The
 * facts show only at rest: while `state` is pending, errored or empty the figure would sit above a
 * skeleton or a placeholder that contradicts it, so the header keeps its title row alone.
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
    <div data-basalt-facts="" {...(stale && { 'data-stale': 'true' })} className={classes.facts}>
      <div className={classes.factsRow}>
        {list.map((f, i) => (
          <span
            key={i}
            data-basalt-fact=""
            {...(f.tone !== undefined && { 'data-tone': f.tone })}
            className={classes.fact}
          >
            <span data-basalt-fact-value="" className={classes.factValue}>
              {f.value}
            </span>
            {f.unit !== undefined && <span className={classes.factUnit}>{f.unit}</span>}
            {f.comparison}
            {f.period !== undefined && (
              <span className={classes.factPeriod}>
                {typeof f.period === 'string' ? f.period : f.period.join(' · ')}
              </span>
            )}
          </span>
        ))}
      </div>
      {basis !== undefined && (
        <p data-basalt-facts-basis="" className={classes.factsBasis}>
          {basis}
        </p>
      )}
    </div>
  )
}

export function ChartCard({
  actions,
  state,
  placeholderHeight,
  stateAction,
  stale,
  stateNoun,
  onRetry,
  retrying,
  className,
  classNames,
  style,
  children,
  facts,
  ...header
}: ChartCardProps): ReactElement {
  const { ref, short } = useShortCard()
  const resolved = resolveChartState(state)
  const showFacts = facts !== undefined && resolved === null
  const hasHeader =
    actions !== undefined || showFacts || HEADER_TRIGGERS.some((k) => header[k] !== undefined)
  // With facts the subtitle is the basis line after them, not WidgetHeader's foldable row.
  const { subtitle, ...rest } = header
  const headerProps = facts === undefined ? header : rest

  return (
    <ChartCardContext.Provider value>
      <div
        ref={ref}
        data-basalt-chart-card=""
        className={cx(classNames?.root, className)}
        style={{ ...cardStyle, ...style }}
        {...(resolved === 'pending' && { 'aria-busy': 'true' })}
        {...(short && { 'data-basalt-card-short': '' })}
      >
        {hasHeader && (
          <div className={cx(classes.header, classNames?.header)}>
            <WidgetHeader
              tier="widget"
              {...definedOnly(headerProps)}
              title={header.title ?? ''}
              {...(actions !== undefined && {
                actions: <span data-basalt-tier="widget">{actions}</span>,
              })}
            />
            {showFacts && <Facts facts={facts} basis={subtitle} stale={stale} />}
          </div>
        )}
        <div
          {...(classNames?.body !== undefined && { className: classNames.body })}
          style={bodyClipStyle}
        >
          {resolved === null ? (
            children
          ) : (
            <ChartPlaceholder
              state={state}
              {...(placeholderHeight !== undefined && { height: placeholderHeight })}
              {...(stateNoun !== undefined && { noun: stateNoun })}
              {...(onRetry !== undefined && { onRetry })}
              {...(retrying !== undefined && { retrying })}
              action={stateAction}
            />
          )}
        </div>
      </div>
    </ChartCardContext.Provider>
  )
}
