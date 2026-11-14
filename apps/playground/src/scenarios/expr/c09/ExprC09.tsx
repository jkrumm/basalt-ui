/**
 * c09 — release quality across deployed versions.
 *
 *   Question: Which version hurt quality, and what is live now?
 *   Decision: Hold or roll back the live version, or ship the fix.
 *
 * One line (request success rate, six-hourly) over the whole window. A lane above the plot names
 * every version at its deploy (the rolled-back and live ones add their status word); the rolled-back
 * span is a red band, the live one an accent wash, the trough carries a dot and its value. The
 * card's two figures answer at rest (live now; the version that hurt); focusing a sample swaps them
 * for that sample and its version, always two facts so the card never changes height. The deploy
 * log under the chart is the same versions with their mean and low, newest first.
 *
 * `?fixture=outage` pins one sample of the rolled-back version to 0.
 */
import { Box, Stack } from '@mantine/core'
import { dot } from '@tanstack/charts/dot'
import { lineY } from '@tanstack/charts/line'
import { text } from '@tanstack/charts/text'
import { useLocation } from '@tanstack/react-router'
import type { KeyboardEvent } from 'react'
import { DeltaBadge, EventList, Section, StatusDot, StatusVerdict } from 'basalt-ui'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { ChartFact, ChartSeries, ChartTooltipRow } from 'basalt-ui/charts'
import { VX, alpha } from 'basalt-ui/tokens'
import { demoColors } from '../../../demo/series'
import { monthName } from '../../fixture-utils'
import { chartStateFor, noop, queryFor, retryCopy } from '../../shot-state'
import type { ScenarioProps } from '../../shot-state'
import { NOW, TARGET, VERSIONS, buildSamples, isFixtureName, statsFor } from './fixture'
import type { FixtureName, Sample, Version, VersionStatus } from './fixture'

const STATUS_WORD: Readonly<Record<VersionStatus, string>> = {
  superseded: 'superseded',
  'rolled-back': 'rolled back',
  live: 'live',
}

/** Only the attention-worthy version takes a status hue; live is the accent, the rest neutral. */
const TONE: Readonly<Record<VersionStatus, string>> = {
  superseded: VX.faint,
  'rolled-back': VX.status.bad,
  live: VX.accent,
}
/** Band strength at rest, and while a sample of that version is focused. */
const BAND: Readonly<Record<VersionStatus, readonly [number, number]>> = {
  superseded: [0, 0.08],
  'rolled-back': [0.14, 0.22],
  live: [0.08, 0.16],
}
const BAND_FADED = 0.04

const pct = (v: number): string => `${v.toFixed(1)} %`
/** A fixed UTC table, not ICU: the labels are pinned in screenshots. */
const when = (at: Date | number): string => {
  const d = new Date(at)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  return `${d.getUTCDate()} ${monthName(d, 'short')}, ${hh}:00 UTC`
}

const SERIES: ChartSeries<Sample>[] = [
  {
    key: 'rate',
    label: 'Success rate',
    color: demoColors.sessions,
    getValue: (s) => s.rate,
    formatValue: pct,
  },
]

/** Bands: the two verdict versions at rest; focus strengthens its own version and fades the rest. */
function zonesFor(focused: Version | null) {
  return VERSIONS.flatMap((v) => {
    const [rest, on] = BAND[v.status]
    const strength = focused === null ? rest : v === focused ? on : Math.min(rest, BAND_FADED)
    if (strength === 0) return []
    return [
      {
        from: new Date(v.deployedAt),
        ...(v.endedAt !== null && { to: new Date(v.endedAt) }),
        fill: alpha(TONE[v.status], strength),
        ...(v.status === 'rolled-back' && {
          edge: { side: 'both' as const, color: VX.badRef, dashed: true },
        }),
      },
    ]
  })
}
const X_RULES = VERSIONS.map((v) => ({ x: new Date(v.deployedAt), color: VX.faint, dashed: true }))
/** Exact x ticks, so a phone keeps several (the default thins to one). */
const X_TICKS = [2, 5, 8, 11, 14].map((d) => new Date(Date.UTC(2026, 10, d)))

const tooltipRows = (s: Sample): ChartTooltipRow[] => [
  { label: 'Version', value: `${s.version.name}, ${STATUS_WORD[s.version.status]}` },
]

/** Headroom above 100 % for the version lane: the rate never reaches it. */
const LANE = 0.22
const floorOf = (data: readonly Sample[]): number =>
  Math.max(0, Math.floor(Math.min(...data.map((s) => s.rate)) - 1))
/** The domain hugs the data (a flat 98 % line on 0..100 says nothing) but reaches a zero sample. */
const yDomain = (data: readonly Sample[]): readonly [number, number] => {
  const floor = floorOf(data)
  return [floor, 100 + LANE * (100 - floor)]
}
/** Ticks stop at 100 so the lane above carries no axis numbers. */
function yTicks(data: readonly Sample[]): number[] {
  const floor = floorOf(data)
  const step = 100 - floor > 40 ? 25 : 100 - floor > 16 ? 5 : 2
  const ticks: number[] = []
  for (let t = Math.ceil(floor / step) * step; t <= 100; t += step) ticks.push(t)
  return ticks
}

