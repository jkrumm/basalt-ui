/**
 * Which model served each kind of request this week, and how often a request fell back to a second
 * model. One card answers how often and when (fallbacks per hour, stacked by the model tried first,
 * the unavailable window on the plot), one the kinds by the model that served them, one the first-try
 * models in a table. A kind, its first-try model, the chart's series and the table row are one item:
 * pointing at any of them emphasises the series in the chart and marks the row in the other two.
 */
import { useFormat } from 'basalt-ui'
import { BarList, DataPanel } from 'basalt-ui/cards'
import type { BarListProps, Delta, Empty, Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { BarsSeries, ChartRefLine } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import { SERVED_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  FIRST_TRY,
  HOUR_MS,
  KIND_NAMES,
  MODELS,
  MODEL_NAMES,
  QUIET_WEEK,
  weekNamed,
} from './fixture'
import { FIRST_MODELS, summarize } from './summary'
import type { Hour, KindRow, ModelRow, Summary } from './summary'

const SUMMARIES = {
  week: summarize(weekNamed(undefined)),
  calm: summarize(weekNamed('calm')),
  down: summarize(weekNamed('down')),
  quiet: summarize(QUIET_WEEK),
}

function summaryFor(fixture: string | undefined, shotState: ScenarioProps['shotState']): Summary {
  if (shotState === 'empty') return SUMMARIES.quiet
  if (fixture === 'calm') return SUMMARIES.calm
  if (fixture === 'down') return SUMMARIES.down
  return SUMMARIES.week
}

/** The cause and the next step are said once, on the card that leads; the two below name only what they lack. */
const EMPTY: Empty = {
  cause:
    'No requests reached the router in the last 7 days. They appear here once a client calls it.',
}
const EMPTY_KINDS: Empty = { cause: 'No requests to split by model.' }
const EMPTY_MODELS: Empty = { cause: 'No fallbacks to count.' }

const BRAND = { light: BASALT.brand, dark: BASALT.brand }
const INK = { light: BASALT.ink, dark: BASALT.ink }

const c = col<ModelRow>()
const COLUMNS = [
  c.entity('name', { header: 'Model', sub: (row) => row.leads, priority: 1, sortable: false }),
  c.number('fellBack', { header: 'Fell back', priority: 1, sortable: false }),
  c.number('rate', { header: 'Rate', unit: '%', digits: 1, priority: 2, sortable: false }),
]

export function ExprN41Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const s = summaryFor(fixture, shotState)
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The router log did not answer.', retry: () => undefined }
        : 'ready'
  const quiet = s.requests === 0
  const ready = phase === 'ready' && !quiet

  const pct = (fraction: number, digits = 1): string =>
    f.percent(fraction, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  // cycle-expression-10: `useFormat().number` has no true-minus sign, so the signed figures swap the hyphen for U+2212 here.
  const signed = (n: number, unit: string): string =>
    `${f.number(n, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).replace('-', '\u2212')} ${unit}`
  const ms = (n: number | null): string => (n === null ? '\u2013' : `${f.number(n)} ms`)
  const hourText = (h: Hour): string =>
    `${f.date(h.at, 'weekday')} ${f.time(h.at, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`
  const hourRate = (h: Hour): number => (h.requests === 0 ? 0 : h.fallbacks / h.requests)
  const kindText = (row: KindRow): string => {
    const served = MODELS.filter((m) => (row.parts[m] ?? 0) > 0).map(
      (m) => `${MODEL_NAMES[m]} ${pct((row.parts[m] ?? 0) / row.requests, 0)}`,
    )
    return `${KIND_NAMES[row.kind]}: ${f.number(row.requests)} requests, ${served.join(', ')}`
  }

  const hourFocus = useChartFocus(s.hours, {
    announce: (h) => {
      const from = FIRST_MODELS.filter((m) => h.from[m] > 0).map(
        (m) => `${MODEL_NAMES[m]} ${h.from[m]}`,
      )
      return `${hourText(h)}: ${h.fallbacks} of ${h.requests} fell back${from.length === 0 ? '' : `, ${from.join(', ')}`}`
    },
  })

  // cycle-expression-10: BarList takes an item-grain focus, and its rows (kinds) are the chart's series (first-try models), so this adapter maps a row to the series focus and marks a row whose model fell back in the focused hour.
  const kindModels = s.kinds.map((row) => FIRST_TRY[row.kind])
  const kindAt = kindModels.findIndex((model) => model === hourFocus.series)
  const kindFocus: NonNullable<BarListProps['focus']> = {
    items: s.kinds,
    index: kindAt === -1 ? null : kindAt,
    set: (i) => hourFocus.setSeries(i === null ? null : (kindModels[i] ?? null)),
    item: (i) => {
      const model = kindModels[i]
      const base = hourFocus.seriesItem(model ?? '')
      const fellThisHour =
        model !== undefined && hourFocus.datum !== null && hourFocus.datum.from[model] > 0
      return fellThisHour ? { ...base, 'data-focused': '' } : base
    },
    step: (key) => {
      const last = kindModels.length - 1
      const at = kindAt === -1 ? null : kindAt
      if (key === 'ArrowDown') return at === null ? 0 : Math.min(last, at + 1)
      if (key === 'ArrowUp') return at === null ? last : Math.max(0, at - 1)
      if (key === 'Home') return 0
      if (key === 'End') return last
      if (key === 'Escape') return null
      return undefined
    },
    hold: () => undefined,
    span: [],
  }
  const kindFocused = s.kinds[kindAt]

  const table = useDataTable({
    id: 'expr-n41-models',
    label: 'Fallbacks by model',
    columns: COLUMNS,
    data: s.models.toSorted((a, b) => b.fellBack - a.fellBack),
    getRowId: (row) => row.model,
    mode: { kind: 'client' },
    bodyRows: s.models.length,
  })

  const restDelta: Delta | undefined =
    s.down === undefined || s.rateElsewhere === null
      ? undefined
      : {
          value: signed((s.rate - s.rateElsewhere) * 100, 'pts'),
          polarity: s.rate > s.rateElsewhere ? 'up-bad' : 'neutral',
          label: 'vs outside the outage',
        }
  const hourDelta = (h: Hour): Delta => ({
    value: signed((hourRate(h) - s.rate) * 100, 'pts'),
    polarity: h.fallbacks > 0 ? 'up-bad' : 'neutral',
    label: 'vs the week',
  })
  const peakRate = Math.max(0, ...s.hours.map((h) => hourRate(h) * 100))
  const oneRequest = s.typicalHour === 0 ? 0 : 100 / s.typicalHour
  const dayStarts = s.hours.filter((h) => h.at.getUTCHours() === 0).map((h) => h.at)
  // cycle-expression-10: a zone on a band axis runs from the centre of its first band to the centre of its last and drops any edge that is not a band key, so it cut the first and last bar in half; two rules on the band edges (`at`) bracket the unavailable hours whole.
  const outageLines: readonly ChartRefLine[] =
    s.down === undefined || s.downFrom === undefined || s.downTo === undefined
      ? []
      : [
          {
            axis: 'x',
            value: s.downFrom,
            at: 'start',
            color: BRAND,
            dashed: true,
            label: `${MODEL_NAMES[s.down]} down, ${
              s.downHours < 48 ? `${s.downHours} h` : `${s.downHours / 24} days`
            }`,
          },
          {
            axis: 'x',
            value: new Date(s.downTo.getTime() - HOUR_MS),
            at: 'end',
            color: BRAND,
            dashed: true,
          },
        ]
  // cycle-expression-10: the kit drops a value label on the worst bar where a rule runs through it, and `values` labels every bar (zeros too), so the peak is a labelled rule across the plot at its height.
  const peakLines: readonly ChartRefLine[] =
    s.worst === null
      ? []
      : [
          {
            value: peakRate,
            color: INK,
            dashed: true,
            label: `Peak ${f.number(peakRate, { maximumFractionDigits: 0 })}%`,
          },
        ]
  // cycle-expression-10: an hour with no bar draws nothing when focused and the rest dims, so the focused hour gets a rule through its centre.
  const focusLines: readonly ChartRefLine[] =
    hourFocus.datum === null ? [] : [{ axis: 'x', value: hourFocus.datum.at, color: INK }]
  const series = FIRST_MODELS.map((model): BarsSeries<Hour> => ({
    mark: 'bar',
    key: model,
    label: MODEL_NAMES[model],
    color: SERVED_SERIES[model],
    y: (h) => (h.requests === 0 ? null : (h.from[model] / h.requests) * 100),
  }))

  return (
    <Page area="expr-n41">
      <PageBar title="Model router, last 7 days" />
      <ChartCard
        title="Fallbacks per hour"
        subtitle="By the model tried first, UTC"
        info="A request falls back when the model tried first is unavailable or times out, and a second model serves it. Median added is the extra latency of a fallback."
        phase={phase}
        empty={quiet ? EMPTY : null}
        figure={
          ready
            ? {
                // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n41, kept as its builder left it: its figure follows focus, built before figure-readout
                value: hourFocus.readout(s.fallbacks === 0 ? '0%' : pct(s.rate), (h) =>
                  pct(hourRate(h), 0),
                ),
                unit: 'fell back',
                // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n41, kept as its builder left it: its figure follows focus, built before figure-readout
                delta: hourFocus.readout(restDelta, hourDelta),
                period: hourFocus.readout(
                  `of ${f.number(s.requests)} requests`,
                  (h) => `${hourText(h)}, ${h.fallbacks} of ${h.requests}`,
                ),
                periodMono: hourFocus.readout(false, () => true),
              }
            : { value: null }
        }
        footer={[
          {
            label: 'Median added',
            value:
              ready && s.addedMs !== null
                ? signed(s.addedMs, 'ms').replace(' ', '\u00a0')
                : '\u2013',
          },
          { label: 'Slowest fallback', value: ms(ready ? s.slowestMs : null) },
        ]}
        chart={(box) => (
          <Bars
            label="Requests that fell back each hour of the week, as a percentage of that hour's requests, stacked by the model tried first"
            summary={
              s.worst === null
                ? 'No request fell back.'
                : `${s.fallbacks} of ${s.requests} requests fell back; the worst hour was ${hourText(s.worst)}, ${s.worst.fallbacks} of ${s.worst.requests}.`
            }
            data={s.hours}
            height={box.height}
            focus={hourFocus}
            tooltip={false}
            x={{
              value: (h) => h.at,
              ticks: dayStarts,
              format: (x) => f.date(new Date(x), 'weekday'),
            }}
            y={{
              title: `Fell back, % of requests (1 request is about ${f.number(oneRequest, { maximumFractionDigits: 0 })}%)`,
              format: (v) => `${f.number(v, { maximumFractionDigits: 0 })}%`,
              // cycle-expression-10: a function domain reads a per-series extent, not the stack's total (it clipped the 51 % hour at 50 %), so the top is derived from the hour rates, with room for the label above the worst bar.
              domain: [0, Math.max(10, Math.ceil((peakRate * 1.2) / 10) * 10)],
            }}
            refLines={[...outageLines, ...peakLines, ...focusLines]}
            series={series}
          />
        )}
      />
      <CardGrid min="regular">
        <BarList
          title="Served by model"
          subtitle="Share of each request kind"
          phase={phase}
          empty={quiet ? EMPTY_KINDS : null}
          bodyRows={4}
          focus={kindFocus}
          series={MODELS.map((model) => ({
            key: model,
            label: MODEL_NAMES[model],
            color: SERVED_SERIES[model],
          }))}
          items={s.kinds.map((row) => ({
            key: row.kind,
            label: KIND_NAMES[row.kind],
            value: row.requests,
            secondary: `${MODEL_NAMES[row.top]} ${pct(row.topShare, 0)}`,
            parts: row.parts,
          }))}
        />
        <DataPanel
          title="Fallbacks by model"
          subtitle="Rate is the share of the model's own requests"
          phase={phase}
          empty={quiet ? EMPTY_MODELS : null}
          bodySize={{ rows: 5 }}
          body={() => (
            <DataTable
              table={table}
              height="fill"
              focusSeries={{ focus: hourFocus, key: (row) => row.model }}
            />
          )}
        />
      </CardGrid>
      {/* cycle-expression-10: the chart's live region announces hours only, so a row focused in the list is announced here. */}
      <output className="sr-only">{kindFocused === undefined ? '' : kindText(kindFocused)}</output>
    </Page>
  )
}
