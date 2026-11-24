import { createFileRoute } from '@tanstack/react-router'
import { useFormat } from 'basalt-ui'
import { BarList } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { BarsSeries } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { SERVED_SERIES } from '../../demo/series'
import {
  FIRST_TRY,
  HOUR_MS,
  KIND_NAMES,
  MODELS,
  MODEL_NAMES,
  QUIET_WEEK,
  weekNamed,
} from '../../demo/router-week'
import { FIRST_MODELS, summarize } from '../../demo/router-week-summary'
import type { Hour } from '../../demo/router-week-summary'
import { validateShotSearch } from '../../scenarios/shot-state'

export const Route = createFileRoute('/kit/bar-list-series')({
  staticData: { title: 'BarList by series' },
  validateSearch: validateShotSearch,
  component: BarListSeriesRoute,
})

const WEEK = summarize(weekNamed(undefined))
const QUIET = summarize(QUIET_WEEK)
const noop = (): void => undefined
/** A kind's series is the model tried first for it. */
const MODEL_OF = new Map<string, string>(Object.entries(FIRST_TRY))

/**
 * A router week (demo/router-week) through the shipped join: a `BarList` of request kinds
 * beside hourly bars stacked by the model tried first. Each kind stands for its first-try model,
 * so `focusSeries` joins the list to the chart with no adapter, and the chart takes the phone
 * height that keeps its axis readable at 390 (`height="tall"`).
 */
function BarListSeriesRoute(): ReactElement {
  const search = Route.useSearch()
  const shotState = search['shot-state']
  const f = useFormat()
  const s = shotState === 'empty' ? QUIET : WEEK
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The router log did not answer.' }
        : 'ready'
  const pct = (fraction: number): string => f.percent(fraction, { maximumFractionDigits: 0 })
  const hourText = (h: Hour): string =>
    `${f.date(h.at, 'weekday')} ${f.time(h.at, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`
  const focus = useChartFocus(s.hours, {
    announce: (h) => `${hourText(h)}: ${h.fallbacks} of ${h.requests} fell back`,
  })
  const series = FIRST_MODELS.map((model): BarsSeries<Hour> => ({
    mark: 'bar',
    key: model,
    label: MODEL_NAMES[model],
    color: SERVED_SERIES[model],
    y: (h) => (h.requests === 0 ? null : (h.from[model] / h.requests) * 100),
  }))
  const first = s.hours[0]?.at.getTime() ?? 0
  const dayStarts = Array.from({ length: 7 }, (_, d) => new Date(first + d * 24 * HOUR_MS))
  return (
    <Page area="kit-bar-list-series">
      <PageBar title="Model router, last 7 days" />
      <ChartCard
        title="Fallbacks per hour"
        subtitle="By the model tried first, UTC"
        phase={phase}
        empty={s.requests === 0 ? { cause: 'No requests reached the router this week.' } : null}
        height="tall"
        figure={
          phase === 'ready' && s.requests > 0
            ? {
                value: pct(s.rate),
                unit: 'fell back',
                period: focus.readout(
                  `of ${f.number(s.requests)} requests`,
                  (h) =>
                    `${hourText(h)}: ${pct(h.requests === 0 ? 0 : h.fallbacks / h.requests)} fell back`,
                ),
              }
            : { value: null }
        }
        chart={(box) => (
          <Bars
            label="Requests that fell back each hour, as a percentage of that hour's requests, stacked by the model tried first"
            data={s.hours}
            height={box.height}
            focus={focus}
            tooltip={false}
            x={{
              value: (h) => h.at,
              ticks: dayStarts,
              format: (x) => f.date(new Date(x), 'weekday'),
            }}
            y={{ title: 'Fell back, % of requests', format: (v) => `${f.number(v)}%` }}
            series={series}
          />
        )}
      />
      <BarList
        title="Served by model"
        subtitle="Requests by kind; a kind stands for the model tried first"
        phase={phase}
        bodyRows={4}
        focusSeries={{ focus, key: (row) => MODEL_OF.get(row.key ?? '') ?? '' }}
        series={MODELS.map((model) => ({
          key: model,
          label: MODEL_NAMES[model],
          color: SERVED_SERIES[model],
        }))}
        items={s.kinds.map((row) => ({
          key: row.kind,
          label: KIND_NAMES[row.kind],
          value: row.requests,
          parts: row.parts,
        }))}
      />
    </Page>
  )
}
