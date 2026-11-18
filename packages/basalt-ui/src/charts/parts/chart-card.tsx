import { useState } from 'react'
import type { ReactElement } from 'react'
import { cn } from '../../core/cn'
import { resolvePhase } from '../../core/phase'
import type { Fact, FootFacts, ResolvedPhase } from '../../core/phase'
import type { Verdict } from '../../core/ports'
import { DeltaBadge } from '../../ui/badge'
import { CardHiddenContext, ChartCardContext } from '../card-context'
import { isolatedKeys, toggledKeys } from '../legend'
import type { ChartCardProps, ChartFigure } from '../contract'
import { Footer, formatValue, Head, PhaseBox, SURFACE } from './chart-card-frame'
import { Legend } from './legend'

const BAR = 'animate-pulse rounded-chip bg-foreground/10 motion-reduce:animate-none'

/**
 * The chart box height, a CSS class by the card's own width, so the server HTML, the first paint
 * and the hydrated page agree. `auto` is half the width between 192 and 420 px (the floor keeps a plot, an x axis and a legend row at 390), `short` is
 * 160, and
 * `fill` takes the card's remainder inside a card that fills its parent. Every phase draws inside
 * the same box, so a loading, empty or error card is exactly as tall as a ready one.
 */
const BOX = {
  auto: 'h-[clamp(12rem,50cqw,26.25rem)] shrink-0',
  short: 'h-40 shrink-0',
  fill: 'min-h-40 flex-1',
} as const

const DOT: Record<Verdict['tone'], string> = {
  good: 'bg-good',
  warn: 'bg-warn',
  bad: 'bg-bad',
  info: 'bg-info',
  accent: 'bg-brand',
  neutral: 'bg-muted-foreground',
}

/** A time or an id: the mono face with tabular numerals (`data-monospace` drops its ligatures). */
const MONO = 'font-mono tabular-nums'
/** A figure longer than this steps down a size where the card is narrower than `regular`. */
const LONG_FIGURE = 10
/** Below `regular` the period takes a line of its own, in every phase, so loading and failed hold the ready height. */
const PERIOD_LINE = 'hidden h-4 basis-full items-center @max-regular:flex'
/**
 * The period's own box: one line that truncates, beside the figure from `regular` up and on a line
 * of its own, one line tall even while empty, below it. A period that follows focus changes its text
 * and never the row's height, so a hover cannot push the plot away from the pointer.
 */
const PERIOD_BOX = 'min-w-0 truncate text-xs leading-4 @max-regular:h-4 @max-regular:basis-full'

/**
 * The period's place while the card loads, is empty or failed. With the text declared (a static
 * period, or the ready frame's last one) it takes the lines that text wraps to at this width, drawn
 * through `content: attr()` so the text is neither read nor selectable; with none (`''`) it holds the
 * one line the period takes below `regular`. A loading card draws it as a bar, the others blank.
 */
function PeriodHold({
  period,
  mono,
  loading,
}: {
  period: string
  mono: boolean
  loading: boolean
}): ReactElement {
  if (period === '') {
    return loading ? (
      <div aria-hidden="true" className={PERIOD_LINE}>
        <div className={cn(BAR, 'h-3 w-32')} />
      </div>
    ) : (
      <span aria-hidden="true" className={PERIOD_LINE} />
    )
  }
  return (
    <span
      aria-hidden="true"
      data-slot="chart-period-hold"
      data-hold={period}
      className={cn(
        PERIOD_BOX,
        'select-none after:content-[attr(data-hold)]',
        mono && MONO,
        loading ? cn(BAR, 'w-fit text-transparent') : 'invisible',
      )}
    />
  )
}

function FigureRow({
  figure,
  loading,
  failed,
  blank = failed,
}: {
  figure: ChartFigure
  loading: boolean
  failed: boolean
  /** An empty or failed card has no figure to stand behind: the row holds its ready height and says nothing. */
  blank?: boolean
}): ReactElement {
  const { value, unit, delta, period, periodMono, status } = figure
  const text = failed ? null : formatValue(value)
  return (
    <div
      data-slot="chart-figure"
      className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 @regular:flex-nowrap"
    >
      {/* The figure line has one height in every phase; the period joins it from `regular` up and takes the line under it below. */}
      <div className="flex h-9 max-w-full min-w-0 items-center gap-2">
        {loading ? (
          <>
            <div aria-hidden="true" className={cn(BAR, 'h-7 w-24')} />
            <div aria-hidden="true" className={cn(BAR, 'h-6 w-14 rounded-full')} />
          </>
        ) : blank ? null : (
          <>
            <span
              className={cn(
                'min-w-0 truncate text-display font-semibold tabular-nums',
                (text?.length ?? 0) + (unit?.length ?? 0) > LONG_FIGURE && '@max-regular:text-lg',
                text === null && 'text-muted-foreground',
              )}
            >
              {text ?? '–'}
              {text !== null && unit !== undefined && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>
              )}
            </span>
            {!failed && delta !== undefined && (
              <DeltaBadge
                value={delta.value}
                polarity={delta.polarity}
                {...(delta.label !== undefined && { label: delta.label })}
              />
            )}
            {!failed && status !== undefined && (
              <span
                data-slot="chart-status"
                data-tone={status.tone}
                className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
              >
                <span
                  aria-hidden="true"
                  className={cn('size-1.5 rounded-full', DOT[status.tone])}
                />
                {status.label}
              </span>
            )}
          </>
        )}
      </div>
      {period !== undefined &&
        (loading || blank ? (
          <PeriodHold period={period} mono={periodMono === true} loading={loading} />
        ) : (
          <span
            data-monospace={periodMono === true ? '' : undefined}
            className={cn(PERIOD_BOX, 'text-muted-foreground', periodMono === true && MONO)}
          >
            {period}
          </span>
        ))}
    </div>
  )
}

