/**
 * The "nothing to draw" placeholders: pending → error → empty, in that precedence. One renderer for
 * the chart chrome and `ChartCard`, so a pending card and a pending chart read the same.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { toErrorMessage } from '../common/errors'
import { RetryButton } from '../common/retry-button'
import { VX } from '../tokens'
import { ChartBox, growClass, stateClass } from './box'
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

// The error idiom (D28, SPEC § 6.12): a status dot + a word + the message + the action, on the
// neutral surface. The dot is drawn from `--vx-*` tokens here — `src/charts/**` stays Mantine-free and `theme/status-dot` sits in the
// Mantine-coupled theme layer.
const dotStyle: CSSProperties = {
  display: 'inline-block',
  flex: 'none',
  width: 6,
  height: 6,
  // theme-allow raw-surface — a 6px status dot, not a surface
  borderRadius: '50%',
  background: VX.status.bad,
}
// StatCard's error anatomy (`ErrorState` at the section tier): a left-aligned stack, never centred.
const errorStyle: CSSProperties = {
  ...boxStyle,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  paddingBottom: VX.space.controlGap,
  textAlign: 'start',
  fontSize: VX.text.sm,
  gap: VX.space.controlGap,
}
const errorHeadStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: VX.space.controlGap,
  color: VX.ink,
  fontWeight: 500,
}

const errorMessageStyle: CSSProperties = { color: VX.muted }

const emptyLabel = (state: ChartState | undefined): string =>
  typeof state?.empty === 'string' ? state.empty : 'No data'

/** Fills the same {@link ChartBox} the chart will, so a pending, failed or empty chart (and a
 * `<Suspense>` fallback built from one) occupies the final chart's height. */
export function ChartPlaceholder(props: {
  state: ChartState | undefined
  height?: ChartBoxHeight
  /** Error only: the shared Retry button, the same one `ErrorState` renders. */
  onRetry?: () => void
  /** A refetch is in flight: Retry is inert and marked busy. */
  retrying?: boolean
  /** Any other action (a "clear filters" link), after Retry. */
  action?: ReactNode
  /** For a box too small to hold a sentence (a sparkline): error and empty show a `—` and carry the
   * label as the accessible name and the hover title. */
  compact?: boolean
  /** Error only: what failed to load, "Could not load {noun}". Default: no noun. */
  noun?: string
}): ReactElement | null {
  const kind = resolveChartState(props.state)
  if (kind === null) return null
  const style = kind === 'pending' ? pendingStyle : kind === 'error' ? errorStyle : boxStyle
  // An error keeps the chart's height as a floor (the frame does not jump, `ssr-contract`) and may
  // grow past it rather than clip its action; its anatomy is top-aligned, so the room is plain
  // card below the content, not a block of text floating mid-card.
  const fit = (node: ReactElement): ReactElement => (
    <ChartBox height={props.height} {...(kind === 'error' && { className: growClass })}>
      {node}
    </ChartBox>
  )
  if (kind === 'pending')
    return fit(
      <output aria-label="Loading chart" aria-busy="true" className={stateClass} style={style} />,
    )
  const label =
    kind === 'error'
      ? toErrorMessage(props.state?.error, 'The chart failed to load.')
      : emptyLabel(props.state)
  const body = props.compact ? (
    <span aria-hidden="true">—</span>
  ) : (
    <>
      {kind === 'error' && (
        <span style={errorHeadStyle}>
          <span aria-hidden="true" data-basalt-status-dot="" style={dotStyle} />
          Could not load{props.noun === undefined ? '' : ` ${props.noun}`}
        </span>
      )}
      <span style={errorMessageStyle}>{label}</span>
      {kind === 'error' && props.onRetry !== undefined && (
        <RetryButton onClick={props.onRetry} retrying={props.retrying ?? false} />
      )}
      {props.action}
    </>
  )
  const name = props.compact ? { 'aria-label': label, title: label } : {}
  if (kind === 'error')
    return fit(
      <div
        role="alert"
        data-basalt-chart-state={kind}
        className={stateClass}
        style={style}
        {...name}
      >
        {body}
      </div>,
    )
  return fit(
    <output data-basalt-chart-state={kind} className={stateClass} style={style} {...name}>
      {body}
    </output>,
  )
}
