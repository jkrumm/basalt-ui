/**
 * The "nothing to draw" placeholders: pending → error → empty, in that precedence. One renderer for
 * the chart chrome and `ChartCard`, so a pending card and a pending chart read the same.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { toErrorMessage } from '../common/errors'
import { RetryButton } from '../common/retry-button'
import { VX } from '../tokens'
import { ChartBox, growClass, stateClass } from './box'
import boxClasses from './chart-box.module.css'
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

/** Bar ghost heights (% of the plot) of a pending plot: a mild rise, not data. */
const GHOST_BARS = [38, 52, 44, 66, 58, 74, 62, 48] as const

/**
 * The shape a pending plot draws: `'bars'` (default), `'line'` for a line or area chart, or a bar
 * count when the loaded chart's data length is known (a 6-month chart loads 6 bars).
 */
export type PlotGhostShape = 'bars' | 'line' | number

/** A mild rise across the width, in a 100 x 40 box stretched to the plot. */
const GHOST_LINE = '0,30 12,26 25,28 38,18 50,22 62,12 75,16 88,8 100,12'

/** The loaded shape of a plot, drawn in neutral tone (`chart-box.module.css` `.ghost`). */
function PlotGhost({ shape = 'bars' }: { shape?: PlotGhostShape }): ReactElement {
  if (shape === 'line')
    return (
      <div aria-hidden="true" data-basalt-plot-ghost="line" className={boxClasses.ghost}>
        <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={boxClasses.ghostLine}>
          <polyline points={GHOST_LINE} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    )
  const count =
    typeof shape === 'number' ? Math.max(1, Math.min(Math.floor(shape), 60)) : GHOST_BARS.length
  return (
    <div aria-hidden="true" data-basalt-plot-ghost="bars" className={boxClasses.ghost}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={boxClasses.ghostBar}
          style={{ height: `${GHOST_BARS[i % GHOST_BARS.length]}%` }}
        />
      ))}
    </div>
  )
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
  typeof state?.empty === 'string' ? state.empty : 'Nothing recorded in this range.'

/** Fills the same {@link ChartBox} the chart will, so a pending, failed or empty chart (and a
 * `<Suspense>` fallback built from one) occupies the final chart's height. */
export function ChartPlaceholder(props: {
  state: ChartState | undefined
  /** `'content'`: error and empty end at their content (a list or Meter body, no chart to keep the
   * frame for); the chart height law and a stated height keep D37's box. Pending always keeps a box. */
  height?: ChartBoxHeight | 'content'
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
  /** Pending only: the ghost's shape. Default `'bars'`. */
  ghost?: PlotGhostShape
}): ReactElement | null {
  const kind = resolveChartState(props.state)
  if (kind === null) return null
  const style = kind === 'pending' ? pendingStyle : kind === 'error' ? errorStyle : boxStyle
  // An error keeps the chart's height as a floor (the frame does not jump, `ssr-contract`) and may
  // grow past it rather than clip its action; its anatomy is top-aligned, so the room is plain
  // card below the content, not a block of text floating mid-card.
  const { height } = props
  const fit = (node: ReactElement): ReactElement =>
    height === 'content' && kind !== 'pending' ? (
      node
    ) : (
      <ChartBox
        height={height === 'content' ? undefined : height}
        {...(kind === 'error' && { className: growClass })}
      >
        {node}
      </ChartBox>
    )
  if (kind === 'pending')
    return fit(
      <output aria-label="Loading chart" aria-busy="true" className={stateClass} style={style}>
        {!props.compact && <PlotGhost {...(props.ghost !== undefined && { shape: props.ghost })} />}
      </output>,
    )
  const label =
    kind === 'error'
      ? toErrorMessage(props.state?.error, 'The request failed.')
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