/** The slots a ready frame declared, without their values: what a loading, empty or failed frame holds. */
type DeclaredSlots = { figure: ChartFigure | undefined; footer: FootFacts | undefined }

const factsOf = (facts: FootFacts | undefined): Fact[] =>
  (facts ?? []).flatMap((fact) => (fact ? [fact] : []))

function declaredSlots({
  figure,
  footer,
}: Pick<ChartCardProps, 'figure' | 'footer'>): DeclaredSlots {
  const labels = factsOf(footer).map((fact): Fact => ({ label: fact.label, value: '' }))
  return {
    figure:
      figure === undefined
        ? undefined
        : {
            value: null,
            ...(figure.period !== undefined && { period: figure.period }),
            ...(figure.periodMono === true && { periodMono: true }),
          },
    footer: labels.length === 0 ? undefined : (labels as unknown as FootFacts),
  }
}

const sameSlots = (a: DeclaredSlots | undefined, b: DeclaredSlots): boolean =>
  a !== undefined &&
  (a.figure === undefined) === (b.figure === undefined) &&
  a.figure?.period === b.figure?.period &&
  a.figure?.periodMono === b.figure?.periodMono &&
  factsOf(a.footer)
    .map((f) => f.label)
    .join('\n') ===
    factsOf(b.footer)
      .map((f) => f.label)
      .join('\n')

/**
 * The figure a loading, empty or failed frame draws. A page that fills its `figure` only when ready
 * declares no `period` in these frames, yet the ready frame's period takes a line of its own below
 * `regular`: a card that was ready holds the period it had, a card that mounts in these frames holds
 * the one line a period takes, so the frame ends at the height the ready frame will have. A period
 * that wraps to more lines is held only when the page declares its text (`PeriodHold`).
 */
function withPeriodHold(
  figure: ChartFigure | undefined,
  held: DeclaredSlots | undefined,
): ChartFigure | undefined {
  if (figure === undefined || figure.period !== undefined) return figure
  const kept = held === undefined ? '' : held.figure?.period
  if (kept === undefined) return figure
  return {
    ...figure,
    period: kept,
    ...(held?.figure?.periodMono === true && { periodMono: true }),
  }
}

/** A query result whose `data` is an empty array: the rows it carries beyond `QueryStateLike`. */
const hasNoRows = (phase: object): boolean => {
  const { data } = phase as { data?: unknown }
  return Array.isArray(data) && data.length === 0
}

/**
 * The frame every chart sits in: a header (icon, title, definition glyph, subtitle, controls, menu),
 * an inset holding the headline figure with its delta, period and verdict over the chart box, and an
 * optional footer of at most two facts. It owns the box and the phase: `chart` is a box slot called
 * only in `ready` and `stale`, in a fixed clipping box, so a taller chart cannot move the card and a
 * loading, empty or error card is as tall as a ready one. With `phase="loading"` and no `chart` it is
 * a Suspense fallback that draws the same rows. A kind draws its own legend, in the server HTML; marks
 * a page draws through the seam take theirs from `legend`, a row between the figure and the box that
 * is drawn in every phase, so loading does not move the box.
 *
 * `height` sets the chart box by the card's own width, a container-class rule, so the server HTML, the
 * first paint and the hydrated page agree: `auto` (default) is half the width between 192 and 420 px,
 * `short` is 160 px, `fill` is the card's remainder and the card takes its parent's height. The slot
 * always receives `height: 'fill'`, so the chart takes the box and never states its own.
 *
 * The phase: `ready` shows the chart; `loading` a plot skeleton with bars in the figure row; `stale`
 * the chart and an `Updating` line (`Could not refresh` after a failed refetch); `error` the error arm
 * with Retry (none for a 403) under a dashed figure row and footer, where a throwing slot lands too; `empty` the cause and its action, with
 * Clear filters when `filtered`. `empty` wins over `ready` and `stale` once the query settled, and
 * `loading` wins over everything. The phase prints on the card and the box as `data-phase`.
 *
 * A `legend` of two or more entries toggles the series of the chart in the box with the same `key`
 * (from the plot, the tooltip and the scale); a double click or a modifier click isolates one. The
 * figure's period is one line that never wraps, held below `regular` even while empty, so a period
 * that follows focus changes text, never the height under the pointer.
 *
 * A series with `failed: true` keeps its legend entry, which reads `unavailable`, draws nothing in the
 * plot and leaves the phase on `ready`; the word is the message `charts.unavailable`, which an app
 * overrides through the provider's `messages`. The tooltip is the engine's, placed inside the card.
 *
 * @useWhen a metric needs a chart with a title, a headline figure, controls or a footer around it
 * @neverWhen the content is a table, a list or a board (use a data panel) or a lone figure (use a stat card)
 *
 * @example
 * <ChartCard
 *   title="Requests"
 *   subtitle="last 30 days"
 *   figure={{ value: 12840, delta: { value: '+8%', polarity: 'up-good' }, period: 'vs prior' }}
 *   phase={query}
 *   chart={(box) => <Lines height={box.height} label="Requests per day" data={rows} x={x} series={series} />}
 * />
 */
