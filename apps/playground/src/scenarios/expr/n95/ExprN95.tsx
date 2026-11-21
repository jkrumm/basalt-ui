import { useFormat } from 'basalt-ui'
import type { Format } from 'basalt-ui'
import { externalField, type PlainStore } from 'basalt-ui'
import type { Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { ChartFocus, ChartZone, LegendEntry } from 'basalt-ui/charts'
import { filterSlot, spec } from 'basalt-ui/controls'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { useState } from 'react'
import { N95_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  FIXTURES,
  PARTIAL_MINUTES,
  STATES,
  STATE_LABEL,
  WINDOWS,
  bucketsFor,
  summarize,
} from './fixture'
import type { Bucket, StateKey, Summary, WindowKey } from './fixture'

const WINDOW_LABEL: Record<WindowKey, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
}

const issues = (n: number): string => `${n} Issues`

const LEGEND: readonly LegendEntry[] = [
  { key: 'peak', label: 'Peak', color: N95_SERIES.peak, swatch: 'bar' },
  {
    key: 'worst',
    label: 'Worst',
    color: { light: BASALT.brand, dark: BASALT.brand },
    swatch: 'bar',
  },
  { key: 'avg', label: 'Average', color: N95_SERIES.avg, swatch: 'solid' },
]

/** One state's pane: peak bars, the average line, the worst bar in the accent, labels on each state's own peak. */
function paneOf(p: {
  state: StateKey
  buckets: readonly Bucket[]
  summary: Summary
  focus: ChartFocus<Bucket>
  stamp: (at: number | Date | string) => string
  per: string
  last: boolean
  zones: readonly ChartZone[]
}) {
  const { state, summary } = p
  const mine = summary.perState[state]
  const isWorst = summary.worst.state === state
  return ({ height }: { height: number | 'fill' }) => (
    <CartesianChart
      label={`${STATE_LABEL[state]}, per ${p.per}`}
      data={p.buckets}
      focus={p.focus}
      tooltip={false}
      height={height}
      x={{
        value: (d) => new Date(d.at),
        format: p.stamp,
        domain: [new Date(p.buckets[0]?.at ?? 0), new Date((p.buckets.at(-1)?.at ?? 0) + 1)],
        ...(p.last ? {} : { ticks: [] }),
      }}
      y={{ title: STATE_LABEL[state], domain: [0, summary.ceil], gutter: 44 }}
      zones={p.zones}
      series={[
        {
          mark: 'bar',
          key: 'peak',
          label: 'Peak',
          color: N95_SERIES.peak,
          legend: false,
          y: (d) => d.peak[state],
          format: issues,
          opacity: (d) => (d.partial ? 0.5 : 1),
          highlight: (d) => isWorst && d.at === mine.peakAt,
          values: (v, d) => (d.at === mine.peakAt ? String(v) : ''),
        },
        {
          mark: 'line',
          key: 'avg',
          label: 'Average',
          color: N95_SERIES.avg,
          legend: false,
          y: (d) => d.avg[state],
          format: issues,
        },
      ]}
    />
  )
}

function stampOf(f: Format, window: WindowKey): (at: number | Date | string) => string {
  return (at) => {
    const ms = new Date(at).getTime()
    const day = `${f.date(ms, 'weekday')} ${f.date(ms, 'day')}`
    if (window === '30d') return day
    return `${day}, ${f.time(ms, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`
  }
}

