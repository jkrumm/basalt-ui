import { useFormat } from 'basalt-ui'
import type { FootFacts } from 'basalt-ui/cards'
import {
  CartesianChart,
  ChartCard,
  Heatmap,
  useChartFocus,
  type ChartFigure,
  type ChartRefLine,
  type ChartZone,
} from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT, alpha } from 'basalt-ui/tokens'
import type { ScenarioProps } from '../../shot-state'
import { GRID_KM, gradeOf, gridStats, nearestRain, outlookOf, type Grade } from './answer'
import {
  COL_KEYS,
  HEAVY,
  MODERATE,
  RAIN_MIN,
  ROW_KEYS,
  STEP_MIN,
  nowcast,
  variantOf,
  type Cell,
  type Step,
} from './nowcast'

// cycle-expression-10: Heatmap `color` takes one string and the playground provider registers no series group, so the bars and the map share BASALT.brand instead of a series-file pair.
const RAIN = { light: BASALT.brand, dark: BASALT.brand }
const RULE = { light: BASALT.inkMuted, dark: BASALT.inkMuted }
/** The y axis stops here: a cloudburst past it is drawn on the edge with its true value beside the caret. */
const CAP = 20
/** The map's ramp tops out here; a cell above it reads as the darkest. */
const MAP_TOP = 12
const TICK_EVERY = 6

const capDomain = (extent: readonly [number, number]): readonly [number, number] => [
  0,
  Math.min(Math.max(extent[1], 10), CAP),
]

const WORD: Record<Grade, string> = { light: 'Light', moderate: 'Moderate', heavy: 'Heavy' }
const verdictOf = (mmh: number): ChartFigure['status'] =>
  mmh < RAIN_MIN
    ? undefined
    : { tone: gradeOf(mmh) === 'heavy' ? 'warn' : 'neutral', label: WORD[gradeOf(mmh)] }

const minutes = (s: Step): number => s.index * STEP_MIN
// cycle-expression-10: a zone on a band axis matches its ends by band key: a number or a Date key draws nothing and a key of another type spans the whole plot, so the time axis is string keys.
const bandOf = (s: Step): string => String(minutes(s))
const cellRow = (c: Cell) => String(c.north)
const cellCol = (c: Cell) => String(c.east)
const cellRate = (c: Cell) => c.mmh
// cycle-expression-10: the Heatmap has no marker for a point on the grid, so the viewer is an annotate glyph.
const cellMark = (c: Cell) => (c.viewer ? '●' : null)
const TICK_COLS = [COL_KEYS[0] ?? '', '0', COL_KEYS.at(-1) ?? '']

// cycle-expression-10: the Heatmap has no compass or "you" axis, so formatRow and formatCol label the bands by hand.
const bandLabel = (key: string, plus: string, minus: string): string => {
  const n = Number(key)
  return n === 0 ? 'You' : n > 0 ? `${n} ${plus}` : `${-n} ${minus}`
}
const rowLabel = (key: string) => bandLabel(key, 'N', 'S')
const colLabel = (key: string) => bandLabel(key, 'E', 'W')

