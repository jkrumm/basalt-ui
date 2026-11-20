import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Delta, Empty, Phase, Verdict as FigureVerdict } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, Lines, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar, useSizeClass } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N67_SERIES as SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  AHEAD_POINTS,
  LIFTS,
  WINDOW_DAYS,
  buildBlock,
  verdictRuns,
  type Block,
  type BlockVariant,
  type Day,
  type LiftKey,
  type Verdict,
  type Week,
} from './fixture'

const BLOCKS: Record<BlockVariant, Block> = {
  default: buildBlock('default'),
  extreme: buildBlock('extreme'),
  matched: buildBlock('matched'),
}
const NO_SESSIONS: Block = {
  days: [],
  weeks: [],
  lifts: [],
  windowStart: new Date(0),
  lastDay: new Date(0),
  maxVolume: 0,
}

const DAY_MS = 86_400_000
/** One y gutter for both load panes, so one day sits on one pixel column in each. */
const GUTTER = 56
/** The two load panes stack to the chart box of a tall card: 288 px at its narrowest, 375 in a half-width card. */
const PANE_VOLUME = { narrow: 100, wide: 130 }
const PANE_SCORE = { narrow: 180, wide: 245 }
/** The most a lift's change draws before the kit's off-scale caret, kg. */
const CHANGE_CAP = 24
/** The most a week's volume draws before the caret, kg. */
const VOLUME_CAP = 45_000

const VOLUME = 'Weekly volume'
const VOLUME_KG = 'Volume, kg'
const RECOVERY = 'Recovery'
const INTENSITY = 'Session intensity'
const AHEAD = 'Ahead'
const NO_TRAINING = 'No training'
const WINDOW = `Last ${WINDOW_DAYS / 7} weeks`

const SESSIONS_EMPTY: Empty = {
  cause: 'No session is logged yet. Log one to draw the trends.',
}
const RECOVERY_EMPTY: Empty = {
  cause: 'No reading is synced yet. Sync the tracker and the table fills.',
}

const MINUS = '\u2212'
const signed = (v: number, digits = 1): string => {
  const text = Math.abs(v).toFixed(digits)
  return Number(text) === 0 ? text : `${v < 0 ? MINUS : '+'}${text}`
}

type WeekRow = {
  id: string
  label: string
  sub: string | null
  volume: number
  intensity: number | null
  recovery: number
  verdict: Verdict
}

const c = col<WeekRow>()

const variantOf = (fixture: string | undefined): BlockVariant =>
  fixture === 'extreme' || fixture === 'matched' ? fixture : 'default'