function createMemoryStore<T>(initial: T): PlainStore<T> {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return
      value = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** The state with the most Issues at the peak of one bucket, for the readout. */
function busiest(d: Bucket): { state: StateKey; peak: number } | null {
  let best: { state: StateKey; peak: number } | null = null
  for (const state of STATES) {
    const peak = d.peak[state]
    if (peak !== null && (best === null || peak > best.peak)) best = { state, peak }
  }
  return best
}

function Scenario({
  shotState,
  fixture,
}: {
  shotState: ScenarioProps['shotState']
  fixture: string
}) {
  const fx = FIXTURES[fixture] ?? FIXTURES['default']!
  const f = useFormat()
  // cycle-expression-19: the scenario route owns the URL, so the window control is a memory field, not a page store field.
  const [windowField] = useState(() =>
    externalField<WindowKey>(createMemoryStore<WindowKey>(fx.window), {
      key: 'n95-window',
      kind: 'enum',
      fallback: '7d',
      options: WINDOWS.map((value) => ({ value, label: WINDOW_LABEL[value] })),
    }),
  )
  const [window] = windowField.use()
  const [failed, setFailed] = useState(shotState === 'error')

  const buckets = bucketsFor(window, fx)
  const summary = summarize(buckets)
  const stamp = stampOf(f, window)
  const per = window === '30d' ? 'day' : 'hour'
  const focus = useChartFocus(buckets, {
    announce: (d) => {
      const parts = STATES.map(
        (s) => `${STATE_LABEL[s].toLowerCase()} ${d.peak[s] === null ? 'none' : issues(d.peak[s])}`,
      ).join(', ')
      return `${stamp(d.at)}: ${parts}`
    },
  })

  const loading = shotState === 'loading'
  const empty = shotState === 'empty' || summary === null
  const phase: Phase = loading
    ? 'loading'
    : failed
      ? { tag: 'error', message: 'The factory did not answer.', retry: () => setFailed(false) }
      : 'ready'
  const ready = phase === 'ready' && !empty && summary !== null

  const firstBucket = buckets[0]?.at ?? 0
  const before: ChartZone | null =
    summary?.firstAt != null && summary.firstAt > firstBucket
      ? {
          axis: 'x',
          from: firstBucket,
          to: summary.firstAt,
          fill: alpha(BASALT.ink, 0.06),
        }
      : null
  const zonesOf = (i: number): readonly ChartZone[] =>
    before === null ? [] : [i === 0 ? { ...before, label: 'Before the first Issue' } : before]

  const worst = ready ? summary.worst : null
  const spiky = ready && summary.near * 5 <= summary.total
  const figure = {
    value: worst === null ? null : worst.peak,
    unit: 'Issues',
    delta: {
      value: worst === null ? '' : `+${Math.round((worst.peak - worst.mean) * 10) / 10}`,
      polarity: 'neutral' as const,
      label: worst === null ? '' : `vs ${worst.mean} average`,
    },
    period:
      worst === null
        ? ''
        : focus.readout(`${STATE_LABEL[worst.state]}, ${stamp(worst.peakAt)}`, (d) => {
            const top = busiest(d)
            return top === null
              ? `${stamp(d.at)}, nothing yet`
              : `${stamp(d.at)}, ${STATE_LABEL[top.state]} ${top.peak}`
          }),
    periodMono: true,
    status: {
      tone: 'neutral' as const,
      label: worst === null ? '' : spiky ? 'A few spikes' : 'Steady',
    },
  }

  return (
    <Page area="expr-n95">
      <PageBar
        title="Factory work by state"
        controls={filterSlot([spec(windowField, 'Window', { as: 'segmented' })])}
      />
      <ChartCard
        title="Counts per state"
        subtitle={`Per ${per}, UTC`}
        phase={phase}
        empty={
          empty
            ? { cause: 'Nothing has run yet. Counts appear here once the first one starts.' }
            : null
        }
        info="Near means within half of the highest count."
        height="tall"
        figure={figure}
        legend={LEGEND}
        footer={[
          {
            label: `${per === 'day' ? 'Days' : 'Hours'} near peak`,
            value: ready ? `${summary.near} of ${summary.total}` : '',
          },
          { label: `Latest ${per}`, value: ready ? `${PARTIAL_MINUTES} min` : '', mono: true },
        ]}
        panes={STATES.map((state, i) => ({
          chart: ready
            ? paneOf({
                state,
                buckets,
                summary,
                focus,
                stamp,
                per,
                last: i === STATES.length - 1,
                zones: zonesOf(i),
              })
            : () => null,
        }))}
      />
    </Page>
  )
}

export function ExprN95Scenario({ shotState, fixture }: ScenarioProps) {
  const name = fixture !== undefined && fixture in FIXTURES ? fixture : 'default'
  return <Scenario key={name} shotState={shotState} fixture={name} />
}
