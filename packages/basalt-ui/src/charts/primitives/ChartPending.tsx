import type { CSSProperties, ReactNode } from 'react'
import type { BasaltProps } from '../../common/props'
import { VX } from '../../tokens'

export type ChartCenterProps = BasaltProps & {
  width: number
  height: number
  children: ReactNode
}

const centerStyle = (width: number, height: number): CSSProperties => ({
  width,
  height,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
})

/**
 * Minimal layout primitive: centers `children` inside a `width` × `height` box. Exists because
 * `src/charts/**` cannot import Mantine's `Flex`/`Group`/`Center` (the Mantine-free boundary), so
 * there was previously nothing to reach for when a chart file needed to center something. Not a
 * general layout system — width, height, children, nothing else.
 */
export function ChartCenter({
  width,
  height,
  className,
  style,
  children,
}: ChartCenterProps): ReactNode {
  return (
    <div
      {...(className !== undefined && { className })}
      style={{ ...centerStyle(width, height), ...style }}
    >
      {children}
    </div>
  )
}

export type ChartPendingProps = BasaltProps & {
  width: number
  height: number
  /** Default `'Loading…'`. */
  label?: string
}

const labelStyle: CSSProperties = {
  color: VX.faint,
  fontSize: VX.text.sm,
}

/**
 * The placeholder for a chart whose data hasn't arrived yet — the third "nothing to draw" state
 * alongside measured-and-empty and measured-and-absent (a real gap in coverage). Collapsing an
 * in-flight query into either of those (the `data ?? []` idiom) densifies it into a fully-hatched
 * "not measured" window: a positive claim that the series WAS watched and carried nothing, when in
 * fact it was never asked. `ChartPending` makes "not asked yet" its own rendered state instead of
 * borrowing one of the other two.
 *
 * Reserves exactly the plot's footprint and draws NOTHING that could be mistaken for a
 * measurement — no axes, no gridlines, no hatching, no data marks — just a faint, static, centered
 * label. No animation: the package's motion doctrine bans looping/pulsing idle motion, so a static
 * reserved box is the correct answer here, not a compromise.
 *
 * The label is `role="status"` (polite), so a screen reader hears the chart resolve through all
 * three states rather than only its failure: `ChartError` was `role="alert"` and its two siblings
 * were silent, which announced the one outcome and swallowed the other two. Polite, not assertive —
 * a loading placeholder must not interrupt what the reader is already being told.
 */
export function ChartPending({
  width,
  height,
  label = 'Loading…',
  className,
  style,
}: ChartPendingProps): ReactNode {
  return (
    <ChartCenter
      width={width}
      height={height}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    >
      {/* `<output>` is the tag oxlint suggests, and it is the wrong one: it means "the result of
          a calculation", owns form semantics (`form`/`name`/`for`), and this box is precisely the
          state in which there IS no result yet. A polite live region on a plain span is the
          standard pattern. */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <span style={labelStyle} role="status">
        {label}
      </span>
    </ChartCenter>
  )
}

/**
 * The three "nothing to draw" states a chart can be in, in ONE prop — the shape a
 * `@tanstack/react-query` result (or anything derived from one) already has.
 *
 * It exists because the answer that already existed, `dashboard/QueryState`, renders Mantine and
 * therefore cannot be reached from `./charts` at all (the Mantine-free boundary). A chart consumer
 * without that import was left writing the four-way branch by hand, which is the exact bug
 * `QueryState` was built for: the shape suggests `empty` and a 500 renders "No data".
 *
 * Precedence is fixed and is the whole product: **pending → error → empty**. A refetch that is
 * both in flight and carrying a stale error is pending, not failed; a query that errored has no
 * standing to claim its result was empty.
 */
export type ChartState = {
  /** The query has not resolved yet. Wins over every other flag. */
  pending?: boolean
  /** Truthy = the query failed. Any thrown value; an `Error`'s `message` is used as the label. */
  error?: unknown
  /** The query resolved and there is genuinely nothing to plot. */
  empty?: boolean
}

/** Which placeholder {@link ChartState} resolves to, or `null` to draw the chart. */
export type ResolvedChartState = 'pending' | 'error' | 'empty' | null

/**
 * Resolve {@link ChartState} (plus the older standalone `isPending` flag, which stays a supported
 * alias) into the ONE placeholder to render. Pure and exported so a hand-composed plot applies the
 * same precedence rather than re-deriving it.
 */
export function resolveChartState(input: {
  state?: ChartState
  isPending?: boolean
}): ResolvedChartState {
  const { state, isPending } = input
  if (isPending === true || state?.pending === true) return 'pending'
  if (state?.error !== undefined && state.error !== null && state.error !== false) return 'error'
  if (state?.empty === true) return 'empty'
  return null
}

export type ChartEmptyProps = BasaltProps & {
  width: number
  height: number
  /** Default `'No data'`. */
  label?: string
  /** Optional affordance under the label — a "clear filters" button, a range reset. Rendered as
   * given: this layer is Mantine-free, so the caller owns whatever it puts here. */
  action?: ReactNode
}

const stackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
}

/**
 * Measured and EMPTY — the query resolved and there is nothing to plot. Distinct from
 * {@link ChartPending} ("not asked yet") and from a hatched absence ("watched, measured nothing"):
 * collapsing any of the three into another is the honesty bug this trio exists to prevent.
 *
 * Same footprint discipline as `ChartPending`: it reserves the plot rect and draws nothing that
 * could be read as a measurement — no axes, no gridlines, no marks. Announced `role="status"`
 * (polite) like `ChartPending`, so the resolution is heard; only `ChartError` is an `alert`.
 */
export function ChartEmpty({
  width,
  height,
  label = 'No data',
  action,
  className,
  style,
}: ChartEmptyProps): ReactNode {
  return (
    <ChartCenter
      width={width}
      height={height}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    >
      {/* Same waiver, same reason, as `ChartPending` — see the comment there. */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <span style={stackStyle} role="status">
        <span style={labelStyle}>{label}</span>
        {action}
      </span>
    </ChartCenter>
  )
}

export type ChartErrorProps = BasaltProps & {
  width: number
  height: number
  /** Overrides the text outright. Omitted, an `Error`'s own `message` is used, else
   * `'Could not load chart'` — a failure never borrows the empty state's copy. */
  label?: string
  /** The thrown value, used for the default label. */
  error?: unknown
  /** Optional affordance under the label — typically a retry. */
  action?: ReactNode
}

/** The message an unknown thrown value gets to state for itself. Kept local rather than importing
 * `./query`'s `toErrorMessage`: `./charts` resolves with no other basalt subpath installed, and a
 * chart placeholder needs one line, not the HTTP-status vocabulary that helper carries. */
function errorLabel(error: unknown): string {
  if (error instanceof Error && error.message !== '') return error.message
  if (typeof error === 'string' && error !== '') return error
  return 'Could not load chart'
}

/**
 * Measured and FAILED. The branch a hand-written chart switch reliably gets wrong — a 500 rendered
 * as "No data" is a positive claim that the server answered and had nothing, which it did not.
 */
export function ChartError({
  width,
  height,
  label,
  error,
  action,
  className,
  style,
}: ChartErrorProps): ReactNode {
  return (
    <ChartCenter
      width={width}
      height={height}
      {...(className !== undefined && { className })}
      {...(style !== undefined && { style })}
    >
      <span style={stackStyle} role="alert">
        <span style={labelStyle}>{label ?? errorLabel(error)}</span>
        {action}
      </span>
    </ChartCenter>
  )
}
