import { useMemo } from 'react'
import type { ReactElement } from 'react'
import { ChartCard, Heatmap, useChartFocus } from 'basalt-ui/charts'
import type { ChartFigure, HeatmapState, LegendEntry } from 'basalt-ui/charts'
import type { Phase } from 'basalt-ui/cards'
import { createFormat } from 'basalt-ui'
import { BASALT } from 'basalt-ui/tokens'
import { Page, PageBar } from 'basalt-ui/page'
import type { ScenarioProps } from '../../shot-state'
import {
  EASY_SHARE,
  LOADS,
  MIN_DAYS,
  RECOVERIES,
  TRAIN_SHARE,
  VERDICTS,
  buildPlan,
  type Pairing,
  type Verdict,
} from './fixture'

const WORD: Record<Verdict, string> = {
  train: 'Train',
  easy: 'Go easy',
  rest: 'Rest',
  thin: 'Too few days',
}

type Tone = NonNullable<ChartFigure['status']>['tone']

const TONE = { train: 'good', easy: 'accent', rest: 'warn', thin: 'neutral' } satisfies Record<
  Verdict,
  Tone
>

const percent = (share: number): string => `${Math.round(share * 100)}%`

/** Past-day counts print with a thousands separator, so a three-digit extreme still reads at a glance. */
const format = createFormat()
const count = (n: number): string => format.number(n)

const FILL: Record<Verdict, string> = {
  train: BASALT.good,
  easy: BASALT.brand,
  rest: BASALT.warn,
  thin: BASALT.inkFaint,
}

const STATES: readonly HeatmapState<Verdict>[] = VERDICTS.map((key) => ({
  key,
  label: WORD[key],
  color: FILL[key],
  glyph: '',
}))

/** The line each verdict sits on, shared by the legend and the status line. */
const LINE: Record<Verdict, string> = {
  train: `${percent(TRAIN_SHARE)} or more`,
  easy: `${percent(EASY_SHARE)} to under ${percent(TRAIN_SHARE)}`,
  rest: `under ${percent(EASY_SHARE)}`,
  thin: `under ${MIN_DAYS} days`,
}

const LEGEND: readonly LegendEntry[] = VERDICTS.map((key) => ({
  key,
  label: key === 'thin' ? `${WORD[key]}: ${LINE[key]}` : `${WORD[key]}: ${LINE[key]} strong`,
  swatch: 'bar',
  // cycle-expression-6: a ChartCard legend entry takes a light/dark pair, not a token ref; the same ref twice
  color: { light: FILL[key], dark: FILL[key] },
}))

const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1)

const pairingName = (p: Pairing): string => `${capital(p.recovery)} recovery, ${p.load} load`

function cellText(p: Pairing, isToday: boolean): string {
  if (isToday) return p.verdict === 'thin' ? `Today: ${p.days} d` : `Today: ${WORD[p.verdict]}`
  return p.verdict === 'thin' ? `${p.days} d` : `${WORD[p.verdict]} · ${count(p.days)} d`
}

function lastSeen(p: Pairing): string {
  if (p.lastSeen === null) return 'Never'
  if (p.lastSeen === 0) return 'Today'
  return p.lastSeen === 1 ? 'Yesterday' : `${p.lastSeen} days ago`
}

function figureOf(p: Pairing, isToday: boolean) {
  const share = p.days === 0 ? null : p.strong / p.days
  return {
    value: WORD[p.verdict],
    period: isToday ? `Today: ${pairingName(p).toLowerCase()}` : pairingName(p),
    status: {
      tone: TONE[p.verdict],
      label: share === null ? 'No past days' : `${percent(share)} strong, ${LINE[p.verdict]}`,
    },
  }
}

export function ExprN08Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const plan = useMemo(() => buildPlan(fixture), [fixture])
  const today = plan.pairings.find(
    (p) => p.recovery === plan.today.recovery && p.load === plan.today.load,
  )
  const focus = useChartFocus(plan.pairings, {
    columns: LOADS.length,
    announce: (p) =>
      `${pairingName(p)}: ${WORD[p.verdict]}, ${count(p.days)} past ${p.days === 1 ? 'day' : 'days'}`,
  })

  const phase: Phase | undefined =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The training log did not answer.', retry: () => undefined }
        : undefined
  const empty =
    shotState === 'empty'
      ? { cause: 'No training days logged yet. Log a session and the grid fills in.' }
      : undefined
  const ready = phase === undefined && empty === undefined && today !== undefined

  const figure = ready
    ? {
        value: focus.readout(figureOf(today, true).value, (p) => figureOf(p, p === today).value),
        period: focus.readout(figureOf(today, true).period, (p) => figureOf(p, p === today).period),
        status: focus.readout(figureOf(today, true).status, (p) => figureOf(p, p === today).status),
      }
    : shotState === 'loading'
      ? { value: null }
      : undefined

  return (
    <Page area="expr-n08">
      <PageBar title="Should I train today?" />
      <ChartCard
        title="Verdict by recovery and planned load"
        legend={LEGEND}
        phase={phase ?? 'ready'}
        empty={empty}
        {...(figure !== undefined && { figure })}
        footer={
          ready
            ? [
                {
                  label: 'Past days',
                  value: focus.readout(count(today.days), (p) => count(p.days)),
                },
                { label: 'Last seen', value: focus.readout(lastSeen(today), lastSeen) },
              ]
            : [
                { label: 'Past days', value: '–' },
                { label: 'Last seen', value: '–' },
              ]
        }
        height="auto"
        chart={() => (
          <Heatmap
            label="Verdict for each pairing of recovery and planned load, with the past days behind it"
            data={plan.pairings}
            rows={RECOVERIES}
            cols={LOADS}
            getRow={(p) => p.recovery}
            getCol={(p) => p.load}
            getValue={(p) => p.days}
            getState={(p) => p.verdict}
            states={STATES}
            formatRow={(r) => `${capital(r)} recovery`}
            formatCol={capital}
            tooltip={false}
            legend={false}
            annotate={(p) => cellText(p, p === today)}
            focus={focus}
            matchHeight
          />
        )}
      />
    </Page>
  )
}
