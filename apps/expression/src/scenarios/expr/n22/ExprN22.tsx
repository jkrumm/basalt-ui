import { text } from '@tanstack/charts/text'
import { StatCard } from 'basalt-ui/cards'
import type { Delta, Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import type { ChartFigure } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import type { Format } from 'basalt-ui'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { BASALT, alpha } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'

import { FITNESS_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { MORNINGS, buildMornings, isFixtureName } from './fixture'
import { MIN_MORNINGS, THRESHOLD_PCT, WINDOW, buildTrend, direction, signalVerdict } from './trend'
import type { Change, Direction, Signal, TrendRow, Verdict } from './trend'

const SIGNALS: Record<Signal, { name: string; unit: string; fitterWhen: 'down' | 'up' }> = {
  rhr: { name: 'Resting heart rate', unit: 'bpm', fitterWhen: 'down' },
  hrv: { name: 'HRV', unit: 'ms', fitterWhen: 'up' },
}
const VERDICT_WORD: Record<Verdict, string> = {
  improving: 'Improving',
  stable: 'Stable',
  declining: 'Declining',
}
const VERDICT_TONE = { improving: 'good', stable: 'neutral', declining: 'bad' } as const

const BAND_LABEL = `Counts as a change: ±${THRESHOLD_PCT} %`
const EMPTY_CAUSE = `No mornings logged yet. The trend starts after ${MIN_MORNINGS} mornings with the watch worn overnight.`

/** Signed with a true minus; an exact zero carries no sign. */
const signed = (f: Format, n: number): string =>
  f
    .number(n, { signDisplay: 'exceptZero', minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .replace('-', '−')

function leadText(d: Direction): string {
  if (d.leading.length === 2) return 'on both signals'
  const only = d.leading[0]
  if (only === undefined) return 'neither signal moved'
  return `on ${SIGNALS[only].name.toLowerCase().replace('hrv', 'HRV')}`
}

function headlineDelta(f: Format, d: Direction): Delta {
  const { pct } = d.headline
  return {
    value: `${signed(f, pct)}%`,
    polarity: d.verdict === 'stable' ? 'neutral' : 'up-good',
  }
}

function SignalCard({
  f,
  signal,
  change,
  logged,
  phase,
  empty,
}: {
  f: Format
  signal: Signal
  change: Change | null
  logged: string
  phase: Phase
  empty: { cause: string } | null
}): ReactElement {
  const { name, unit } = SIGNALS[signal]
  const verdict = signalVerdict(change)
  const ready = phase === 'ready' && empty === null
  return (
    <StatCard
      title={name}
      subtitle={`${logged} mornings logged`}
      phase={phase}
      empty={empty}
      value={ready && change !== null ? signed(f, change.raw) : null}
      unit={unit}
      status={
        verdict === null
          ? { tone: 'neutral', label: ready ? 'Too few mornings' : '' }
          : { tone: VERDICT_TONE[verdict], label: ready ? VERDICT_WORD[verdict] : '' }
      }
      footer={[
        change === null
          ? { label: 'Needs', value: `${MIN_MORNINGS} of ${WINDOW} mornings` }
          : {
              label: 'Counts from',
              value: `±${f.number((change.mean * THRESHOLD_PCT) / 100, { maximumFractionDigits: 1 })} ${unit}`,
            },
      ]}
    />
  )
}

export function ExprN22Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const f = useFormat()
  const mornings = buildMornings(isFixtureName(fixture) ? fixture : 'improving')
  const empty = shotState === 'empty' ? { cause: EMPTY_CAUSE } : null
  const rows = empty === null ? buildTrend(mornings) : []
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The watch sync did not answer.', retry: () => undefined }
        : 'ready'
  const ready = phase === 'ready' && empty === null
  const cardEmpty = empty === null ? null : { cause: 'Nothing to read yet.' }

  const focus = useChartFocus(rows, {
    announce: (r) => {
      const d = direction(r)
      const part = (key: Signal, c: Change | null): string =>
        c === null
          ? `${SIGNALS[key].name} too few mornings`
          : `${SIGNALS[key].name} ${signed(f, c.pct)} %`
      return `${f.date(r.date, 'short')}: ${d === null ? 'too few mornings' : VERDICT_WORD[d.verdict].toLowerCase()}, ${part('rhr', r.rhrChange)}, ${part('hrv', r.hrvChange)}, change counts past ±${THRESHOLD_PCT} %`
    },
  })

  const latest = rows.at(-1)
  const rest = latest === undefined ? null : direction(latest)
  const figure: ChartFigure | undefined = ready
    ? {
        value: focus.readout<string | null>(
          rest === null ? null : VERDICT_WORD[rest.verdict],
          (r) => {
            const d = direction(r)
            return d === null ? null : VERDICT_WORD[d.verdict]
          },
        ),
        delta: focus.readout<Delta | undefined>(
          rest === null ? undefined : headlineDelta(f, rest),
          (r) => {
            const d = direction(r)
            return d === null ? undefined : headlineDelta(f, d)
          },
        ),
        period: focus.readout<string | undefined>(
          rest === null ? undefined : leadText(rest),
          (r) => {
            const d = direction(r)
            return `${f.date(r.date, 'short')}: ${d === null ? 'too few mornings' : leadText(d)}`
          },
        ),
      }
    : phase === 'loading'
      ? { value: null }
      : undefined

  const logged = (key: Signal): string =>
    `${empty === null ? (ready ? mornings.filter((m) => m[key] !== null).length : '—') : 0} of ${MORNINGS}`
  const restChange = (key: Signal): Change | null =>
    (key === 'rhr' ? latest?.rhrChange : latest?.hrvChange) ?? null
  const followed = (key: Signal): Change | null =>
    focus.readout<Change | null>(restChange(key), (r) =>
      key === 'rhr' ? r.rhrChange : r.hrvChange,
    )

  // The label sits on the rule farther from where the two lines end, so it clears them.
  const ends = (['rhr', 'hrv'] as const).flatMap((k) => {
    const last = rows.findLast((r) => r[k] !== null)?.[k]
    return typeof last === 'number' ? [last] : []
  })
  const gap = (rule: number): number => Math.min(...ends.map((v) => Math.abs(v - rule)), 99)
  const labelRule = gap(THRESHOLD_PCT) >= gap(-THRESHOLD_PCT) ? THRESHOLD_PCT : -THRESHOLD_PCT

  const pct = (v: number): string => `${signed(f, v)} %`
  // The accent and the strong weight go to the signal that leads the verdict.
  const lead: Signal = rest?.headline.signal ?? 'rhr'
  const other: Signal = lead === 'rhr' ? 'hrv' : 'rhr'
  const colorOf = (key: Signal) => (key === lead ? FITNESS_SERIES.rhr : FITNESS_SERIES.hrv)
  const series = (key: Signal) =>
    ({
      mark: 'line',
      key,
      label: SIGNALS[key].name,
      color: colorOf(key),
      weight: key === lead ? 'strong' : 'quiet',
      ...(key === lead ? {} : { dash: true }),
      y: (r: TrendRow) => r[key],
      format: pct,
    }) as const

  return (
    <Page area="expr-n22">
      <PageBar title="Fitness direction, last 90 mornings" />
      <ChartCard
        title="Fitness trend"
        subtitle={`Each point reads the ${WINDOW} mornings behind it`}
        phase={phase}
        empty={empty}
        figure={figure}
        chart={() => (
          <CartesianChart
            label="Resting heart rate and HRV: change over 28 days, up is fitter, against the band that counts as no change"
            data={rows}
            focus={focus}
            x={{ value: (r) => r.date, ticks: 3 }}
            y={{
              title: 'Change, % (up is fitter)',
              domain: ([lo, hi]) => [
                Math.min(-2 * THRESHOLD_PCT, Math.floor(lo / THRESHOLD_PCT) * THRESHOLD_PCT),
                Math.max(2 * THRESHOLD_PCT, Math.ceil(hi / THRESHOLD_PCT) * THRESHOLD_PCT),
              ],
              format: (v) =>
                f
                  .number(v, { signDisplay: 'exceptZero', maximumFractionDigits: 0 })
                  .replace('-', '\u2212'),
            }}
            series={[series(lead), series(other)]}
            zones={[{ from: -THRESHOLD_PCT, to: THRESHOLD_PCT, fill: alpha(BASALT.ink, 0.06) }]}
            refLines={[
              {
                value: THRESHOLD_PCT,
                color: FITNESS_SERIES.limit,
                dashed: true,
                ...(labelRule === THRESHOLD_PCT ? { label: BAND_LABEL } : {}),
              },
              {
                value: -THRESHOLD_PCT,
                color: FITNESS_SERIES.limit,
                dashed: true,
                ...(labelRule === -THRESHOLD_PCT ? { label: BAND_LABEL } : {}),
              },
            ]}
            tooltip={{
              formatHeader: (r) => f.date(r.date, 'short'),
              rows: (r) =>
                (['rhr', 'hrv'] as const).flatMap((key) => {
                  const change = key === 'rhr' ? r.rhrChange : r.hrvChange
                  return change === null
                    ? []
                    : [
                        {
                          label: SIGNALS[key].name,
                          value: `${pct(change.pct)} (${signed(f, change.raw)} ${SIGNALS[key].unit})`,
                          color: colorOf(key),
                        },
                      ]
                }),
            }}
            marks={CartesianChart.custom<TrendRow>((plot) => {
              // cycle-expression-7: the kit has no value annotation on a line's end, so the headline change is placed by hand.
              if (plot.focused !== null) return []
              const key = rest?.headline.signal
              const row = key === undefined ? undefined : plot.data.findLast((r) => r[key] !== null)
              const value = key === undefined ? null : (row?.[key] ?? null)
              const px = row === undefined ? null : plot.x(row.date)
              if (row === undefined || value === null || px === null) return []
              const y = plot.y(value)
              const note = { date: row.date, value, label: `${signed(f, value)} %` }
              const { placed } = chartLabels.place(
                [{ key: 'headline', text: note.label, x: px, y }],
                { width: plot.plotWidth, height: plot.plotHeight },
                { obstacles: [], gap: BASALT.dotR + 6 },
              )
              return [
                text(placed, {
                  x: () => note.date,
                  y: () => note.value,
                  text: (l) => l.text,
                  dx: (l) => l.dx,
                  dy: (l) => l.dy,
                  anchor: (l) => l.textAnchor,
                  fill: BASALT.ink,
                  fontSize: BASALT.text.micro,
                }),
              ]
            })}
          />
        )}
      />
      <CardGrid min="regular">
        <SignalCard
          f={f}
          signal="rhr"
          change={followed('rhr')}
          logged={logged('rhr')}
          phase={phase}
          empty={cardEmpty}
        />
        <SignalCard
          f={f}
          signal="hrv"
          change={followed('hrv')}
          logged={logged('hrv')}
          phase={phase}
          empty={cardEmpty}
        />
      </CardGrid>
    </Page>
  )
}
