/**
 * The "nothing to draw" placeholders: pending → error → empty, in that precedence. One renderer for
 * the chart chrome and `ChartCard`, so a pending card and a pending chart read the same.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { toErrorMessage } from '../common/errors'
import { VX } from '../tokens'
import { ChartBox, stateClass } from './box'
import type { ChartBoxHeight } from './box'
import type { ChartState } from './types'

export type ResolvedChartState = 'pending' | 'error' | 'empty' | null

export function resolveChartState(state: ChartState | undefined): ResolvedChartState {
  if (!state) return null
  if (state.pending) return 'pending'
  if (state.error) return 'error'
  if (state.empty) return 'empty'
  return null
}

const boxStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  color: VX.axis,
  fontSize: VX.text.xs,
  textAlign: 'center',
}

const pendingStyle: CSSProperties = {
  ...boxStyle,
  borderRadius: VX.radiusCtrl,
  background: `linear-gradient(90deg, transparent, ${VX.surface.subtle}, transparent)`,
}

const emptyLabel = (state: ChartState | undefined): string =>
  typeof state?.empty === 'string' ? state.empty : 'No data'

/** Fills the same {@link ChartBox} the chart will, so a pending, failed or empty chart (and a
 * `<Suspense>` fallback built from one) occupies the final chart's height. */
export function ChartPlaceholder(props: {
  state: ChartState | undefined
  height?: ChartBoxHeight
  action?: ReactNode
}): ReactElement | null {
  const kind = resolveChartState(props.state)
  if (kind === null) return null
  const style = kind === 'pending' ? pendingStyle : boxStyle
  const fit = (node: ReactElement): ReactElement => (
    <ChartBox height={props.height}>{node}</ChartBox>
  )
  if (kind === 'pending')
    return fit(
      <output aria-label="Loading chart" aria-busy="true" className={stateClass} style={style} />,
    )
  const label =
    kind === 'error'
      ? toErrorMessage(props.state?.error, 'The chart failed to load.')
      : emptyLabel(props.state)
  const body = (
    <>
      <span>{label}</span>
      {props.action}
    </>
  )
  if (kind === 'error')
    return fit(
      <div role="alert" data-basalt-chart-state={kind} className={stateClass} style={style}>
        {body}
      </div>,
    )
  return fit(
    <output data-basalt-chart-state={kind} className={stateClass} style={style}>
      {body}
    </output>,
  )
}
