/**
 * The standard chart wrapper: a card with a `WidgetHeader tier="widget"` title row (icon, info,
 * value, delta, count, actions) over a clipped chart body. `WidgetHeader` is itself Mantine-free,
 * so `./charts` still resolves with no `@mantine/*` installed. The `actions` slot carries only
 * `data-basalt-tier="widget"`; a basalt control there sizes itself.
 *
 * The header renders only when one of title/info/value/actions/icon/count is set. A chart inside
 * with `legend={{ placement: 'header' }}` renders its legend in the header row.
 */
import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { cx } from '../common/props'
import type { BasaltProps, SlotStylesProps } from '../common/props'
import type { DeltaPolarity } from '../dashboard/delta-badge'
import { WidgetHeader } from '../dashboard/widget-header'
import { VX } from '../tokens'
import { ChartCardContext } from './card-context'
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
const headerStyle: CSSProperties = {
  padding: 'var(--vx-space-card-inset-y, 0.6875rem) var(--vx-space-card-inset-x, 0.8125rem) 4px',
}
const headerLegendStyle: CSSProperties = { paddingTop: 6 }
const bodyStyle: CSSProperties = {
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
    /** Body height while a placeholder shows. Default 240. */
    placeholderHeight?: number
    /** A retry button or a "clear filters" link under the placeholder. */
    stateAction?: ReactNode
    children?: ReactNode
  }

export function ChartCard({
  title,
  icon,
  subtitle,
  info,
  value,
  delta,
  deltaPeriod,
  deltaPolarity,
  count,
  actions,
  state,
  placeholderHeight = 240,
  stateAction,
  className,
  classNames,
  style,
  children,
}: ChartCardProps): ReactElement {
  const [legend, setLegend] = useState<{ owner: string; node: ReactNode } | null>(null)
  const setHeaderLegend = useCallback((owner: string, node: ReactNode | null) => {
    setLegend((prev) => {
      if (node !== null) return { owner, node }
      return prev?.owner === owner ? null : prev
    })
  }, [])
  const context = useMemo(() => ({ setHeaderLegend }), [setHeaderLegend])
  const resolved = resolveChartState(state)
  const hasHeader =
    title !== undefined ||
    info !== undefined ||
    value !== undefined ||
    actions !== undefined ||
    icon !== undefined ||
    count !== undefined

  return (
    <ChartCardContext.Provider value={context}>
      <div
        className={cx(classNames?.root, className)}
        style={{ ...cardStyle, ...style }}
        {...(resolved === 'pending' && { 'aria-busy': 'true' })}
      >
        {hasHeader && (
          <div
            {...(classNames?.header !== undefined && { className: classNames.header })}
            style={headerStyle}
          >
            <WidgetHeader
              tier="widget"
              title={title ?? ''}
              {...(icon !== undefined && { icon })}
              {...(subtitle !== undefined && { subtitle })}
              {...(info !== undefined && { info })}
              {...(value !== undefined && { value })}
              {...(delta !== undefined && { delta })}
              {...(deltaPeriod !== undefined && { deltaPeriod })}
              {...(deltaPolarity !== undefined && { deltaPolarity })}
              {...(count !== undefined && { count })}
              {...(actions !== undefined && {
                actions: <span data-basalt-tier="widget">{actions}</span>,
              })}
            />
            {legend && (
              <div data-basalt-legend-slot="" style={headerLegendStyle}>
                {legend.node}
              </div>
            )}
          </div>
        )}
        <div
          {...(classNames?.body !== undefined && { className: classNames.body })}
          style={bodyStyle}
        >
          {resolved === null ? (
            children
          ) : (
            <ChartPlaceholder state={state} height={placeholderHeight} action={stateAction} />
          )}
        </div>
      </div>
    </ChartCardContext.Provider>
  )
}