export function ChartCard(props: ChartCardProps): ReactElement {
  const { figure, legend, footer, controls, menu, height = 'auto', chart } = props
  const { phase } = props
  // A query phase measures emptiness itself: `empty` applies only when its `data` is an empty array.
  const empty =
    typeof phase === 'object' && 'isPending' in phase && !hasNoRows(phase) ? null : props.empty
  const resolved = resolvePhase({ phase, empty })
  // A Suspense fallback has no chart to call, so it can only be loading.
  const effective: ResolvedPhase = chart === undefined ? { tag: 'loading', body: false } : resolved
  // The slots the ready frame declared, held for the frames that follow it (a refetch that loads,
  // an empty or failed result): a page fills none of them before ready, and the card keeps their height.
  const declared = declaredSlots(props)
  const [held, setHeld] = useState<DeclaredSlots | undefined>(undefined)
  if (effective.body && !sameSlots(held, declared)) setHeld(declared)
  const ready = effective.body
  // A ready figure holds the period's line even without a period, as a loading one does: a period
  // that only a hover fills (a focus readout) would otherwise open the line under the pointer, push
  // the plot away from it, clear the focus and close again. From `regular` up the empty box is inline
  // and takes no height; below it, one line.
  const shownFigure = ready
    ? figure !== undefined && figure.period === undefined
      ? { ...figure, period: '' }
      : figure
    : withPeriodHold(figure ?? held?.figure, held)
  const shownFooter = footer ?? (ready ? undefined : held?.footer)
  // Two or more entries toggle the series of the chart in the box, as a chart's own legend does.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  const entries = legend ?? []
  const interactive = entries.length >= 2
  const legendKeys = entries.map((e) => e.key)
  return (
    <ChartCardContext value={true}>
      <CardHiddenContext value={hidden}>
        <div
          data-slot="chart-card"
          data-height={height}
          className={cn('@container min-w-0', height === 'fill' && 'h-full')}
        >
          <div
            data-slot="card"
            data-surface="card"
            data-phase={effective.tag}
            className={cn(SURFACE, 'relative', height === 'fill' && 'h-full')}
          >
            <Head
              title={props.title}
              subtitle={props.subtitle}
              icon={props.icon}
              info={props.info}
              controls={controls}
              menu={menu}
            />
            <div
              data-slot="inset"
              data-surface="inset"
              className={cn(
                'mx-(--card-gutter) flex min-h-0 flex-col rounded-inset bg-inset px-[calc(var(--card-edge)_-_var(--card-gutter))] py-3 first:mt-(--card-gutter) last:mb-(--card-gutter)',
                height === 'fill' && 'flex-1',
              )}
            >
              {shownFigure !== undefined && (
                <FigureRow
                  figure={shownFigure}
                  loading={effective.tag === 'loading'}
                  failed={effective.tag === 'error'}
                  blank={effective.tag === 'error' || effective.tag === 'empty'}
                />
              )}
              {legend !== undefined && legend.length > 0 && (
                <div
                  data-slot="chart-legend"
                  className={cn('shrink-0', shownFigure !== undefined && 'mt-2')}
                >
                  <Legend
                    entries={legend}
                    hidden={hidden}
                    {...(interactive && {
                      onToggle: (key: string) => setHidden((prev) => toggledKeys(prev, key)),
                      onIsolate: (key: string) =>
                        setHidden((prev) => isolatedKeys(prev, key, legendKeys)),
                    })}
                  />
                </div>
              )}
              <PhaseBox
                title={props.title}
                resolved={effective}
                chart={chart}
                className={cn(
                  (shownFigure !== undefined || (legend !== undefined && legend.length > 0)) &&
                    'mt-2',
                  BOX[height],
                )}
              />
            </div>
            <Footer
              facts={shownFooter}
              phase={
                effective.tag === 'loading'
                  ? 'loading'
                  : effective.tag === 'error'
                    ? 'error'
                    : 'other'
              }
            />
          </div>
        </div>
      </CardHiddenContext>
    </ChartCardContext>
  )
}
