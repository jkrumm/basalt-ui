import { areaY } from '@tanstack/charts/area'
import { dot } from '@tanstack/charts/dot'
import { lineY } from '@tanstack/charts/line'
import { rect } from '@tanstack/charts/rect'
import { text } from '@tanstack/charts/text'
import { createFormat } from 'basalt-ui'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { Card } from 'basalt-ui/ui/card'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'basalt-ui/ui/table'
import { Page, useSizeClass } from 'basalt-ui/page'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { WIND_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { MODELS, PART_KT, buildForecast, compass } from './fixture'
import type { FixtureName, Hour, ModelKey } from './fixture'

const fmt = createFormat({ timeZone: 'UTC' })
const dayTime = (t: Date): string =>
  `${fmt.date(t, 'weekday')} ${fmt.time(t, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`
const round1 = (v: number): number => Math.round(v * 10) / 10
const kt = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1))
const label = (key: ModelKey): string => MODELS.find((m) => m.key === key)?.label ?? key

const isFixture = (v: string | undefined): v is FixtureName =>
  v === 'calm' || v === 'storm' || v === 'default'

const modelSeries = MODELS.map(({ key, label: name }) => ({
  mark: 'line' as const,
  key,
  label: name,
  color: WIND_SERIES[key],
  y: (d: Hour): number => d.speed[key],
  format: (v: number): string => `${kt(v)} kt`,
}))

