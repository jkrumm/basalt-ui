import type { ReactElement } from 'react'
import { Bars, ChartCard, Lines } from '../../charts'
import { IntlScope } from '../../core/provider-props'
import type { IslandMessages } from './messages'

/** One series of a content-site chart: plain data, so it can cross an island boundary. */
export type ChartSeriesSpec = {
  /** The key in each data row. */
  key: string
  /** The legend and tooltip name. */
  label: string
  /** Which of the five chart colors (`--basalt-chart-1` to `-5`). Default: the series' position. */
  color?: 1 | 2 | 3 | 4 | 5
}

/** A data row: strings, numbers and dates, all of which Astro serialises. */
export type ChartRow = Readonly<Record<string, string | number | Date>>

export type ChartIslandProps = {
  /** `lines` (default) for a trend over time, `bars` for amounts per period or category. */
  kind?: 'lines' | 'bars'
  /** The card title. */
  title: string
  /** The chart's accessible name. Default: the title. */
  label?: string
  /** The card's headline figure ("34 deploys"). */
  figure?: string
  /** What the figure covers ("week of 22 Sep"). */
  period?: string
  data: readonly ChartRow[]
  /** The key of the x value: an ISO date string (read as a time) or a category. */
  x: string
  series: readonly ChartSeriesSpec[]
  /** The locale numbers and dates read in. Default `en`. */
  locale?: string
  /** Overrides of the chart's English words, by key: `{ 'charts.unavailable': 'Keine Daten' }`. */
  messages?: IslandMessages
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

function xOf(row: ChartRow, key: string): Date | string | number {
  const value = row[key]
  if (value === undefined) return ''
  return typeof value === 'string' && ISO_DATE.test(value) ? new Date(value) : value
}

function color(index: number, pick: ChartSeriesSpec['color']): { light: string; dark: string } {
  const token = `var(--basalt-chart-${pick ?? (index % 5) + 1})`
  return { light: token, dark: token }
}

/**
 * A chart card for an MDX page: a `ChartCard` around `Lines` or `Bars`, built from plain data so an
 * Astro island can carry it. It needs no provider. A chart measures its box, so render it with
 * `client:only="react"` and a fallback of the card's height, or `client:visible` once the server
 * picture is right (see the `Chart` tag).
 *
 * @useWhen an article shows one small chart of a few series
 * @neverWhen the chart needs custom marks, zones or linked readouts (write an island with `CartesianChart`)
 *
 * @example
 * <ChartIsland title="Deploys" x="week" series={[{ key: 'deploys', label: 'Deploys' }]} data={[{ week: '2026-07-06', deploys: 14 }]} />
 */
export function ChartIsland({
  kind = 'lines',
  title,
  label,
  figure,
  period,
  data,
  x,
  series,
  ...intl
}: ChartIslandProps): ReactElement {
  const rows = data.map((row) => ({ row, at: xOf(row, x) }))
  const value =
    (key: string) =>
    (item: { row: ChartRow }): number | null => {
      const v = item.row[key]
      return typeof v === 'number' ? v : null
    }
  return (
    <IntlScope {...intl}>
      <ChartCard
        title={title}
        figure={figure === undefined ? undefined : { value: figure, period }}
        height="tall"
        chart={() =>
          kind === 'bars' ? (
            <Bars
              label={label ?? title}
              data={rows}
              height="fill"
              x={{ value: (d) => d.at }}
              series={series.map((s, i) => ({
                mark: 'bar' as const,
                key: s.key,
                label: s.label,
                color: color(i, s.color),
                y: value(s.key),
              }))}
            />
          ) : (
            <Lines
              label={label ?? title}
              data={rows}
              height="fill"
              x={{ value: (d) => d.at }}
              series={series.map((s, i) => ({
                mark: 'line' as const,
                key: s.key,
                label: s.label,
                color: color(i, s.color),
                y: value(s.key),
              }))}
            />
          )
        }
      />
    </IntlScope>
  )
}
