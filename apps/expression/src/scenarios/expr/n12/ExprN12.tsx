import { StatCell, StatGroup } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { ChartFigure } from 'basalt-ui/charts'
import { createFormat } from 'basalt-ui'
import { Page, PageBar, QueryState } from 'basalt-ui/page'
import type { ComponentProps } from 'react'
import { PAGE_FORMAT } from '../../../demo/page-format'
import { SLEEP_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { NEED_MIN, SHORT_RATIO, STAGES, buildNights, shortStages, usualOf } from './fixture'
import type { Night, Stage } from './fixture'

type Phase = ComponentProps<typeof QueryState>['phase']

const LABEL: Record<Stage, string> = { deep: 'Deep', light: 'Light', rem: 'REM', awake: 'Awake' }
const FMT = createFormat(PAGE_FORMAT)
const HM = (min: number) =>
  `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, '0')}m`
const DAY = (d: Date) => FMT.date(d, 'short')
const CLOCK = (d: Date) => FMT.time(d, { hour: '2-digit', minute: '2-digit' })

const EMPTY = {
  cause: 'No nights logged yet. Wear your tracker tonight and the first night appears tomorrow.',
}

function signed(minutes: number): string {
  if (minutes === 0) return '0 min'
  return `${minutes > 0 ? '+' : '−'}${Math.abs(minutes)} min`
}

const missingStage = (n: Night) => STAGES.find((s) => n[s] === null)

/** The hero for one night: its total against the need, or what is missing. */
function figureOf(n: Night): ChartFigure {
  const missing = missingStage(n)
  const period = n.last ? 'last night' : DAY(n.date)
  if (n.asleep === null || missing !== undefined) {
    return {
      value: HM(n.partial),
      period,
      status: { tone: 'warn', label: `${LABEL[missing ?? 'rem']} missing` },
    }
  }
  const gap = n.asleep - NEED_MIN
  return {
    value: HM(n.asleep),
    period,
    delta: { value: signed(gap), polarity: 'up-good', label: `vs ${HM(NEED_MIN)} need` },
  }
}

export function ExprN12Scenario({ shotState, fixture }: ScenarioProps) {
  const nights = buildNights(fixture)
  const last = nights[nights.length - 1]!
  const usualAsleep = usualOf(nights, (n) => n.asleep)

  const focus = useChartFocus(nights, {
    announce: (n) => {
      const total = n.asleep === null ? 'incomplete night' : `${HM(n.asleep)} asleep`
      const short = shortStages(n, nights)[0]
      const usual = short === undefined ? null : usualOf(nights, (m) => m[short])
      const gap = short === undefined || usual === null ? '' : `, ${LABEL[short]} short of usual`
      return `${DAY(n.date)}: ${total}${gap}`
    },
  })
  // The strip follows the focused night and returns to last night when focus leaves.
  const shown = focus.datum ?? last
  const shorts = shortStages(shown, nights)

  const loading = shotState === 'loading'
  const frame: Phase = loading ? 'loading' : 'ready'
  const gate: Phase =
    shotState === 'error'
      ? {
          tag: 'error',
          message: 'Your tracker has not synced.',
          // cycle-expression-3: a static scenario has no query, so Retry reloads the page without the shot state
          retry: () => window.location.assign(window.location.pathname),
        }
      : 'ready'

  return (
    <Page>
      <PageBar title="Sleep, last night" />
      <QueryState phase={gate} empty={shotState === 'empty' ? EMPTY : null}>
        <div className="grid min-w-0 items-start gap-4 @wide:grid-cols-[3fr_2fr]">
          <ChartCard
            title="Time asleep, last 30 nights"
            subtitle={`30 nights to ${DAY(last.date)}`}
            phase={frame}
            figure={focus.readout(figureOf(last), figureOf)}
            footer={
              loading
                ? [
                    { label: 'Usual night', value: '\u2014' },
                    { label: 'In bed', value: '\u2014' },
                  ]
                : [
                    usualAsleep === null ? null : { label: 'Usual night', value: HM(usualAsleep) },
                    {
                      label: 'In bed',
                      value: focus.readout(
                        `${CLOCK(last.bed)} to ${CLOCK(last.wake)}`,
                        (n) => `${CLOCK(n.bed)} to ${CLOCK(n.wake)}`,
                      ),
                    },
                  ]
            }
            chart={() => (
              <Bars
                ariaLabel="Minutes asleep per night over 30 nights, stacked by deep, light and REM, against the 7 hour need"
                data={nights}
                focus={focus}
                x={{ value: (n) => n.date }}
                y={{ title: 'Minutes asleep' }}
                // cycle-expression-3: the label sits at the right end and overlaps an extreme last bar
                refLines={[
                  { value: NEED_MIN, color: SLEEP_SERIES.need, dashed: true, label: 'Need 7h' },
                ]}
                tooltip={{
                  formatHeader: (n) =>
                    `${DAY(n.date)} · ${n.asleep === null ? 'incomplete' : HM(n.asleep)}`,
                }}
                series={(['deep', 'light', 'rem'] as const).map((s) => ({
                  mark: 'bar' as const,
                  key: s,
                  label: LABEL[s],
                  color: SLEEP_SERIES[s],
                  y: (n: Night) => n[s],
                  // cycle-expression-3: no hatch or outline for a partial stack, so an incomplete night is faded
                  opacity: (n: Night) =>
                    n.asleep === null
                      ? 0.3
                      : focus.datum === null
                        ? n.last
                          ? 1
                          : 0.7
                        : focus.datum === n
                          ? 1
                          : 0.4,
                }))}
              />
            )}
          />
          <StatGroup variant="strip" label="Stages of the night shown in the chart">
            {STAGES.map((s) => {
              const value = shown[s]
              const usual = usualOf(nights, (n) => n[s])
              const diff = value === null || usual === null ? null : value - usual
              // A delta only takes a polarity once it leaves the normal spread.
              const outside =
                value !== null &&
                usual !== null &&
                (s === 'awake' ? value > usual / SHORT_RATIO : value < usual * SHORT_RATIO)
              return (
                <StatCell
                  key={s}
                  label={LABEL[s]}
                  phase={frame}
                  value={value}
                  unit="min"
                  {...(diff === null || usual === null
                    ? {}
                    : {
                        delta: {
                          value: signed(diff),
                          polarity: outside ? (s === 'awake' ? 'up-bad' : 'up-good') : 'neutral',
                          label: `vs ${usual}`,
                        } as const,
                      })}
                  {...(s === shorts[0]
                    ? { status: { tone: 'warn', label: 'Furthest short' } as const }
                    : shorts.includes(s)
                      ? { status: { tone: 'warn', label: 'Short' } as const }
                      : {})}
                />
              )
            })}
          </StatGroup>
        </div>
      </QueryState>
    </Page>
  )
}