export function ExprN67Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  // cycle-expression-14: ChartCard hands its chart no pane height, so two panes on one x read the viewport class for numbers
  const expanded = useSizeClass() === 'expanded'
  const shortDate = (at: Date | number): string => f.date(at, 'short', { year: undefined })
  const block = shotState === 'empty' ? NO_SESSIONS : BLOCKS[variantOf(fixture)]
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The training log did not answer.', retry: () => undefined }
        : 'ready'
  const ready = phase === 'ready' && block.days.length > 0
  const { days, weeks, lifts } = block

  const dayText = (d: Day): string => shortDate(d.day)
  const spanText = (run: readonly Day[]): string =>
    `${shortDate(run[0]?.day ?? 0)} to ${shortDate(run.at(-1)?.day ?? 0)}`
  /** The best change per lift over the days held: a day reads its own values. */
  const liftsText = (run: readonly Day[]): string => {
    const parts = LIFTS.flatMap(({ key, name }) => {
      const gains = run.flatMap((d) => (d.gain[key] === null ? [] : [d.gain[key] ?? 0]))
      return gains.length === 0 ? [] : [`${name} ${signed(Math.max(...gains))} kg`]
    })
    return parts.length === 0 ? 'No lift trained' : parts.join(', ')
  }
  const readText = (volume: number | null, intensity: number | null, recovery: number): string =>
    [
      volume === null ? null : `${f.number(volume)} kg`,
      intensity === null ? null : `${INTENSITY.toLowerCase()} ${intensity}`,
      `${RECOVERY.toLowerCase()} ${recovery}`,
    ]
      .filter(Boolean)
      .join(', ')
  const loadText = (run: readonly Day[]): string => {
    const first = run[0]
    if (first === undefined) return ''
    if (run.length === 1) return readText(null, first.intensity, first.recovery)
    const week = weeks[first.week]
    return readText(first.weekVolume, week?.intensity ?? null, week?.recovery ?? 0)
  }

  const focus = useChartFocus(days, {
    announce: (d) =>
      `${dayText(d)}: ${liftsText([d])}; ${loadText([d])}; weekly ${f.number(d.weekVolume)} kg`,
    announceSpan: (run) => `${spanText(run)}: ${liftsText(run)}; ${loadText(run)}`,
  })

  const rows: WeekRow[] = weeks.map((w: Week) => ({
    id: w.id,
    label: shortDate(w.from),
    sub: w.days < 7 ? `${w.days} days so far` : null,
    volume: w.volume,
    intensity: w.intensity,
    recovery: w.recovery,
    verdict: w.verdict,
  }))
  const table = useDataTable({
    id: 'expr-n67-weeks',
    label: 'Block figures',
    columns: [
      c.entity('label', {
        header: 'Week of',
        width: 'content',
        mono: true,
        sub: (r) => r.sub,
        sortable: false,
      }),
      c.meter('volume', { header: VOLUME_KG, max: block.maxVolume, sortable: false }),
      c.number('intensity', { header: 'Intensity', digits: 0, sortable: false }),
      c.number('recovery', { header: RECOVERY, digits: 0, sortable: false }),
      c.status('verdict', {
        header: 'Verdict',
        options: ['ahead', 'matched', 'rest'],
        labels: { ahead: AHEAD, matched: 'Matched', rest: NO_TRAINING },
        tone: (v) => (v === 'ahead' ? 'bad' : 'neutral'),
        sortable: false,
      }),
    ],
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    empty: RECOVERY_EMPTY,
    bodyRows: weeks.length,
  })

  const slowest = [...lifts].sort((a, b) => a.change - b.change)[0]
  const fastest = [...lifts].sort((a, b) => b.change - a.change)[0]
  const rising = lifts.filter((l) => l.rising).length
  const lifted: Delta | undefined =
    ready && slowest !== undefined
      ? {
          value: `${signed(slowest.change)} kg`,
          polarity: slowest.rising ? 'up-good' : 'neutral',
          label: `${slowest.name}, ${WINDOW.toLowerCase()}`,
        }
      : undefined

  const ahead = weeks.filter((w) => w.verdict === 'ahead')
  const worst = [...weeks].sort((a, b) => (b.gap ?? -100) - (a.gap ?? -100))[0]
  const rest = weeks.find((w) => w.verdict === 'rest')
  const lowest = [...days].sort((a, b) => a.recovery - b.recovery)[0]
  const lowestScore = lowest?.recovery
  const gapDelta: Delta | undefined =
    ready && worst?.gap != null
      ? {
          value: `${signed(worst.gap, 0)} pts`,
          polarity: ahead.length > 0 ? 'up-bad' : 'neutral',
          label: `worst week, ${shortDate(worst.from)}`,
        }
      : undefined

  const ticks = days
    .filter((d) => d.index % 15 === 0 && d.index < days.length - 1)
    .map((d) => d.day)
  const x = {
    value: (d: Day): Date => d.day,
    domain: [block.days[0]?.day ?? new Date(0), block.lastDay] as const,
  }
  const dayAfter = new Date(block.lastDay.getTime() + DAY_MS)

  const liftStatus = (run: readonly Day[]): FigureVerdict => ({
    tone: 'neutral',
    label: liftsText(run),
  })
  const loadStatus = (run: readonly Day[]): FigureVerdict => ({
    tone: weeks[run[0]?.week ?? 0]?.verdict === 'ahead' ? 'bad' : 'neutral',
    label: loadText(run),
  })

  const lines = LIFTS.map(({ key, name }: { key: LiftKey; name: string }) => ({
    mark: 'line' as const,
    key,
    label: name,
    color: SERIES[key],
    y: (d: Day) => d.gain[key],
    gaps: 'connect' as const,
    weight: key === 'press' ? ('strong' as const) : ('quiet' as const),
    format: (v: number) => `${signed(v)} kg`,
  }))

  return (
    <Page area="expr-n67">
      <PageBar title="Training block, last 90 days" />
      <div className="grid gap-3 @wide:grid-cols-2">
        <ChartCard
          title="Estimated one-rep max by lift"
          subtitle="Gain since the first session"
          phase={phase}
          empty={ready || phase !== 'ready' ? null : SESSIONS_EMPTY}
          height="tall"
          figure={{
            value: ready ? `${rising} of ${lifts.length}` : '',
            unit: 'lifts rising',
            delta: lifted,
            period:
              focus.span.length > 1
                ? spanText(focus.span)
                : focus.readout<string | undefined>(undefined, dayText),
            periodMono: true,
            status:
              focus.span.length > 1
                ? liftStatus(focus.span)
                : focus.readout<FigureVerdict | undefined>(undefined, (d) => liftStatus([d])),
          }}
          legend={LIFTS.map(({ key, name }) => ({ key, label: name, color: SERIES[key] }))}
          footer={[
            {
              label: 'Top riser',
              value: ready && fastest ? `${fastest.name} ${signed(fastest.change)} kg` : '',
            },
            {
              label: 'Sessions',
              value: ready ? days.filter((d) => d.intensity !== null).length : '',
            },
          ]}
          chart={() => (
            <Lines
              label="Trend per lift"
              data={days}
              x={{ ...x, ticks }}
              y={{
                title: 'Gain, kg',
                gutter: GUTTER,
                domain: ([lo, hi]) => [Math.min(lo, 0), Math.min(hi + 2, CHANGE_CAP)],
              }}
              height="fill"
              series={lines}
              naming="endLabels"
              focus={focus}
              tooltip={false}
              zones={[
                {
                  axis: 'x',
                  from: block.windowStart,
                  to: dayAfter,
                  fill: alpha(BASALT.inkMuted, 0.08),
                  label: WINDOW,
                },
              ]}
              refLines={[{ value: 0, color: SERIES.start, dashed: true, label: 'Start' }]}
            />
          )}
        />
        <ChartCard
          title="Effort and recovery"
          subtitle={`${AHEAD}: intensity more than ${AHEAD_POINTS} points over recovery`}
          phase={phase}
          empty={ready || phase !== 'ready' ? null : RECOVERY_EMPTY}
          height="tall"
          figure={{
            value: ready ? ahead.length : '',
            unit: 'weeks ahead',
            delta: gapDelta,
            period:
              focus.span.length > 1
                ? spanText(focus.span)
                : focus.readout<string | undefined>(undefined, dayText),
            periodMono: true,
            status:
              focus.span.length > 1
                ? loadStatus(focus.span)
                : focus.readout<FigureVerdict | undefined>(undefined, (d) => loadStatus([d])),
          }}
          footer={[
            {
              label: 'Weeks trained',
              value: ready ? `${weeks.length - (rest ? 1 : 0)} of ${weeks.length}` : '',
            },
            {
              label: 'Lowest score',
              value: ready && lowest ? `${shortDate(lowest.day)}, ${lowestScore}` : '',
              mono: true,
            },
          ]}
          legend={[
            { key: 'volume', label: VOLUME, color: SERIES.volume },
            { key: 'recovery', label: RECOVERY, color: SERIES.recovery },
            {
              key: 'intensity',
              label: INTENSITY,
              color: SERIES.intensity,
              swatch: 'dot',
            },
          ]}
          chart={() => (
            <div className="flex flex-col">
              <div>
                <Lines
                  label={VOLUME}
                  data={days}
                  x={{ ...x, ticks: [] }}
                  y={{
                    title: VOLUME_KG,
                    gutter: GUTTER,
                    format: (v) => (v === 0 ? '0' : `${v / 1000}k`),
                    domain: ([, hi]) => [0, Math.min(hi, VOLUME_CAP)],
                  }}
                  height={expanded ? PANE_VOLUME.wide : PANE_VOLUME.narrow}
                  focus={focus}
                  tooltip={false}
                  series={[
                    {
                      mark: 'line',
                      key: 'volume',
                      label: VOLUME,
                      color: SERIES.volume,
                      y: (d) => d.weekVolume,
                      curve: 'stepAfter',
                      area: 'fade',
                      legend: false,
                      format: (v) => `${f.number(v)} kg`,
                    },
                  ]}
                  zones={verdictRuns(weeks, 'rest').map((run) => ({
                    axis: 'x' as const,
                    from: run.from,
                    to: run.to,
                    fill: alpha(BASALT.inkMuted, 0.1),
                    label: NO_TRAINING,
                  }))}
                />
              </div>
              <div>
                <CartesianChart
                  label={`${RECOVERY} and ${INTENSITY.toLowerCase()}`}
                  data={days}
                  x={{ ...x, ticks }}
                  y={{ title: 'Score', gutter: GUTTER, domain: [0, 100] }}
                  height={expanded ? PANE_SCORE.wide : PANE_SCORE.narrow}
                  focus={focus}
                  tooltip={false}
                  series={[
                    {
                      mark: 'line',
                      key: 'recovery',
                      label: RECOVERY,
                      color: SERIES.recovery,
                      y: (d) => d.recovery,
                      legend: false,
                    },
                    {
                      mark: 'dot',
                      key: 'intensity',
                      label: INTENSITY,
                      color: SERIES.intensity,
                      y: (d) => d.intensity,
                      legend: false,
                    },
                  ]}
                  zones={verdictRuns(weeks, 'ahead').map((run) => ({
                    axis: 'x' as const,
                    from: run.from,
                    to: run.to,
                    fill: alpha(BASALT.bad, 0.1),
                    label: AHEAD,
                  }))}
                />
              </div>
            </div>
          )}
        />
      </div>
      {/* Phone: the weeks table repeats the chart zones, so it drops below the regular container class. */}
      <div className="hidden @regular:block">
        <DataPanel
          title="Weekly figures"
          subtitle="Scores are means of each week"
          phase={phase}
          empty={ready || phase !== 'ready' ? null : RECOVERY_EMPTY}
          bodySize={{ rows: weeks.length + 1 }}
          body={() => (
            <DataTable
              table={table}
              height="fill"
              focusItems={{
                focus,
                holds: (w, d) => d.week === weeks.findIndex((x) => x.id === w.id),
              }}
            />
          )}
        />
      </div>
    </Page>
  )
}