export function ExprN44Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const { steps, now } = nowcast(variantOf(fixture))
  const clock = (d: Date) => f.time(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const rate = (v: number) => f.number(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  const phase =
    shotState === 'loading'
      ? ('loading' as const)
      : shotState === 'error'
        ? {
            tag: 'error' as const,
            message: 'The radar service did not answer.',
            // cycle-expression-10: the page holds no query, so Retry has nothing to refetch.
            retry: () => undefined,
          }
        : ('ready' as const)
  const empty =
    shotState === 'empty'
      ? { cause: 'The radar has sent no frames for your spot yet. Check again in a few minutes.' }
      : null

  const focus = useChartFocus(steps, {
    announce: (d) =>
      d.missing || d.mmh === null
        ? `${clock(d.at)}: no forecast`
        : `${clock(d.at)}: ${rate(d.mmh)} mm/h${d.mmh < RAIN_MIN ? ', dry' : `, ${gradeOf(d.mmh)}`}`,
  })

  const outlook = outlookOf(steps)
  const missing = steps.filter((s) => s.missing)

  const heroRest =
    outlook.kind === 'dry'
      ? 'Dry for the next 2 h'
      : outlook.first.index === 0
        ? 'Raining now'
        : `Rain ${outlook.earliest === outlook.first ? 'from' : 'by'} ${clock(outlook.first.at)}`
  const statusRest = outlook.kind === 'dry' ? undefined : verdictOf(outlook.peak.mmh ?? 0)
  const restStatus =
    statusRest === undefined ? undefined : { ...statusRest, label: `${statusRest.label} at peak` }

  const figure: ChartFigure =
    phase === 'ready'
      ? {
          value: focus.readout<string | null>(heroRest, (d) =>
            d.mmh === null ? null : rate(d.mmh),
          ),
          unit: focus.readout<string | undefined>(undefined, (d) =>
            d.mmh === null ? undefined : 'mm/h',
          ),
          period: focus.readout(`now ${clock(now.at)}`, (d) =>
            d.missing ? `${clock(d.at)}, no forecast` : clock(d.at),
          ),
          periodMono: true,
          status: focus.readout<ChartFigure['status']>(restStatus, (d) =>
            d.mmh === null ? undefined : verdictOf(d.mmh),
          ),
        }
      : { value: null }

  const footer: FootFacts =
    phase === 'ready' && shotState !== 'empty'
      ? [
          {
            label: 'Peak',
            value:
              outlook.kind === 'dry'
                ? `${rate(0)} mm/h`
                : `${rate(outlook.peak.mmh ?? 0)} mm/h at ${clock(outlook.peak.at)}`,
            mono: true,
          },
          outlook.kind === 'dry'
            ? null
            : {
                label: 'Dry again',
                value: outlook.dryAt === null ? 'not within 2 h' : clock(outlook.dryAt.at),
                mono: true,
              },
        ]
      : [
          { label: 'Peak', value: '' },
          { label: 'Dry again', value: '' },
        ]

  // cycle-expression-10: the kit has no mark for a datum that never arrived (y null draws a gap), so each missing step is an x zone, labelled once.
  const zones: ChartZone[] = missing.map((s, i) => {
    const zone = {
      axis: 'x' as const,
      from: bandOf(s),
      to: bandOf(s),
      y: { from: 0, to: CAP },
      fill: alpha(BASALT.ink, 0.1),
    }
    return i === 0 ? { ...zone, label: 'No forecast' } : zone
  })
  const refLines: ChartRefLine[] = [
    { value: MODERATE, color: RULE, dashed: true, label: `Moderate from ${MODERATE}` },
    { value: HEAVY, color: RULE, dashed: true, label: `Heavy from ${HEAVY}` },
  ]

  const restFrame = outlook.kind === 'rain' ? outlook.first : now
  const frame = focus.readout<Step>(restFrame, (d) => d)
  const near = nearestRain(frame)
  const stats = gridStats(frame)
  const restWord = outlook.kind === 'rain' && outlook.first.index > 0 ? 'at arrival' : 'now'
  const mapFigure: ChartFigure =
    phase === 'ready'
      ? {
          value: frame.missing
            ? null
            : near === null
              ? `No rain within ${GRID_KM / 2} km`
              : near.km === 0
                ? 'Rain over you'
                : `Rain ${near.km} km ${near.toward}`,
          period: frame === restFrame ? restWord : `at ${clock(frame.at)}`,
          periodMono: true,
        }
      : { value: null }
  const mapFooter: FootFacts =
    phase === 'ready' && shotState !== 'empty'
      ? [
          { label: 'Heaviest cell', value: frame.missing ? '—' : `${rate(stats.heaviest)} mm/h` },
          {
            label: 'Wet area',
            value: frame.missing ? '—' : f.percent(stats.wetShare, { maximumFractionDigits: 0 }),
          },
        ]
      : [
          { label: 'Heaviest cell', value: '' },
          { label: 'Wet area', value: '' },
        ]

  return (
    <Page area="expr-n44">
      <PageBar title="Rain at your spot, next 2 hours" />
      <div className="@container">
        <div className="grid gap-4 @wide:grid-cols-3">
          <div className="min-w-0 @wide:col-span-2">
            <ChartCard
              title="Rain at your spot"
              subtitle={`Rain rate every ${STEP_MIN} min, next 2 h`}
              phase={phase}
              empty={empty}
              figure={figure}
              footer={footer}
              chart={() => (
                <CartesianChart
                  label="Rain rate at your spot for each 5 minute step of the next 2 hours"
                  data={steps}
                  focus={focus}
                  tooltip={false}
                  x={{
                    value: bandOf,
                    format: (x) => clock(new Date(now.at.getTime() + Number(x) * 60_000)),
                    ticks: steps.filter((s) => s.index % TICK_EVERY === 0).map(bandOf),
                  }}
                  y={{ title: 'mm/h', domain: capDomain }}
                  series={[
                    {
                      mark: 'bar',
                      key: 'rain',
                      label: 'Rain at your spot',
                      color: RAIN,
                      y: (d) => d.mmh,
                      format: (v) => `${rate(v)} mm/h`,
                      // cycle-expression-10: `values` has no skip for a zero bar, so an empty string hides it.
                      values: (v) => (v < RAIN_MIN ? '' : rate(v)),
                    },
                  ]}
                  zones={zones}
                  refLines={
                    outlook.kind === 'rain'
                      ? [
                          ...refLines,
                          {
                            axis: 'x',
                            value: bandOf(outlook.first),
                            at: 'start',
                            color: RULE,
                            label: clock(outlook.first.at),
                          },
                        ]
                      : refLines
                  }
                />
              )}
            />
          </div>
          <div className="min-w-0">
            <ChartCard
              title="Rain around your spot"
              subtitle={`${GRID_KM} × ${GRID_KM} km, ● is you`}
              phase={phase}
              empty={empty}
              // cycle-expression-10: Heatmap cells follow the box, not a square grid; fill matches the chart card's height.
              height="fill"
              figure={mapFigure}
              footer={mapFooter}
              chart={() => (
                <Heatmap
                  label="Rain rate in each 2 km cell around your spot"
                  data={frame.cells}
                  getRow={cellRow}
                  getCol={cellCol}
                  getValue={cellRate}
                  rows={ROW_KEYS}
                  cols={COL_KEYS}
                  color={BASALT.brand}
                  domain={[0, MAP_TOP]}
                  formatValue={(v) => `${rate(v)} mm/h`}
                  formatLegend={(v) => (v >= MAP_TOP ? `${v}+` : String(v))}
                  formatRow={rowLabel}
                  formatCol={colLabel}
                  tickCols={TICK_COLS}
                  legend={{ label: 'mm/h' }}
                  annotate={cellMark}
                  tooltip={{ valueLabel: 'Rain' }}
                  matchHeight
                />
              )}
            />
          </div>
        </div>
      </div>
    </Page>
  )
}
