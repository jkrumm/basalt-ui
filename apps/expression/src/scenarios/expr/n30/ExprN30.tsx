import { useMemo } from 'react'
import { useFormat } from 'basalt-ui'
import type { Format } from 'basalt-ui'
import { ChartCard, Heatmap, useChartFocus } from 'basalt-ui/charts'
import type { ChartFocus } from 'basalt-ui/charts'
import type { Delta, Empty, Phase } from 'basalt-ui/cards'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import type { ScenarioProps } from '../../shot-state'
import {
  CONTRACT_MBIT,
  DAYS,
  HOURS,
  lineLoad,
  noLoad,
  type HourCell,
  type LineLoad,
} from './line-load-fixture'

type Direction = 'down' | 'up'
type CellState = 'over' | 'missed'

const DIRECTIONS: Record<Direction, { title: string; label: string }> = {
  down: { title: 'Download', label: 'Download share of the contracted rate by day and hour' },
  up: { title: 'Upload', label: 'Upload share of the contracted rate by day and hour' },
}

const CELL_STATES = [
  { key: 'over', label: 'Over contract', tone: 'warn' },
  { key: 'missed', label: 'Not collected', tone: 'neutral' },
] as const

const pctOf = (d: HourCell, dir: Direction): number | null => (dir === 'down' ? d.downPct : d.upPct)
const atOf = (d: HourCell, dir: Direction): string | null => (dir === 'down' ? d.downAt : d.upAt)

function peakOf(cells: readonly HourCell[], dir: Direction): HourCell | undefined {
  let best: HourCell | undefined
  for (const d of cells) {
    const v = pctOf(d, dir)
    if (v === null) continue
    if (best === undefined || v > (pctOf(best, dir) ?? 0)) best = d
  }
  return best
}

function cellState(d: HourCell, dir: Direction): CellState | undefined {
  const v = pctOf(d, dir)
  if (v === null) return 'missed'
  return v > 100 ? 'over' : undefined
}

function mbitOf(d: HourCell, dir: Direction): number | null {
  const v = pctOf(d, dir)
  return v === null ? null : (v / 100) * CONTRACT_MBIT[dir]
}

function whenOf(d: HourCell, dir: Direction): string {
  const at = atOf(d, dir)
  if (at === null) return `${d.day} ${d.hour}:00, not collected`
  const gap = d.missed > 0 ? `, ${d.missed} of 4 missed` : ''
  return `${d.day} ${at}${gap}`
}

function deltaOf(f: Format, v: number | null): Delta | undefined {
  if (v === null) return undefined
  const gap = Math.round(v - 100)
  const sign = gap > 0 ? '+' : '−'
  return {
    value: `${sign}${f.number(Math.abs(gap))} pts`,
    polarity: gap > 0 ? 'up-bad' : 'neutral',
    label: 'to the contract',
  }
}

function DirectionCard(props: {
  dir: Direction
  cells: readonly HourCell[]
  focus: ChartFocus<HourCell>
  phase: Phase
  empty: Empty | null
}) {
  const { dir, cells, focus, phase, empty } = props
  const f = useFormat()
  const peak = peakOf(cells, dir)
  const rate = (v: number | null): string =>
    v === null ? '—' : `${f.number(v, { maximumFractionDigits: 0 })} Mbit/s`
  const share = (v: number | null): string | null => (v === null ? null : f.percent(v / 100))
  const peakPct = peak === undefined ? null : pctOf(peak, dir)
  const restWhen = peak === undefined ? '' : `Busiest ${whenOf(peak, dir)}`

  return (
    <ChartCard
      title={DIRECTIONS[dir].title}
      subtitle="Busiest 15 min of each hour. ▲ marks the week's peak."
      phase={phase}
      empty={empty}
      figure={{
        // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n30, kept as its builder left it: its figure follows focus, built before figure-readout
        value: focus.readout(share(peakPct), (d) => share(pctOf(d, dir))),
        // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n30, kept as its builder left it: its figure follows focus, built before figure-readout
        delta: focus.readout(deltaOf(f, peakPct), (d) => deltaOf(f, pctOf(d, dir))),
        period: focus.readout(restWhen, (d) => whenOf(d, dir)),
        periodMono: true,
      }}
      footer={[
        {
          label: 'Rate',
          value: focus.readout(rate(peak === undefined ? null : mbitOf(peak, dir)), (d) =>
            rate(mbitOf(d, dir)),
          ),
          mono: true,
        },
        { label: 'Contract', value: rate(CONTRACT_MBIT[dir]), mono: true },
      ]}
      chart={() => (
        <Heatmap
          label={DIRECTIONS[dir].label}
          data={cells}
          matchHeight
          getRow={(d) => d.day}
          getCol={(d) => d.hour}
          getValue={(d) => pctOf(d, dir)}
          rows={DAYS}
          cols={HOURS}
          domain={[0, 100]}
          color={BASALT.brand}
          formatValue={(v) => f.percent(v / 100)}
          formatLegend={(v) => f.percent(v / 100)}
          getState={(d) => cellState(d, dir)}
          states={CELL_STATES}
          annotate={(d) => (d === peak ? '▲' : pctOf(d, dir) === 0 ? '0' : null)}
          legend={{ label: 'Share of the contracted rate' }}
          tooltip={false}
          focus={focus}
        />
      )}
    />
  )
}

export function ExprN30Scenario({ shotState, fixture }: ScenarioProps) {
  const load: LineLoad = useMemo(
    () => (shotState === 'empty' ? noLoad : lineLoad(fixture)),
    [shotState, fixture],
  )
  const focus = useChartFocus(load.cells, {
    announce: (d) =>
      `${d.day} ${d.hour}:00: download ${d.downPct === null ? 'not collected' : `${Math.round(d.downPct)}%`}, upload ${d.upPct === null ? 'not collected' : `${Math.round(d.upPct)}%`}`,
  })
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'Could not read the line counters.' }
        : 'ready'
  const empty: Empty | null =
    shotState === 'empty'
      ? { cause: 'The collector has not recorded a 15-minute bucket this week.' }
      : null

  return (
    <Page area="expr-n30">
      <PageBar title="Line load across the week" />
      <CardGrid min="regular">
        <DirectionCard dir="down" cells={load.cells} focus={focus} phase={phase} empty={empty} />
        <DirectionCard dir="up" cells={load.cells} focus={focus} phase={phase} empty={empty} />
      </CardGrid>
    </Page>
  )
}
