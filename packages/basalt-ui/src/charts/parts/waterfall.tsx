/**
 * `Waterfall` — how a start becomes an end: each step a bar floating from the running total before it
 * to the one after, rises in the good tone, falls in the bad one (`polarity: 'up-bad'` swaps them),
 * and an optional closing bar for the total from zero. Every bar names its signed change on top; the
 * tooltip reads the change and the running total. `CartesianChart` with fixed marks on a band x.
 *
 * @useWhen a total is explained by signed contributions in order: a budget's line items, a month's revenue bridge, a release's size by package
 * @neverWhen the parts are a share of one whole with no order (use a one-row stacked BarList), or the values are a series over time (use Lines or Bars)
 */
import { text } from '@tanstack/charts/text'
import { decorative } from '@tanstack/charts/mark/decorative'
import type { ReactElement } from 'react'
import type { CartesianChartBase, ChartName, YConfig } from '../contract'
import { BASALT } from '../../tokens'
import { CV } from '../core/theme'
import { defaultNumberFormat } from '../core/compile'
import { asMarks } from './cartesian-adapt'
import { CartesianChart, CartesianPlot } from './cartesian'

/** One bar of a waterfall: a step of the input, or the closing total. */
export type WaterfallStep<D> = {
  /** The bar's name on the axis. */
  step: string
  /** The signed change of a step; a total's value. */
  delta: number
  /** The running total before the bar (a total: 0). */
  start: number
  /** The running total after it. */
  end: number
  kind: 'increase' | 'decrease' | 'total'
  /** The input datum, `null` for the closing total. */
  datum: D | null
}

export type WaterfallProps<D> = ChartName &
  Pick<CartesianChartBase<D>, 'phase' | 'summary' | 'height' | 'table' | 'cursor'> & {
    data: readonly D[]
    /** The step's name, a band on the x axis. */
    step: (d: D) => string
    /** The step's signed change; `null` skips the step. */
    value: (d: D) => number | null
    /** Where the run starts, as its own first bar (an opening balance). Default: from zero, no bar. */
    start?: { label: string; value: number } | undefined
    /** A closing bar for the running total, with its name. Default: none. */
    total?: string | undefined
    /** Writes every value: the labels, the tooltip and the y ticks. Default: the compact number. */
    format?: ((v: number) => string) | undefined
    /** `up-good` (default): a rise is good. `up-bad` for a cost, where a rise is bad. */
    polarity?: 'up-good' | 'up-bad' | undefined
    /** The name of a bar's value in the tooltip. Default `Amount`. */
    valueLabel?: string | undefined
    y?: Pick<YConfig, 'title' | 'gutter'> | undefined
    /**
     * `'all'` names every bar on the axis (labels that overlap still thin): a bridge of a few named
     * steps. Default: the band axis' own even stride.
     */
    ticks?: 'all' | undefined
  }

/** The bars a waterfall draws, in order: the opening bar, each step, the closing total, each with the running totals it spans. */
export function waterfallSteps<D>(
  props: Pick<WaterfallProps<D>, 'data' | 'step' | 'value' | 'start' | 'total'>,
): WaterfallStep<D>[] {
  const out: WaterfallStep<D>[] = []
  let running = 0
  if (props.start !== undefined) {
    running = props.start.value
    out.push({
      step: props.start.label,
      delta: running,
      start: 0,
      end: running,
      kind: 'total',
      datum: null,
    })
  }
  for (const d of props.data) {
    const delta = props.value(d)
    if (delta === null || !Number.isFinite(delta)) continue
    out.push({
      step: props.step(d),
      delta,
      start: running,
      end: running + delta,
      kind: delta < 0 ? 'decrease' : 'increase',
      datum: d,
    })
    running += delta
  }
  if (props.total !== undefined)
    out.push({
      step: props.total,
      delta: running,
      start: 0,
      end: running,
      kind: 'total',
      datum: null,
    })
  return out
}

const MINUS = '\u2212'
const signed = (v: number, format: (n: number) => string): string =>
  v > 0 ? `+${format(v)}` : v < 0 ? `${MINUS}${format(-v)}` : format(0)

/** Air between a bar's top and its label, px. */
const LABEL_DY = -6

/**
 * A bridge from a start to an end through signed steps.
 *
 * @useWhen a total is explained by signed contributions in order: a budget's line items, a quarter's income bridge, a release's size by package
 * @neverWhen the parts are a share of one whole with no order (use a one-row stacked BarList), or the values form a series over time (use Lines or Bars)
 *
 * @example
 * <Waterfall
 *   label="Operating income, Q3 bridge"
 *   data={items}
 *   step={(d) => d.name}
 *   value={(d) => d.amount}
 *   start={{ label: 'Q2', value: 1240 }}
 *   total="Q3"
 *   format={(v) => `$${v}k`}
 * />
 */
export function Waterfall<D>(props: WaterfallProps<D>): ReactElement {
  const format = props.format ?? ((v: number) => defaultNumberFormat(v))
  const steps = waterfallSteps(props)
  const good = props.polarity === 'up-bad' ? CV.bad : CV.good
  const bad = props.polarity === 'up-bad' ? CV.good : CV.bad
  const fill = (s: WaterfallStep<D>): string =>
    s.kind === 'total' ? CV.inkMuted : s.kind === 'increase' ? good : bad
  const ink = { light: CV.inkMuted, dark: CV.inkMuted }
  const caption = (s: WaterfallStep<D>): string =>
    s.kind === 'total' ? format(s.end) : signed(s.delta, format)
  return (
    <CartesianPlot<WaterfallStep<D>>
      label={props.label}
      data={steps}
      x={{
        value: (s) => s.step,
        ...(props.ticks === 'all' && { ticks: steps.map((s) => s.step) }),
      }}
      // The labels sit above the bars: the domain keeps a tenth of its span free at the ends.
      y={{ format, domain: { pad: 0.1 }, ...props.y }}
      series={[
        {
          mark: 'bar',
          key: 'step',
          label: props.valueLabel ?? 'Amount',
          color: ink,
          y: (s) => s.end,
          format: (_, s) => caption(s),
        },
      ]}
      tooltip={{
        rows: (s) => (s.kind === 'total' ? [] : [{ label: 'Running total', value: format(s.end) }]),
      }}
      marks={CartesianChart.custom<WaterfallStep<D>>((plot) =>
        asMarks([
          decorative(
            text(plot.rows('step'), {
              id: 'waterfall-values',
              x: (s: WaterfallStep<D>) => s.step,
              y: (s: WaterfallStep<D>) => Math.max(s.start, s.end),
              text: caption,
              fill: CV.ink,
              fontSize: BASALT.text.micro,
              anchor: 'middle',
              dy: LABEL_DY,
            }),
          ),
        ]),
      )}
      floating={{ base: (s) => s.start, fill }}
      {...(props.phase !== undefined && { phase: props.phase })}
      {...(props.summary !== undefined && { summary: props.summary })}
      {...(props.height !== undefined && { height: props.height })}
      {...(props.table !== undefined && { table: props.table })}
      {...(props.cursor !== undefined && { cursor: props.cursor })}
    />
  )
}
