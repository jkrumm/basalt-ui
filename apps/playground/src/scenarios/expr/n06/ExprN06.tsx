/**
 * n06 — quota window. Who: a user on a usage-capped plan. Question: will the quota run out before
 * the window resets, and when? Form: cumulative use as a line against the cap, a dashed projection
 * at the window's average pace from now, and the answer (the run-out time, or the margin at reset)
 * as the card's headline figure. `?fixture=runout|safe|exhausted|zero` picks the data (default
 * `runout`).
 */
import { useRouterState } from '@tanstack/react-router'
import { Stack } from '@mantine/core'
import { createFormat } from 'basalt-ui'
import { ChartCard, Lines, useChartFocus } from 'basalt-ui/charts'
import type { ChartFact, ChartSeries, XRefLine } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { demoColors } from '../../../demo/series'
import { chartStateFor, noop, retryCopy } from '../../shot-state'
import type { ScenarioProps } from '../../shot-state'
import { NOW, RESET, WINDOW_START, isFixtureName, samplesFor } from './fixture'
import type { FixtureName, Sample } from './fixture'

const MIN = 60_000
const CAP = 100
const fmt = createFormat({ timeZone: 'UTC' })
const clock = (d: Date): string =>
  fmt.time(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const pct = (v: number): string => `${Math.round(v * 10) / 10}%`
const span = (ms: number): string => {
  const m = Math.round(ms / MIN)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`
}

type Row = { at: Date; used: number | null; proj: number | null }
type Verdict =
  | { kind: 'runout'; hitAt: Date }
  | { kind: 'exhausted'; hitAt: Date }
  | { kind: 'safe'; atReset: number }

/** The window's average pace, carried to the reset: where the line meets the cap, or what is left. */
function verdictFor(samples: readonly Sample[]): Verdict {
  const last = samples[samples.length - 1]
  const first = samples.find((s) => s.used >= CAP)
  if (first !== undefined) return { kind: 'exhausted', hitAt: first.at }
  const used = last?.used ?? 0
  const rate = used / (NOW.getTime() - WINDOW_START.getTime())
  const atReset = used + rate * (RESET.getTime() - NOW.getTime())
  if (atReset < CAP) return { kind: 'safe', atReset }
  const hitAt = new Date(NOW.getTime() + Math.round((CAP - used) / rate / MIN) * MIN)
  return { kind: 'runout', hitAt }
}

function rowsFor(samples: readonly Sample[], verdict: Verdict): Row[] {
  const rows: Row[] = samples.map((s) => ({ at: s.at, used: s.used, proj: null }))
  const last = rows[rows.length - 1]
  if (last === undefined || verdict.kind === 'exhausted') return rows
  last.proj = last.used
  if (verdict.kind === 'runout') rows.push({ at: verdict.hitAt, used: null, proj: CAP })
  else rows.push({ at: RESET, used: null, proj: verdict.atReset })
  return rows
}

const HOURS = [0, 1, 2, 3, 4, 5].map((h) => new Date(WINDOW_START.getTime() + h * 60 * MIN))
const Y_TICKS = [0, 25, 50, 75, 100]

function headline(verdict: Verdict, used: number): ChartFact & { rest: string } {
  const untilReset = span(RESET.getTime() - NOW.getTime())
  if (verdict.kind === 'exhausted') {
    return {
      value: 'Used up',
      comparison: `since ${clock(verdict.hitAt)}`,
      tone: 'bad',
      period: `back in ${untilReset}, at ${clock(RESET)}`,
      rest: `back in ${untilReset}, at ${clock(RESET)}`,
    }
  }
  if (verdict.kind === 'runout') {
    const rest = `at the window's pace, ${pct(used)} used now`
    return {
      value: clock(verdict.hitAt),
      comparison: `${span(RESET.getTime() - verdict.hitAt.getTime())} before the ${clock(RESET)} reset`,
      tone: 'bad',
      period: rest,
      rest,
    }
  }
  const rest = `projected at the ${clock(RESET)} reset, ${pct(used)} used now`
  return {
    value: pct(verdict.atReset),
    comparison: `${pct(CAP - verdict.atReset)} to spare`,
    tone: 'good',
    period: rest,
    rest,
  }
}

