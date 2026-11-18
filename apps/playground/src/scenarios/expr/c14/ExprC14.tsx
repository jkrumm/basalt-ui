import { useFormat } from 'basalt-ui'
import type { Delta, Phase } from 'basalt-ui/cards'
import { ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import type { LegendEntry } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import type { CSSProperties } from 'react'
import type { ScenarioProps } from '../../shot-state'
import { SUITE, fixtureRuns, leadPoints, rank } from './fixture'
import type { Run } from './fixture'

const LEGEND: readonly LegendEntry[] = [
  {
    key: 'lead',
    label: 'Passed, leader',
    color: { light: BASALT.brandFill, dark: BASALT.brandFill },
    swatch: 'bar',
  },
  {
    key: 'passed',
    label: 'Passed',
    color: { light: BASALT.inkMuted, dark: BASALT.inkMuted },
    swatch: 'bar',
  },
  {
    key: 'failed',
    label: 'Failed',
    color: { light: BASALT.line, dark: BASALT.line },
    swatch: 'bar',
  },
  {
    key: 'todo',
    label: 'Not run yet',
    color: { light: BASALT.inkFaint, dark: BASALT.inkFaint },
    swatch: 'hollow',
  },
]

const SHARE = 0.7 // the track is three of four grid columns, less the gap
const INK = 'data-[spot=inside]:text-on-brand'
const axis = chartLabels.axis({ domain: [0, SUITE], share: SHARE })

const phaseFor = (shotState: ScenarioProps['shotState']): Phase => {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') {
    return { tag: 'error', message: 'The eval harness stopped answering.', retry: () => undefined }
  }
  return 'ready'
}

const tenths = (n: number): number => Math.round(n * 1000) / 10

// cycle-expression-4: no kit part draws a two-segment bar on a 0..400 track; fills and shares ride CSS custom properties (the `as CSSProperties` casts below).
export function ExprC14Scenario({ shotState, fixture }: ScenarioProps) {
  const fmt = useFormat()
  const ranked = shotState === 'empty' ? [] : rank(fixtureRuns(fixture))
  const [leader, second] = ranked
  const rate = (r: Run): string =>
    r.rate === null
      ? '—'
      : fmt.percent(r.rate, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const points = (n: number): string =>
    `${fmt.number(n, { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' })} pts`
  const lead = leadPoints(ranked)
  const leaderRate = leader?.rate ?? null
  const finished = ranked.length > 0 && ranked.every((r) => r.done === SUITE)

  const focus = useChartFocus(ranked, {
    announce: (r) => `${r.name}: ${rate(r)} passed, ${r.done} of ${SUITE} cases done`,
  })

  const headline = (): string | null => {
    if (leader === undefined || second === undefined || lead === null) return null
    return lead === 0 ? 'Tied' : `${leader.name} leads`
  }
  const restPeriod =
    leader === undefined || second === undefined || lead === null
      ? 'no case has finished yet'
      : lead === 0
        ? `${leader.name} and ${second.name}`
        : `vs ${second.name}`
  const restDelta: Delta | undefined =
    lead === null
      ? undefined
      : { value: points(lead), polarity: lead === 0 ? 'neutral' : 'up-good' }
  const focusDelta = (r: Run): Delta | undefined => {
    if (leaderRate === null || r.rate === null || r === leader) return restDelta
    return { value: points(tenths(r.rate - leaderRate)), polarity: 'neutral' }
  }
  const fewest = ranked.reduce<Run | undefined>(
    (min, r) => (min === undefined || r.done < min.done ? r : min),
    undefined,
  )
  const allLevel = fewest !== undefined && ranked.every((r) => r.done === fewest.done)

  const shownDelta = focus.readout<Delta | undefined>(restDelta, focusDelta)
  // A failed or loading card claims no leader and no totals.
  const ready = shotState === undefined

  return (
    <Page>
      <PageBar title="Live eval, 400-case suite" />
      <div className="max-w-2xl">
        <ChartCard
          title="Pass rate by model"
          subtitle="Live, ranked by pass rate. Bars show cases done."
          phase={phaseFor(shotState)}
          empty={
            shotState === 'empty'
              ? { cause: 'No model is running this suite. Runs appear here as soon as one starts.' }
              : null
          }
          {...(ready
            ? {
                figure: {
                  value: focus.readout<string | null>(headline(), (r) => rate(r)),
                  ...(shownDelta === undefined ? {} : { delta: shownDelta }),
                  period: focus.readout(restPeriod, (r) => `${r.name}, ${r.done}/${SUITE}`),
                },
                footer: [
                  {
                    label: 'Done',
                    value: `${fmt.number(ranked.reduce((n, r) => n + r.done, 0))}/${fmt.number(SUITE * ranked.length)}`,
                  },
                  fewest === undefined || finished || allLevel
                    ? null
                    : { label: 'Fewest', value: `${fewest.name}, ${fewest.done}` },
                ] as const,
              }
            : { footer: [{ label: 'Suite', value: `${SUITE} cases per model` }] as const })}
          legend={LEGEND}
          chart={() => (
            <div className="@container flex flex-col gap-1">
              <div className="grid grid-cols-4 gap-x-2 px-2">
                <div className="text-xs text-muted-foreground">Cases done</div>
                <div className="relative col-span-3 col-start-2 h-4">
                  {axis.ticks.map((t) => (
                    <span key={t.at} {...t.label}>
                      {t.text}
                    </span>
                  ))}
                </div>
              </div>
              <div
                {...focus.target}
                aria-label="Cases passed and failed per model, out of 400"
                className="flex flex-col gap-2 px-2 @regular:gap-6"
              >
                {ranked.map((r, i) => {
                  const doneTo = axis.at(r.done)
                  const label = { key: r.name, text: rate(r), from: 0, to: doneTo }
                  const row = chartLabels.row([label], { share: SHARE, grid: axis.ticks })
                  return (
                    <div
                      key={r.name}
                      {...focus.item(i)}
                      className="grid grid-cols-4 items-center gap-x-2"
                    >
                      <div className="flex min-w-0 items-baseline justify-between gap-1 text-sm">
                        <span className="truncate">{r.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{r.done}</span>
                      </div>
                      <div
                        className="relative col-span-3 h-6 @regular:h-10 rounded-chip bg-(--part)"
                        style={{ '--part': BASALT.selected } as CSSProperties}
                      >
                        {row.lines.map((t) => (
                          <span key={t.at} {...t.line} />
                        ))}
                        <div
                          className="absolute inset-y-0 left-0 w-(--share) rounded-l-chip bg-(--part)"
                          style={
                            {
                              '--part': BASALT.line,
                              '--share': `${doneTo * 100}%`,
                            } as CSSProperties
                          }
                        />
                        <div
                          className="absolute inset-y-0 left-0 w-(--share) rounded-l-chip bg-(--part)"
                          style={
                            {
                              '--part':
                                r.rate !== null && r.rate === leaderRate
                                  ? BASALT.brandFill
                                  : BASALT.inkMuted,
                              '--share': `${axis.at(r.passed) * 100}%`,
                            } as CSSProperties
                          }
                        />
                        {row.placed.map((l) => (
                          <span
                            key={l.key}
                            {...l.props}
                            className={`${l.props.className} tabular-nums ${INK}`}
                          >
                            {l.text}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
              {focus.live}
            </div>
          )}
        />
      </div>
    </Page>
  )
}
