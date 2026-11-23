import type { ReactElement } from 'react'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import type { Delta, Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { RADIO_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  WEAK_BELOW,
  buildSamples,
  isFixtureName,
  summarise,
  toHours,
  weakStretches,
} from './fixture'
import type { Hour } from './fixture'

const NO_HOURS: readonly Hour[] = []
const MINUS = '−'
const dbm = (v: number): string => `${v < 0 ? MINUS : ''}${Math.abs(Math.round(v))}`

const phaseFor = (shotState: ScenarioProps['shotState']): Phase =>
  shotState === 'loading'
    ? 'loading'
    : shotState === 'error'
      ? {
          tag: 'error',
          message: 'The probe on the router did not answer.',
          retry: () => window.location.reload(),
        }
      : 'ready'

export function ExprN19Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const f = useFormat()
  const phase = phaseFor(shotState)
  const ready = phase === 'ready' && shotState !== 'empty'
  const name = isFixtureName(fixture) ? fixture : 'week'
  const samples = ready ? buildSamples(name) : []
  const hours = ready ? toHours(samples) : NO_HOURS
  const stretches = ready ? weakStretches(samples) : []
  const sum = ready ? summarise(samples, stretches) : null

  const when = (at: number): string =>
    `${f.date(at, 'weekday', { weekday: 'short' })} ${f.time(at, { hour: '2-digit', minute: '2-digit', hour12: false })}`
  const hoursOf = (minutes: number): number => Math.round((minutes / 60) * 10) / 10

  const focus = useChartFocus(hours, {
    announce: (h) =>
      `${when(h.at)}: ${
        h.signal === null
          ? 'disconnected, below the limit'
          : `${dbm(h.signal)} dBm${h.signal < WEAK_BELOW ? ', below the limit' : ''}`
      }, ${
        h.wifiRtt === null ? 'no round trip' : `${h.wifiRtt.toFixed(1)} ms`
      } against ${h.wiredRtt.toFixed(1)} ms wired`,
  })

  const empty =
    shotState === 'empty'
      ? {
          cause:
            'No Wi-Fi samples arrived in the last 7 days. Check that the probe on the router is running.',
        }
      : null
  const cardPhase = shotState === 'empty' ? 'ready' : phase
  const longest = sum?.longest ?? null
  const margin = sum?.latest.signal == null ? null : sum.latest.signal - WEAK_BELOW
  const weakShare = sum === null ? 0 : sum.weakMinutes / (7 * 24 * 60)
  const stripPhase = phase === 'ready' ? 'ready' : phase
  const emptyRtt =
    shotState === 'empty' ? { cause: 'Nothing to compare until samples arrive.' } : null
  const marginDelta = (m: number | null): Delta => ({
    value: m === null ? '—' : `${m >= 0 ? '+' : MINUS}${Math.abs(Math.round(m))} dB`,
    polarity: 'up-good',
    label: m === null ? 'disconnected' : 'to the limit',
  })
  const rttDelta = (d: number | null): Delta => ({
    value: d === null ? '—' : `${d >= 0 ? '+' : MINUS}${Math.abs(d).toFixed(1)} ms`,
    polarity: 'neutral',
    label: 'vs wired',
  })
  const peakRtt = hours.reduce((max, h) => Math.max(max, h.wifiRtt ?? 0), 0)
  const stretchZones = stretches.map((s) => ({
    axis: 'x' as const,
    from: new Date(s.from),
    to: new Date(s.to),
    fill: alpha(BASALT.bad, 0.14),
    label: `${when(s.from)}, ${s.offline ? 'offline ' : ''}${s.minutes >= 60 ? `${hoursOf(s.minutes)} h` : `${s.minutes} min`}`,
  }))

  const signalCard = (
    <ChartCard
      title="Signal over Wi-Fi"
      subtitle="Hourly low, UTC"
      phase={cardPhase}
      empty={empty}
      figure={{
        // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n19, kept as its builder left it: its figure follows focus, built before figure-readout
        value: ready
          ? focus.readout(sum?.latest.signal == null ? null : dbm(sum.latest.signal), (h) =>
              h.signal === null ? null : dbm(h.signal),
            )
          : null,
        unit: 'dBm',
        ...(margin === null
          ? {}
          : {
              delta: focus.readout(marginDelta(margin), (h) =>
                h.signal === null ? marginDelta(null) : marginDelta(h.signal - WEAK_BELOW),
              ),
            }),
        ...(ready ? { period: focus.readout('now', (h) => when(h.at)) } : {}),
      }}
      footer={[
        {
          label: 'Slowest link rate',
          value: sum?.slowestRate == null ? '—' : `${sum.slowestRate} Mbit/s`,
        },
        {
          label: 'No noise reading',
          value: sum === null ? '—' : f.percent(sum.noiseGapShare, { maximumFractionDigits: 0 }),
        },
      ]}
      chart={(box) => (
        <CartesianChart
          label="Wi-Fi signal and noise floor over 7 days"
          height={box.height}
          data={hours}
          focus={focus}
          x={{ value: (h) => new Date(h.at) }}
          y={{ title: 'dBm', domain: [-100, -30], format: dbm }}
          summary={`Signal drops below the limit in ${stretches.length} stretches.`}
          refLines={[
            {
              value: WEAK_BELOW,
              color: RADIO_SERIES.limit,
              dashed: true,
              label: `Limit ${dbm(WEAK_BELOW)}`,
            },
          ]}
          zones={stretchZones}
          series={[
            {
              mark: 'line',
              key: 'signal',
              label: 'Signal',
              color: RADIO_SERIES.signal,
              y: (h) => h.signal,
              format: (v) => `${dbm(v)} dBm`,
            },
            {
              mark: 'line',
              key: 'noise',
              label: 'Noise floor',
              color: RADIO_SERIES.noise,
              weight: 'quiet',
              y: (h) => h.noise,
              format: (v) => `${dbm(v)} dBm`,
            },
          ]}
          tooltip={{
            formatHeader: (h) => when(h.at),
            rows: (h) => [
              {
                label: 'Link rate',
                value: h.rate === null ? 'disconnected' : `${Math.round(h.rate)} Mbit/s`,
              },
            ],
          }}
        />
      )}
    />
  )

  const rttCard = (
    <ChartCard
      title="Round trip, Wi-Fi against wired"
      subtitle="Hourly median"
      phase={cardPhase}
      empty={emptyRtt}
      footer={[
        { label: 'Wi-Fi peak', value: ready ? `${Math.round(peakRtt)} ms` : '—' },
        {
          label: 'Wired median',
          value: sum === null ? '—' : `${sum.wiredMedianRtt.toFixed(1)} ms`,
        },
      ]}
      figure={{
        // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n19, kept as its builder left it: its figure follows focus, built before figure-readout
        value: ready
          ? focus.readout(sum?.wifiMedianRtt ?? null, (h) =>
              h.wifiRtt === null ? null : Math.round(h.wifiRtt * 10) / 10,
            )
          : null,
        unit: 'ms',
        ...(sum === null
          ? {}
          : {
              delta: focus.readout(rttDelta(sum.wifiMedianRtt - sum.wiredMedianRtt), (h) =>
                rttDelta(h.wifiRtt === null ? null : h.wifiRtt - h.wiredRtt),
              ),
            }),
        ...(ready ? { period: focus.readout('week median', (h) => when(h.at)) } : {}),
      }}
      chart={(box) => (
        <CartesianChart
          label="Round-trip median over Wi-Fi and over the wired link, hourly"
          height={box.height}
          data={hours}
          focus={focus}
          x={{ value: (h) => new Date(h.at) }}
          // cycle-expression-6: no way to plot Wi-Fi excess over wired; the domain is capped and the kit marks the spike
          y={{ title: 'ms', domain: ([lo, hi]) => [Math.min(lo, 0), Math.min(hi, 20)] }}
          zones={stretchZones.map(({ label: _label, ...zone }) => zone)}
          series={[
            {
              mark: 'line',
              key: 'wifi',
              label: 'Wi-Fi',
              color: RADIO_SERIES.signal,
              y: (h) => h.wifiRtt,
              format: (v) => `${v.toFixed(1)} ms`,
            },
            {
              mark: 'line',
              key: 'wired',
              label: 'Wired',
              color: RADIO_SERIES.other,
              weight: 'quiet',
              y: (h) => h.wiredRtt,
              format: (v) => `${v.toFixed(1)} ms`,
            },
          ]}
        />
      )}
    />
  )

  return (
    <Page area="expr-n19">
      <PageBar title="Backup radio path, last 7 days" />
      <StatGroup variant="strip" label="Wi-Fi failover">
        <StatCell
          label="Failover over Wi-Fi today"
          phase={stripPhase}
          value={sum === null ? null : sum.carries ? 'Carries' : 'Does not carry'}
          sub={
            sum === null
              ? '—'
              : `${f.percent(sum.todayWeakShare, { maximumFractionDigits: 0 })} of today too weak`
          }
          {...(sum === null || sum.carries
            ? {}
            : {
                status: {
                  tone: 'bad' as const,
                  label: sum.latest.connected ? 'Too weak' : 'Disconnected',
                },
              })}
        />
        <StatCell
          label="Too weak this week"
          phase={stripPhase}
          value={sum === null ? null : hoursOf(sum.weakMinutes)}
          unit="h"
          sub={
            sum === null
              ? '—'
              : longest === null
                ? 'No stretch'
                : `${sum.stretches} stretches, longest from ${when(longest.from)}`
          }
          {...(sum === null
            ? {}
            : {
                delta: {
                  value: f.percent(weakShare, { maximumFractionDigits: 0 }),
                  polarity: 'up-bad' as const,
                  label: 'of the week',
                },
              })}
        />
      </StatGroup>
      <CardGrid min="regular">
        {signalCard}
        {rttCard}
      </CardGrid>
    </Page>
  )
}
