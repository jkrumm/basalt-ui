/**
 * c08: where did the 8 seconds of one agent run go, and which step failed. A trace waterfall: one
 * row per span in tree order, its bar placed on a shared time axis with the duration at the bar's
 * end. Kind is the bar's hue; the failed step is a solid status-hue bar with its cause on it. The
 * rows are one tab stop; arrows step through the spans.
 */
import { ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { ChartFact, ChartFocusItem } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { Skeleton } from 'basalt-ui/ui/skeleton'
import { Swatch } from 'basalt-ui/ui/status'
import { cardStateProps, retryCopy } from '../../shot-state'
import type { ScenarioProps } from '../../shot-state'
import { RUN_MS, SPANS } from './fixture'
import type { Span } from './fixture'

/** A label after a bar needs room to its right: a bar ending past this share labels before it. */
const LABEL_AFTER_MAX = 0.75
/** One row is a 20 px track and 4 px of padding above and below; the card box adds the rest. */
const ROW_PX = 28
const BODY_PX = 2 * 8 + 16 + SPANS.length * ROW_PX + 12 + 16 // padding, axis, rows, gap, legend
/** Indent per tree depth, as ladder classes. */
const INDENT = ['pl-0', 'pl-4', 'pl-8'] as const

const fmtMs = (ms: number): string =>
  ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(ms % 100 === 0 ? 1 : 2)} s`
const fmtTokens = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
const share = (ms: number): number => ms / RUN_MS
const pct = (ms: number): string => `${share(ms) * 100}%`
const wholePct = (ms: number): string => `${Math.round(share(ms) * 100)}%`

/** A round step (0.5, 1, 2, 5, 10 s ...) that gives at most five ticks for any run length. */
function tickStep(runMs: number): number {
  const steps = [500, 1000, 2000, 5000, 10_000, 30_000, 60_000, 300_000, 600_000]
  return steps.find((s) => runMs / s <= 5) ?? 3_600_000
}

/** Round ticks short of the end, then the run's own end, so the axis names its last value. */
function axisTicks(runMs: number): { at: number; label: string; end: boolean }[] {
  const step = tickStep(runMs)
  const ticks: { at: number; label: string; end: boolean }[] = []
  for (let t = 0; t <= runMs * 0.9; t += step) ticks.push({ at: t, label: fmtMs(t), end: false })
  ticks.push({ at: runMs, label: fmtMs(runMs), end: true })
  return ticks
}
const TICKS = axisTicks(RUN_MS)

const slowest = SPANS.filter((s) => s.depth === 0).reduce((a, b) =>
  b.durationMs > a.durationMs ? b : a,
)
const failed = SPANS.find((s) => s.cause !== undefined)

const describe = (s: Span): string =>
  [
    `${s.name}, ${s.kind}`,
    `${wholePct(s.durationMs)} of the run`,
    `${fmtMs(s.startMs)} to ${fmtMs(s.startMs + s.durationMs)}`,
    s.tokens > 0 ? `${fmtTokens(s.tokens)} tokens` : null,
    s.cause ?? null,
  ]
    .filter((part) => part !== null)
    .join(' · ')

export function ExprC08Scenario({ shotState }: ScenarioProps) {
  const focus = useChartFocus(SPANS, {
    announce: (s) =>
      `${s.name}, ${s.kind}, ${fmtMs(s.durationMs)}, ${wholePct(s.durationMs)} of the run${s.status === 'error' ? ', failed' : ''}`,
  })
  const facts: ChartFact[] = [
    {
      value: focus.readout(fmtMs(RUN_MS), (s) => fmtMs(s.durationMs)),
      period: focus.readout(`whole run, ${SPANS.length} spans`, describe),
    },
    ...(failed === undefined
      ? []
      : [
          {
            value: (
              <span className="inline-flex items-center gap-2">
                <Swatch color={VX.badSolid} />1 failed
              </span>
            ),
            tone: 'bad' as const,
            period: `${failed.name}: ${failed.cause}`,
          },
        ]),
  ]
  const loading = shotState === 'loading'
  return (
    <div data-shot="agent-run-trace">
      <ChartCard
        title={`${slowest.name} took ${fmtMs(slowest.durationMs)}, ${wholePct(slowest.durationMs)} of the run`}
        subtitle="Agent run, step by step"
        stateNoun="trace spans"
        facts={facts}
        {...cardStateProps(
          shotState,
          retryCopy('trace store'),
          loading ? 'content' : BODY_PX,
          'No spans were recorded for this run. Re-run it with tracing enabled.',
        )}
      >
        <div className="@container flex flex-col gap-3">
          {loading ? (
            // The card renders its children while 'content'-pending: the same rows as ghosts.
            <div className="flex flex-col p-2" aria-busy="true">
              <TimeAxis />
              {SPANS.map((s) => (
                <SkeletonRow key={s.id} span={s} />
              ))}
            </div>
          ) : (
            <div
              {...focus.target}
              aria-label="Spans of the agent run, in call order"
              className="flex flex-col rounded-chip p-2 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand"
            >
              <TimeAxis />
              {SPANS.map((s, i) => (
                <SpanRow key={s.id} span={s} item={focus.item(i)} />
              ))}
            </div>
          )}
          {loading ? null : focus.live}
          <ul className="flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs text-muted-foreground">
            {/* cycle-expression-2: no legend part for hand-drawn marks; chips for the neutral and accent fills */}
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-chip bg-dim-bar" />
              step
            </li>
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-chip bg-brand-fill" />
              slowest step
            </li>
            <li className="flex items-center gap-2">
              <Swatch color={VX.badSolid} />
              failed step
            </li>
          </ul>
        </div>
      </ChartCard>
    </div>
  )
}

const ROW =
  'grid grid-cols-[2fr_3fr] items-center gap-x-2 @regular:grid-cols-[1fr_4fr] @regular:gap-x-3'

function TimeAxis() {
  return (
    <div className={`${ROW} px-1 text-xs text-muted-foreground`} aria-hidden="true">
      <span />
      <div className="relative h-4">
        {TICKS.map((t) => (
          // cycle-expression-2: no time-axis part for a hand-drawn waterfall; ticks placed by hand
          // theme-allow hidden-inline-style — a tick sits at a data position
          <span
            key={t.at}
            className={`absolute whitespace-nowrap tabular-nums ${t.end ? 'right-0' : t.at === 0 ? '' : '-translate-x-1/2'}`}
            style={t.end ? {} : { left: pct(t.at) }}
          >
            {t.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** A bar's label: the duration; the share on the slowest; the cause on the failed one. */
function barLabel(span: Span): string {
  const parts = [fmtMs(span.durationMs)]
  if (span === slowest) parts.push(wholePct(span.durationMs))
  if (span.causeShort !== undefined) parts.push(`failed: ${span.causeShort}`)
  return parts.join(' · ')
}

function SpanRow({ span, item }: { span: Span; item: ChartFocusItem }) {
  const isCause = span.cause !== undefined
  const isSlowest = span === slowest
  const end = span.startMs + span.durationMs
  const after = share(end) < LABEL_AFTER_MAX
  // cycle-expression-2: no bar-label placement for hand-drawn bars; inside the slowest, else beside
  const labelClass = isSlowest
    ? 'ml-1 overflow-hidden text-ellipsis text-on-brand'
    : after
      ? 'ml-1'
      : 'mr-1'
  const labelStyle = isSlowest
    ? { left: pct(span.startMs), width: pct(span.durationMs) }
    : after
      ? { left: pct(end) }
      : { right: `${100 - share(span.startMs) * 100}%` }
  return (
    <div
      {...item}
      className={`group ${ROW} rounded-chip px-1 py-1 data-dimmed:opacity-25 data-focused:bg-info-tint data-focused:outline-2 data-focused:outline-brand`}
    >
      <div className={`flex min-w-0 items-baseline gap-2 text-sm ${INDENT[span.depth] ?? 'pl-8'}`}>
        <span className={`truncate ${isCause ? 'font-medium' : ''}`}>{span.name}</span>
        <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums @regular:inline">
          {span.kind}
          {span.tokens > 0 ? ` · ${fmtTokens(span.tokens)} tok` : ''}
        </span>
        {span.status === 'error' ? (
          <span className="sr-only shrink-0 items-center gap-1 text-xs @regular:not-sr-only @regular:flex">
            <Swatch color={VX.badSolid} />
            {isCause ? 'Failed' : 'Child failed'}
          </span>
        ) : null}
      </div>
      <div className="relative h-5 rounded-chip bg-inset">
        {/* cycle-expression-2: no waterfall/Gantt kind; bar geometry is percent of the run, by hand */}
        {/* theme-allow hidden-inline-style — a bar's offset, width and fill are data */}
        <div
          aria-hidden="true"
          className={`absolute inset-y-0.5 min-w-0.5 rounded-chip group-data-focused:outline-2 group-data-focused:outline-brand ${isSlowest ? 'bg-brand-fill' : 'bg-dim-bar'}`}
          style={{
            left: pct(span.startMs),
            width: pct(span.durationMs),
            ...(isCause && { background: VX.badSolid }),
          }}
        />
        {/* theme-allow hidden-inline-style — the label sits at its bar's data position */}
        <span
          className={`absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-xs tabular-nums ${labelClass} ${isCause ? 'font-medium' : ''}`}
          style={labelStyle}
        >
          {barLabel(span)}
        </span>
      </div>
    </div>
  )
}

/** A loading row: the same grid, name line and track height as `SpanRow`. */
function SkeletonRow({ span }: { span: Span }) {
  return (
    <div className={`${ROW} px-1 py-1`}>
      <div className={`text-sm ${INDENT[span.depth] ?? 'pl-8'}`}>
        <Skeleton className="w-24" />
      </div>
      <div className="relative h-5">
        {/* theme-allow hidden-inline-style — a ghost bar mirrors its span's data position */}
        <Skeleton
          className="absolute inset-y-0.5"
          style={{ left: pct(span.startMs), width: pct(Math.max(span.durationMs, RUN_MS / 40)) }}
        />
      </div>
    </div>
  )
}