export function ExprN10Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const forecast = buildForecast(isFixture(fixture) ? fixture : 'default')
  const { hours, start, parting, widest, peakGust } = forecast
  const focus = useChartFocus(hours, {
    announce: (d) =>
      `${dayTime(d.t)}: ${MODELS.map((m) => `${m.label} ${kt(d.speed[m.key])}`).join(', ')}, ${kt(d.spread)} kt apart`,
  })
  const shown = focus.datum ?? widest
  const [model, setModel] = useState<ModelKey | null>(null)
  const ready = shotState === undefined
  const compact = useSizeClass() === 'compact'

  const phase =
    shotState === 'loading'
      ? ('loading' as const)
      : shotState === 'error'
        ? { tag: 'error' as const, message: 'The forecast feeds did not answer', retry: () => {} }
        : ('ready' as const)

  const rest = parting
    ? { value: `Part from ${dayTime(parting.from)}`, period: '' }
    : { value: 'Agree for all 72 h', period: '' }
  const excess = widest.spread - PART_KT
  const signed = (v: number): string =>
    `${v > 0 ? '+' : v < 0 ? '-' : ''}${kt(Math.abs(round1(v)))} kt`

  const chartCard = (
    <ChartCard
      title="Wind forecast, four models"
      subtitle={`Next 72 h from ${dayTime(start)}`}
      phase={phase}
      empty={
        shotState === 'empty'
          ? { cause: 'No model has published a run yet. Check again after the next model run.' }
          : null
      }
      figure={
        shotState === undefined
          ? {
              // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n10, kept as its builder left it: its figure follows focus, built before figure-readout
              value: focus.readout(rest.value, (d) => `${kt(d.spread)} kt apart`),
              period: focus.readout(rest.period, (d) => dayTime(d.t)),
            }
          : { value: null }
      }
      footer={[
        { label: `Gap vs ${PART_KT} kt`, value: ready ? signed(excess) : '-' },
        {
          label: 'Peak gust',
          value: ready ? `${kt(peakGust.value)} kt ${label(peakGust.model)}` : '-',
        },
      ]}
      chart={() => (
        <CartesianChart
          label="Wind speed of four forecast models over 72 hours with the ensemble 10 to 90 percent band"
          summary={
            parting
              ? `The models part from ${dayTime(parting.from)} to ${dayTime(parting.to)}, up to ${kt(widest.spread)} knots apart.`
              : `The models agree within ${kt(widest.spread)} knots for 72 hours.`
          }
          table
          data={hours}
          focus={focus}
          x={{ value: (d) => d.t, title: 'Time, UTC' }}
          y={{
            // cycle-expression-5: the kit has no minimum span, so ceil 5 keeps a calm run from zooming noise into swings.
            domain: { floor: 0, ceil: 5, pad: 0.05 },
            title: 'Wind speed, kt',
            format: kt,
          }}
          series={[
            ...modelSeries,
            {
              mark: 'line',
              key: 'p90',
              label: 'Ensemble 10-90%',
              color: WIND_SERIES.other,
              weight: 'quiet',
              dash: true,
              y: (d) => d.p90,
              format: (v) => `${kt(v)} kt`,
            },
            {
              mark: 'line',
              key: 'p10',
              label: 'Ensemble 10%',
              color: WIND_SERIES.other,
              weight: 'quiet',
              dash: true,
              legend: false,
              y: (d) => d.p10,
              format: (v) => `${kt(v)} kt`,
            },
          ]}
          tooltip={{
            formatHeader: (d) => dayTime(d.t),
            rows: (d) => [
              ...MODELS.map((m) => ({
                label: m.label,
                value: `${kt(d.speed[m.key])} kt, gust ${kt(d.gust[m.key])}, ${compass(d.dir[m.key])}`,
                color: WIND_SERIES[m.key],
              })),
              {
                label: 'Ensemble 10-90%',
                value: `${kt(d.p10)} to ${kt(d.p90)} kt`,
                color: WIND_SERIES.other,
              },
            ],
          }}
          zones={
            parting
              ? [
                  {
                    axis: 'x',
                    from: parting.from,
                    to: parting.to,
                    fill: alpha(BASALT.ink, 0.06),
                  },
                ]
              : []
          }
          marks={CartesianChart.custom<Hour>((plot) => {
            const band = plot.rows('p90')
            const marks: unknown[] = [
              // cycle-expression-5: the kit has no band series (a filled range between two series), so the ensemble fill is an engine area mark between the p10 and p90 rows.
              areaY(band, {
                x: (d: Hour) => d.t,
                y1: (d: Hour) => d.p10,
                y2: (d: Hour) => d.p90,
                fill: alpha(BASALT.ink, 0.1),
              }),
            ]
            // cycle-expression-5: the kit dims no series per datum, so the models a table row does not point at are veiled with a card-colored line over each.
            if (model !== null) {
              for (const m of MODELS) {
                if (m.key === model) continue
                marks.push(
                  lineY(plot.data, {
                    x: (d: Hour) => d.t,
                    y: (d: Hour) => d.speed[m.key],
                    stroke: BASALT.card,
                    strokeWidth: 3,
                    strokeOpacity: 0.7,
                  }),
                )
              }
            }
            if (parting) {
              const speeds = MODELS.map((m) => widest.speed[m.key])
              // cycle-expression-5: the kit lacked a range bracket between the fastest and slowest series at one x, so the gap is a thin rect mark.
              marks.push(
                rect([widest], {
                  x1: (d: Hour) => new Date(d.t.getTime() - 1_200_000),
                  x2: (d: Hour) => new Date(d.t.getTime() + 1_200_000),
                  y1: () => Math.min(...speeds),
                  y2: () => Math.max(...speeds),
                  fill: alpha(BASALT.ink, 0.55),
                }),
              )
            }
            const at = plot.focused
            if (at !== null) {
              // cycle-expression-5: the cursor marks one series only, so the focused hour gets a dot on every model line.
              marks.push(
                dot(MODELS, {
                  x: () => at.t,
                  y: (m: (typeof MODELS)[number]) => at.speed[m.key],
                  r: BASALT.dotR + 1,
                  fill: BASALT.ink,
                }),
              )
            }
            const last = widest
            if (parting && !compact) {
              const lx = plot.x(last.t) ?? 0
              // cycle-expression-5: a kit chart names its series in the legend only, so the models are named by placed direct labels at the widest gap, where the lines are apart.
              const yOf = (key: string): number =>
                key === 'gap'
                  ? (Math.min(...MODELS.map((m) => last.speed[m.key])) +
                      Math.max(...MODELS.map((m) => last.speed[m.key]))) /
                    2
                  : last.speed[key as ModelKey]
              const { placed } = chartLabels.place(
                [
                  ...MODELS.map((m) => ({
                    key: m.key,
                    text: m.label,
                    x: lx,
                    y: plot.y(yOf(m.key)),
                  })),
                  { key: 'gap', text: `${kt(last.spread)} kt`, x: lx, y: plot.y(yOf('gap')) },
                ],
                { width: plot.plotWidth, height: plot.plotHeight },
                { gap: 6 },
              )
              marks.push(
                text(placed, {
                  x: () => last.t,
                  y: (l: (typeof placed)[number]) => yOf(l.key),
                  text: (l) => l.text,
                  dx: (l) => l.dx,
                  dy: (l) => l.dy,
                  anchor: (l) => l.textAnchor,
                  fill: BASALT.ink,
                  fontSize: BASALT.text.micro,
                }),
              )
            }
            return marks
          })}
        />
      )}
    />
  )

  const cell = (v: string): string => (ready ? v : '-')
  return (
    <Page area="expr-n10">
      <div className="grid gap-3 @wide:grid-cols-3">
        <div className="min-w-0 @wide:col-span-2">{chartCard}</div>
        <Card className="min-w-0 self-start" onPointerLeave={() => setModel(null)}>
          <Table size="sm">
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead numeric>Wind</TableHead>
                <TableHead numeric>Gust</TableHead>
                <TableHead numeric>From</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MODELS.map((m) => (
                <TableRow
                  key={m.key}
                  tabIndex={0}
                  onPointerEnter={() => setModel(m.key)}
                  onFocus={() => setModel(m.key)}
                  onBlur={() => setModel(null)}
                >
                  <TableCell>{m.label}</TableCell>
                  <TableCell numeric>{cell(kt(shown.speed[m.key]))}</TableCell>
                  <TableCell numeric>{cell(kt(shown.gust[m.key]))}</TableCell>
                  <TableCell numeric>
                    {cell(`${compass(shown.dir[m.key])} ${shown.dir[m.key]}°`)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell>Ensemble</TableCell>
                <TableCell numeric>{cell(`${kt(shown.p10)}-${kt(shown.p90)}`)}</TableCell>
                <TableCell numeric>-</TableCell>
                <TableCell numeric>-</TableCell>
              </TableRow>
            </TableBody>
            <TableCaption>{ready ? `${dayTime(shown.t)}, kt` : 'kt'}</TableCaption>
          </Table>
        </Card>
      </div>
    </Page>
  )
}
