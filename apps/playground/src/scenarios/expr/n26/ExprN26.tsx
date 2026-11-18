import type { ReactElement } from 'react'

import { DataPanel } from 'basalt-ui/cards'
import type { Verdict } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'

import { PATH_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  ANSWER,
  HOPS,
  HOP_LABEL,
  HOP_SHORT,
  PINGS_PER_MINUTE,
  analyse,
  buildDay,
  eveningRises,
  previousLost,
} from './fixture'
import type { HopStats, Minute } from './fixture'

type HopRow = {
  id: string
  target: string
  sent: number
  received: number
  lostPct: number
  medianMs: number
  maxMs: number
  jitterMs: number
  longestGap: number
}

const hopCol = col<HopRow>()
const HOP_COLUMNS = [
  hopCol.entity('target', { priority: 1, header: 'Target', sortable: false }),
  hopCol.number('sent', { header: 'Sent', priority: 3, sortable: false }),
  hopCol.number('received', { header: 'Received', priority: 3, sortable: false }),
  hopCol.number('lostPct', { header: 'Lost', priority: 1, unit: '%', digits: 2, sortable: false }),
  hopCol.number('medianMs', {
    header: 'Median',
    priority: 1,
    unit: 'ms',
    digits: 1,
    sortable: false,
  }),
  hopCol.number('maxMs', { header: 'Max', priority: 1, unit: 'ms', digits: 0, sortable: false }),
  hopCol.number('jitterMs', {
    header: 'Jitter',
    priority: 3,
    unit: 'ms',
    digits: 1,
    sortable: false,
  }),
  hopCol.number('longestGap', {
    header: 'Longest gap',
    priority: 2,
    unit: 'min',
    digits: 0,
    sortable: false,
  }),
]

// cycle-expression-7: a probe with no answered ping has no median; the number column takes no null, so a hop that answered nothing all day reads 0
const toRow = (h: HopStats): HopRow => ({
  id: h.key,
  target: HOP_LABEL[h.key],
  sent: h.sent,
  received: h.received,
  lostPct: (100 * h.lost) / h.sent,
  medianMs: h.medianMs ?? 0,
  maxMs: h.maxMs ?? 0,
  jitterMs: h.jitterMs ?? 0,
  longestGap: h.longestGap,
})

const LINE_COLOR = {
  router: PATH_SERIES.soft,
  gateway: PATH_SERIES.strong,
  resolver: PATH_SERIES.mid,
  far: PATH_SERIES.strong,
} as const

const CAP = 80

const retry = (): void => undefined

const HOUR_GROUP = (m: Minute): string => String(m.at.getUTCHours()).padStart(2, '0')