function useFixtureName(): FixtureName | undefined {
  // cycle-expression-2: the route's validateSearch drops unknown keys, so read the raw location
  const { search } = useLocation()
  const value: unknown =
    search !== null && typeof search === 'object' ? Reflect.get(search, 'fixture') : undefined
  return isFixtureName(value) ? value : undefined
}

function eventsFor(samples: readonly Sample[]) {
  const stats = statsFor(samples)
  return VERSIONS.flatMap((v) => {
    const stat = stats.find((s) => s.version === v)
    const deploy = {
      id: `deploy-${v.name}`,
      at: v.deployedAt,
      title: `${v.name} deployed`,
      body: stat === undefined ? '' : `Mean ${pct(stat.mean)}, low ${pct(stat.low)}`,
      ...(v.status === 'live' && {
        chips: <StatusVerdict color={VX.accent} word="Live" phrase="Live now" />,
      }),
      ...(v.status === 'rolled-back' && {
        chips: <StatusVerdict color={VX.badSolid} word="Rolled back" />,
      }),
    }
    if (v.status !== 'rolled-back' || v.endedAt === null) return [deploy]
    return [
      deploy,
      {
        id: `rollback-${v.name}`,
        at: v.endedAt,
        title: `${v.name} rolled back`,
        body: `Success rate fell to ${pct(stat?.low ?? 0)} under it`,
      },
    ]
  }).toSorted((a, b) => Number(b.at) - Number(a.at))
}

/** Where PageUp / PageDown land on a version: its lowest sample, so the dip is one key away. */
const lowestIndex = (samples: readonly Sample[], v: Version): number =>
  samples.reduce(
    (best, s, i) => (s.version === v && s.rate < (samples[best]?.rate ?? Infinity) ? i : best),
    samples.findIndex((s) => s.version === v),
  )

/** The tone swatch ties a figure to its band colour; the word beside it carries the meaning. */
function Swatch({ tone, children }: { tone: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot color={tone} />
      {children}
    </span>
  )
}

const vsTarget = (value: number, basis: string) => (
  <DeltaBadge
    value={value}
    format={(v) => `${Math.abs(v).toFixed(1)} pts`}
    period={`${TARGET} % target${basis}`}
  />
)

type LaneLabel = { at: Date; dy: number; word: string; fill: string }

/** Version names in a lane above the plot (no `v`, so a 40 px phone span holds "2.10.0"). */
const LANE_LABELS: readonly LaneLabel[] = VERSIONS.flatMap((v) => [
  { at: new Date(v.deployedAt), dy: -17, word: v.name.slice(1), fill: VX.ink2 },
  ...(v.status === 'superseded'
    ? []
    : [
        {
          at: new Date(v.deployedAt),
          dy: -6,
          word: STATUS_WORD[v.status],
          fill: v.status === 'rolled-back' ? VX.bad : VX.accent,
        },
      ]),
])

