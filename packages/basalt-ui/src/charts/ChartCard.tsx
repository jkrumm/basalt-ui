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
import type { ChartBoxHeight } from './box'
import classes from './chart-card.module.css'
import { ChartPlaceholder, resolveChartState } from './state'
import type { ChartState } from './types'

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

/** The card's measured height through the hysteresis band above. */
function useShortCard(): { ref: (el: HTMLDivElement | null) => void; short: boolean } {
  const [node, setNode] = useState<HTMLDivElement | null>(null)
  const [short, setShort] = useState(false)
  const shortRef = useRef(false)
  useIsomorphicLayoutEffect(() => {
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      // A card holding a chart box is short by the box's own stated height, in CSS
      // (`data-basalt-chart-short`); measuring it as well would flip it after hydration.
      // (`data-basalt-box` is written by `ChartBox`, `box.tsx`, which also writes the marker.)
      if (node.querySelector('[data-basalt-box]')) return
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
  padding: '2px var(--vx-space-card-inset-x, 0.8125rem) var(--vx-space-card-inset-y, 0.6875rem)',
}

/** The three boxes a `ChartCard` paints. */
export type ChartCardSlot = 'root' | 'header' | 'body'

export type ChartCardProps = BasaltProps &
  SlotStylesProps<ChartCardSlot> & {
    title?: string
    icon?: ReactNode
    /** A muted line below the title row; does not by itself render the header. */
    subtitle?: string
    /** `WidgetHeader`'s info glyph beside the title. */
    info?: string
    /** A pre-formatted metric value, with `delta` on the hero row. */
    value?: string
    delta?: number
    deltaPeriod?: string
    deltaPolarity?: DeltaPolarity
    /** A mono count tag after the title. */
    count?: number
    /** Right-aligned controls. */
    actions?: ReactNode
    /** A resolved state replaces `children` with its placeholder; the header stays. */
    state?: ChartState
    /** Body height while a placeholder shows. Default: the chart height law, i.e. exactly the box an
     * unsized chart takes — pass the chart's own `height` when it states one, so a `<Suspense
     * fallback={<ChartCard state={{ pending: true }} …/>}>` reserves the final size. */
    placeholderHeight?: ChartBoxHeight
    /** A retry button or a "clear filters" link under the placeholder. */
    stateAction?: ReactNode
    children?: ReactNode
  }

/** A header renders when one of these is set (a subtitle or delta alone does not). */
const HEADER_TRIGGERS = ['title', 'info', 'value', 'icon', 'count'] as const

export function ChartCard({
  actions,
  state,
  placeholderHeight,
  stateAction,
  className,
  classNames,
  style,
  children,
  ...header
}: ChartCardProps): ReactElement {
  const { ref, short } = useShortCard()
  const resolved = resolveChartState(state)
  const hasHeader = actions !== undefined || HEADER_TRIGGERS.some((k) => header[k] !== undefined)

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
              {...header}
              title={header.title ?? ''}
              {...(actions !== undefined && {
                actions: <span data-basalt-tier="widget">{actions}</span>,
              })}
            />
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
              action={stateAction}
            />
          )}
        </div>
      </div>
    </ChartCardContext.Provider>
  )
}