export function ExprN26Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const format = useFormat()
  const rows = shotState === undefined ? buildDay(fixture) : []
  const analysis = analyse(rows)
  const ready = rows.length > 0

  const phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? ({ tag: 'error', message: 'The probe host did not answer.', retry } as const)
        : 'ready'
  const empty =
    shotState === 'empty'
      ? {
          cause:
            'The probe has logged no pings for this day. Switch it on in the router agent; pings appear within a minute.',
        }
      : null

  const clock = (d: Date): string => format.time(d)
  const hopText = (m: Minute): string =>
    HOPS.map((h) => {
      const p = m[h]
      return `${HOP_SHORT[h]} ${p.medianMs === null ? `lost all ${p.sent}` : `${p.medianMs} ms`}`
    }).join(', ')
  const focus = useChartFocus(rows, {
    announce: (m) => `${clock(m.at)}: ${hopText(m)}`,
    group: HOUR_GROUP,
  })

  const lostIn = (m: Minute): number => HOPS.reduce((s, h) => s + m[h].sent - m[h].received, 0)
  const firstLost = (m: Minute) => HOPS.find((h) => m[h].received === 0)
  const readValue = (m: Minute): string => {
    const hop = firstLost(m)
    if (hop !== undefined) return `${HOP_SHORT[hop]} lost all ${PINGS_PER_MINUTE}`
    const lost = lostIn(m)
    return lost === 0
      ? 'No packet lost'
      : `${lost} of ${HOPS.length * PINGS_PER_MINUTE} packets lost`
  }

  const restDay = `${format.date(rows[0]?.at ?? 0, 'short')} UTC`
  const restPeriod = ready
    ? analysis.culprit === null
      ? restDay
      : `${analysis.culpritMinutes} min lost at ${HOP_SHORT[analysis.culprit]}, ${restDay}`
    : undefined

  const change = analysis.culpritMinutes - previousLost(fixture)
  const restDelta = ready
    ? {
        value: `${change > 0 ? '+' : change < 0 ? '−' : ''}${Math.abs(change)} min`,
        polarity: change === 0 ? ('neutral' as const) : ('up-bad' as const),
        label: 'vs previous day',
      }
    : undefined

  const figure = ready
    ? {
        value: focus.readout(ANSWER[analysis.segment ?? 'none'], readValue),
        delta: focus.readout(restDelta, () => undefined),
        status: focus.readout<Verdict | undefined>(undefined, (m) => {
          const tone =
            firstLost(m) !== undefined ? 'bad' : lostIn(m) === 0 ? 'good' : ('neutral' as const)
          return { tone, label: hopText(m) }
        }),
        period: focus.readout(restPeriod, (m) => clock(m.at)),
        periodMono: true,
      }
    : shotState === 'loading'
      ? { value: null }
      : undefined

  const rises = eveningRises(rows)
  const riseFact = (r: (typeof rises)[number] | undefined) =>
    r === undefined
      ? { label: 'Evening delay', value: '' }
      : {
          label: `${r.hop === 'far' ? 'Far end' : HOP_SHORT[r.hop]} 19-23h`,
          value: `${r.ms >= 0 ? '+' : '\u2212'}${format.number(Math.abs(r.ms), { maximumFractionDigits: 1 })} ms`,
        }
  const footer = ready
    ? ([riseFact(rises[0]), riseFact(rises[1])] as const)
    : shotState === 'loading'
      ? ([riseFact(undefined), riseFact(undefined)] as const)
      : undefined

  const zones = analysis.gaps.map((g) => ({
    axis: 'x' as const,
    from: g.start,
    to: g.end,
    fill: alpha(BASALT.bad, 0.2),
    label: `${HOP_SHORT[g.firstHop]}${HOPS.indexOf(g.firstHop) >= 2 ? ' only' : ''} ${g.minutes} min`,
  }))

  const capped = rows.some((m) => HOPS.some((h) => (m[h].medianMs ?? 0) > CAP))

  const table = useDataTable({
    id: 'path-targets',
    label: 'Pings by target',
    columns: HOP_COLUMNS,
    data: analysis.hops.map(toRow),
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    empty,
    phone: 'scroll',
  })

  return (
    <Page area="expr-n26">
      <PageBar title="Line path, last 24 hours" />

      <ChartCard
        title="Each hop, minute by minute"
        subtitle="Median per minute; footer is 19-23h against the rest of the day"
        phase={phase}
        empty={empty}
        figure={figure}
        footer={footer}
        chart={() => (
          <CartesianChart
            label="Median round trip per minute to the router, provider gateway, public resolver and far server"
            data={rows}
            focus={focus}
            tooltip={false}
            x={{ value: (m) => m.at }}
            // cycle-expression-7: no log or broken y axis; the router's 1 ms and an extreme median share one scale, so the domain is capped and the extreme draws on the edge with a caret
            y={{
              title: capped ? `Round trip, ms (capped at ${CAP})` : 'Round trip, ms',
              domain: ([lo, hi]) => [Math.min(lo, 0), Math.min(hi * 1.3, CAP)],
            }}
            zones={zones}
            summary={`${analysis.gaps.length} gaps in which a target answered no ping; the first hop to lose every packet is ${
              analysis.culprit === null ? 'none' : HOP_LABEL[analysis.culprit]
            }.`}
            series={HOPS.map((hop) => ({
              mark: 'line' as const,
              key: hop,
              label: HOP_LABEL[hop],
              color: analysis.culprit === hop ? PATH_SERIES.culprit : LINE_COLOR[hop],
              ...(hop === 'far' ? { dash: true } : {}),
              ...(analysis.culprit === hop ? { weight: 'strong' as const } : {}),
              y: (m: Minute) => m[hop].medianMs,
            }))}
          />
        )}
      />
      <DataPanel
        title="Each target over 24 hours"
        phase={phase}
        empty={empty}
        bodySize={{ rows: 5 }}
        body={() => <DataTable table={table} />}
      />
    </Page>
  )
}