const verdictWord = (v: Verdict): string =>
  v.kind === 'runout'
    ? `Runs out at ${clock(v.hitAt)}, before the reset`
    : v.kind === 'exhausted'
      ? `Used up since ${clock(v.hitAt)}`
      : 'Lasts to the reset'

function QuotaChart({ shotState, fixture }: ScenarioProps & { fixture: FixtureName }) {
  const samples = samplesFor(fixture)
  const verdict = verdictFor(samples)
  const rows = rowsFor(samples, verdict)
  const used = samples[samples.length - 1]?.used ?? 0
  const head = headline(verdict, used)
  const hot = verdict.kind !== 'safe'
  const projColor = hot ? VX.status.bad : demoColors.sessions

  const focus = useChartFocus(rows, {
    announce: (d) =>
      d.used === null
        ? `${clock(d.at)}: projected ${pct(d.proj ?? 0)} of the quota`
        : `${clock(d.at)}: ${pct(d.used)} of the quota used`,
  })

  const series: ChartSeries<Row>[] = [
    {
      key: 'used',
      label: 'Used',
      color: demoColors.sessions,
      getValue: (d) => d.used,
      formatValue: pct,
      area: true,
      // The marker is the "now" dot; the kit has no marker for a reading date.
      getMarker: (d) => (d.at.getTime() === NOW.getTime() ? { r: 4 } : null),
    },
  ]
  if (verdict.kind !== 'exhausted') {
    series.push({
      key: 'proj',
      label: 'Projected',
      color: projColor,
      dash: 'dashed',
      getValue: (d) => d.proj,
      formatValue: pct,
      // At now the projection joins the actual line; the tooltip lists it for later rows only.
      tooltip: false,
      getMarker: (d) => (d.used === null && d.proj === CAP ? { r: 4 } : null),
    })
  }

  const xRefLines: XRefLine<Date>[] = [{ x: NOW, color: VX.faint, dashed: true, label: 'Now' }]
  if (verdict.kind === 'runout') {
    xRefLines.push({ x: verdict.hitAt, color: VX.status.bad, dashed: true, label: 'Out' })
  }

  const state = chartStateFor(shotState, {
    empty: 'No usage reported for this window yet. Check that the plan usage feed is connected.',
    error: retryCopy('usage feed'),
  })

  return (
    <ChartCard
      title="Quota this window"
      subtitle={`${clock(WINDOW_START)}–${clock(RESET)} UTC · now ${clock(NOW)}`}
      info="Cumulative use as a share of the cap. The dashed line carries the window's average pace from now to the reset."
      facts={{
        value: head.value,
        comparison: head.comparison,
        tone: head.tone,
        period: focus.readout(head.rest, (d) =>
          d.used === null
            ? `${clock(d.at)} · projected ${pct(d.proj ?? 0)}`
            : `${clock(d.at)} · ${pct(d.used)} used`,
        ),
      }}
      state={state}
      onRetry={shotState === 'error' ? noop : undefined}
      stateNoun="quota usage"
    >
      <Lines<Row, Date>
        ariaLabel={`Cumulative quota use over the ${clock(WINDOW_START)} to ${clock(RESET)} window, ${pct(used)} now. ${verdictWord(verdict)}.`}
        data={rows}
        x={(d) => d.at}
        xDomain={[WINDOW_START, RESET]}
        xTicks={HOURS}
        formatX={(x) => clock(x)}
        series={series}
        y={{ domain: [0, 110], ticks: Y_TICKS, format: (v) => `${v}%` }}
        refLines={[{ value: CAP, color: VX.faint, dashed: true, label: 'Cap' }]}
        xRefLines={xRefLines}
        focus={focus}
        naming="legend"
        tooltip={{
          rows: (d) =>
            d.used === null && d.proj !== null
              ? [
                  {
                    label: 'Projected',
                    value: pct(d.proj),
                    color: projColor,
                    swatch: 'dashed' as const,
                  },
                ]
              : [],
        }}
      />
    </ChartCard>
  )
}

export function ExprN06Scenario({ shotState }: ScenarioProps) {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr })
  const raw = new URLSearchParams(searchStr).get('fixture')
  const fixture: FixtureName = isFixtureName(raw) ? raw : 'runout'
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <QuotaChart shotState={shotState} fixture={fixture} />
    </Stack>
  )
}