function QualityCard({ shotState, samples }: ScenarioProps & { samples: readonly Sample[] }) {
  const stats = statsFor(samples)
  const live = stats.find((s) => s.version.status === 'live')
  const worst = stats
    .filter((s) => s.samples > 0)
    .reduce<(typeof stats)[number] | undefined>(
      (a, b) => (a === undefined || b.mean < a.mean ? b : a),
      undefined,
    )
  const trough = worst === undefined ? undefined : samples[lowestIndex(samples, worst.version)]
  const focus = useChartFocus(samples, {
    announce: (s) =>
      `${when(s.at)}: ${pct(s.rate)} success, ${s.version.name} ${STATUS_WORD[s.version.status]}`,
  })

  const MEAN = ', mean'
  const versionFact = (st: (typeof stats)[number], period: string): ChartFact => ({
    value: <Swatch tone={TONE[st.version.status]}>{st.version.name}</Swatch>,
    unit: STATUS_WORD[st.version.status],
    comparison: vsTarget(st.mean - TARGET, MEAN),
    period,
  })
  const rest: ChartFact[] = [
    ...(live === undefined ? [] : [versionFact(live, `since ${when(live.version.deployedAt)}`)]),
    ...(worst === undefined
      ? []
      : [versionFact(worst, `mean ${pct(worst.mean)}, low ${pct(worst.low)}`)]),
  ]
  // Always two facts, so the strip keeps its height when a sample is focused or released.
  const facts = focus.readout<readonly ChartFact[]>(rest, (s) => {
    const own = stats.find((st) => st.version === s.version)
    return [
      {
        value: <Swatch tone={TONE[s.version.status]}>{pct(s.rate)}</Swatch>,
        comparison: vsTarget(s.rate - TARGET, ''),
        period: when(s.at),
      },
      ...(own === undefined
        ? []
        : [versionFact(own, `mean ${pct(own.mean)}, low ${pct(own.low)}`)]),
    ]
  })

  // cycle-expression-2: no key to step a chart's focus by group, so PageUp/PageDown step by version
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const step = e.key === 'PageDown' ? 1 : e.key === 'PageUp' ? -1 : 0
    const at = focus.datum === null ? -1 : VERSIONS.indexOf(focus.datum.version)
    const target = VERSIONS[Math.min(VERSIONS.length - 1, Math.max(0, at + step))]
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? samples.length - 1
          : step !== 0 && target !== undefined
            ? lowestIndex(samples, target)
            : null
    if (next === null) return
    e.preventDefault()
    focus.set(next)
  }

  return (
    <Box data-shot="release-quality" h="100%">
      <ChartCard
        className="tabular-nums"
        title="Quality by version"
        subtitle="Request success rate, sampled every 6 hours, 1 to 14 Nov"
        ghost="line"
        {...(facts.length > 0 && { facts })}
        info="Share of requests that succeeded in each 6-hour window. A rule marks each deploy; the band behind a version is red if it was rolled back and blue while it is live. Keyboard: arrows step samples, PageUp and PageDown step versions to their lowest sample, Home and End jump to the ends."
        state={chartStateFor(shotState, {
          empty:
            'No deploys in this window. Widen the date range, or ship a version to start tracking its quality.',
          error: retryCopy('metrics store'),
        })}
        {...(shotState === 'error' && { onRetry: noop })}
      >
        <Box data-shot-hover data-shot-tooltip onKeyDown={onKeyDown}>
          <CartesianChart<Sample, Date>
            data={samples}
            ariaLabel={`Request success rate per 6 hours across five versions; ${worst?.version.name ?? 'none'} ${worst === undefined ? '' : STATUS_WORD[worst.version.status]}, ${live?.version.name ?? 'none'} live`}
            x={(s) => s.at}
            xTicks={X_TICKS}
            y={{
              title: 'Success rate (%)',
              domain: yDomain,
              ticks: yTicks(samples),
              format: (v) => String(v),
            }}
            series={SERIES}
            xZones={zonesFor(focus.datum?.version ?? null)}
            xRefLines={X_RULES}
            refLines={[
              {
                value: TARGET,
                color: VX.muted,
                label: `Target ${TARGET} %`,
                labelPosition: 'start-below',
              },
            ]}
            tooltip={{ rows: tooltipRows }}
            legend={false}
            focus={focus}
            marks={(plot) => [
              lineY(plot.rows('rate'), {
                id: 'rate',
                x: 'x',
                y: 'y',
                stroke: demoColors.sessions,
                strokeWidth: VX.lineWidth,
              }),
              text(LANE_LABELS, {
                id: 'lane',
                x: (l) => l.at,
                y: () => 100,
                text: (l) => l.word,
                fill: (l) => l.fill,
                anchor: 'start',
                dx: 3,
                dy: (l) => l.dy,
                fontSize: VX.text.micro,
              }),
              ...(trough === undefined
                ? []
                : [
                    dot([trough], {
                      id: 'trough',
                      x: (s) => s.at,
                      y: (s) => s.rate,
                      r: VX.dotR,
                      fill: VX.bad,
                    }),
                    text([trough], {
                      id: 'trough-value',
                      x: (s) => s.at,
                      y: (s) => s.rate,
                      text: (s) => pct(s.rate),
                      fill: VX.bad,
                      anchor: 'end',
                      dx: -8,
                      dy: -6,
                      fontSize: VX.text.micro,
                    }),
                  ]),
            ]}
          />
        </Box>
      </ChartCard>
    </Box>
  )
}

function DeployLog({ shotState, samples }: ScenarioProps & { samples: readonly Sample[] }) {
  const query = queryFor(shotState, retryCopy('deploy log'))
  return (
    <Box data-shot="deploy-log">
      <Section
        title="Deploys"
        {...(query !== undefined && { query })}
        empty={{
          title: 'No deploys yet',
          description:
            'Each version that ships lists here. Ship one, or widen the window, to see it.',
        }}
        loadingHeight={340}
      >
        <EventList
          label="Deploys and rollbacks, newest first"
          items={eventsFor(samples)}
          density="timeline"
          group="none"
          now={NOW}
          time={when}
          loadingRows={6}
        />
      </Section>
    </Box>
  )
}

export function ExprC09Scenario({ shotState }: ScenarioProps) {
  const fixture = useFixtureName()
  const samples = buildSamples(fixture)
  return (
    <Stack gap="sm" data-shot-states="empty loading error">
      <QualityCard shotState={shotState} samples={samples} />
      <DeployLog shotState={shotState} samples={samples} />
    </Stack>
  )
}
