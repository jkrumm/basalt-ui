import { useFormat } from 'basalt-ui'
import { DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Empty, Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { ChartPane, LegendEntry } from 'basalt-ui/charts'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import { useEffect } from 'react'
import { DoorOpen, Eye, Layers, Users, Vote } from 'lucide-react'
import { N82_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  buildDays,
  capOf,
  findingOf,
  KEYS,
  NOW_KEY,
  typicalDay,
  type Day,
  type Finding,
  type MeasureKey,
} from './fixture'

const MEASURES = [
  { key: 'votes', label: 'Votes', icon: Vote, info: 'Cards played in a round.' },
  {
    key: 'estimations',
    label: 'Estimations',
    icon: Layers,
    info: 'Rounds that ended on one estimate.',
  },
  { key: 'rooms', label: 'Rooms', icon: DoorOpen, info: 'Rooms that held a round.' },
  {
    key: 'users',
    label: 'Unique users',
    icon: Users,
    info: 'Distinct people who opened a room.',
  },
  { key: 'views', label: 'Page views', icon: Eye, info: 'Pages loaded by anyone.' },
] as const satisfies readonly { key: MeasureKey; label: string; icon: typeof Vote; info: string }[]

const FINDING: Record<Finding, string> = {
  spike: 'Votes over 10 times typical',
  zero: 'No activity',
  inverted: 'Users above views',
}
/** The measures a finding is about: only those bars carry their value. */
const ABOUT: Record<Finding, readonly MeasureKey[]> = {
  spike: KEYS,
  zero: KEYS,
  inverted: ['users', 'views'],
}

const BRAND = { light: BASALT.brand, dark: BASALT.brand }
const TYPICAL_ENTRY: LegendEntry = {
  key: 'typical',
  label: 'Typical day',
  color: N82_SERIES.typical,
  swatch: 'dashed',
}
const LEGEND: readonly LegendEntry[] = [
  { key: 'now', label: 'Now', color: BRAND, swatch: 'bar' },
  TYPICAL_ENTRY,
]

// Two sources, two retries: the day counts and the last 24 hours come from different feeds.
const RETRY_NOW = () => undefined
const RETRY_DAYS = () => undefined
const GUTTER = 44
const minus = '\u2212'
const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `${minus}${Math.abs(n)}` : '0')

type Row = { key: string; label: string; finding: Finding }
const c = col<Row>()
const COLUMNS = [
  c.entity('label', {
    header: 'Day, finding',
    mono: true,
    sortable: false,
    sub: (r) => FINDING[r.finding],
  }),
]

type Figure = {
  key: MeasureKey
  label: string
  icon: (typeof MEASURES)[number]['icon']
  now: number
  typical: number
  change: number
}
const fc = col<Figure>()
const FIGURE_COLUMNS = [
  fc.entity('label', { header: 'Measure', sortable: false, priority: 1, card: 'title' }),
  fc.number('now', { header: 'Now', sortable: false, priority: 1, card: 'value' }),
  fc.number('typical', { header: 'Typical', sortable: false, priority: 3, card: 'meta' }),
  fc.delta('change', {
    header: 'Change',
    polarity: 'neutral',
    sortable: false,
    priority: 2,
    card: 'badge',
  }),
]

const display = defineControls({
  id: 'n82-counts',
  scope: 'page',
  fields: {
    as: field
      .enum(['cards', 'table'], 'cards', { url: false })
      .labels({ cards: 'Cards', table: 'Table' }),
  },
})

export function ExprN82Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const [view, setView] = display.field.as.use()
  // cycle-expression-17: a memory field cannot be seeded from a prop, so the `table` fixture sets the table view in an effect after the first paint.
  useEffect(() => {
    if (fixture === 'table') setView('table')
  }, [fixture, setView])
  const loading = shotState === 'loading'
  const phaseOf = (message: string, retry: () => void): Phase =>
    loading ? 'loading' : shotState === 'error' ? { tag: 'error', message, retry } : 'ready'
  const nowPhase = phaseOf('The counter did not answer.', RETRY_NOW)
  const daysPhase = phaseOf('The daily history did not load.', RETRY_DAYS)
  const days: readonly Day[] = shotState === undefined ? buildDays(fixture) : []
  const typical = typicalDay(days)
  const labelOf = (d: Day): string => (d.date === null ? 'Now' : f.date(d.date, 'day'))
  const countsOf = (d: Day): string =>
    MEASURES.map((x) => `${x.key} ${f.number(d[x.key])}`).join(', ')
  const findings = new Map(days.map((d) => [d.key, findingOf(d, typical)]))
  const rows: Row[] = days.toReversed().flatMap((d) => {
    const finding = findings.get(d.key)
    return finding ? [{ key: d.key, label: labelOf(d), finding }] : []
  })
  const focus = useChartFocus(days, {
    announce: (d) => {
      const finding = findings.get(d.key)
      return `${labelOf(d)}: ${countsOf(d)}${finding ? `, ${FINDING[finding]}` : ''}`
    },
  })
  const table = useDataTable({
    id: 'rule-breaks',
    label: 'Findings by day',
    columns: COLUMNS,
    data: rows,
    getRowId: (r) => r.key,
    mode: { kind: 'client' },
    phase: daysPhase,
    bodyRows: 4,
  })
  const now = days.find((d) => d.key === NOW_KEY)
  const prior = days.filter((d) => d.key !== NOW_KEY)
  const figures: Figure[] = now
    ? MEASURES.map((x) => ({
        key: x.key,
        label: x.label,
        icon: x.icon,
        now: now[x.key],
        typical: typical[x.key],
        change: now[x.key] - typical[x.key],
      }))
    : []
  const figureTable = useDataTable({
    id: 'five-counts',
    label: 'Measure table',
    columns: FIGURE_COLUMNS,
    data: figures,
    getRowId: (r) => r.key,
    mode: { kind: 'client' },
    phase: nowPhase,
    bodyRows: 5,
    phone: 'columns',
  })
  const chartEmpty: Empty | null =
    shotState === 'empty'
      ? {
          cause:
            'No counts yet. The counter reports once a day, so look again after its next report.',
        }
      : null
  const byKey = new Map(days.map((d) => [d.key, d]))
  const ticks = [0, 10, 20, prior.length].flatMap((i) => (days[i] ? [days[i].key] : []))
  const panes: ChartPane[] = MEASURES.map((x, i) => {
    const cap = capOf(days, x.key, typical)
    const last = i === MEASURES.length - 1
    return {
      // cycle-expression-17: the last pane gives its bottom rows to the x ticks, so its plot is shorter than the others; a weight evens them.
      weight: last ? 1.4 : 1,
      chart: ({ height }) => (
        <CartesianChart
          label={`${x.label} per day`}
          data={days}
          height={height}
          focus={focus}
          tooltip={false}
          x={{
            value: (d) => d.key,
            ticks: last ? ticks : [],
            format: (k) => {
              const day = byKey.get(String(k))
              return day ? labelOf(day) : ''
            },
          }}
          y={{
            // cycle-expression-17: a pane has no header of its own, so the measure name is the y title and repeats the card label above.
            title: x.label,
            gutter: GUTTER,
            // cycle-expression-17: no automatic outlier cap; capOf picks the highest count that is not an outlier and the kit clamps to it. The clamp mark is a faint caret on a grey bar, and a clamped bar's value is dropped when its label has no room.
            domain: cap === null ? { floor: 0 } : () => [0, Math.ceil(cap * 1.7)],
          }}
          refLines={[{ value: NOW_KEY, axis: 'x', at: 'start', color: N82_SERIES.typical }]}
          series={[
            {
              mark: 'bar',
              key: x.key,
              label: x.label,
              color: N82_SERIES.day,
              legend: false,
              y: (d) => d[x.key],
              // cycle-expression-17: on focus the other ink bars recede only a little; the page cannot set a stronger dim and the kit has no option for one.
              highlight: (d) => d.key === NOW_KEY,
              // cycle-expression-17: `values` labels every bar or none; naming only the bars a finding is about means returning '' for the rest.
              values: (v, d) => {
                const finding = findings.get(d.key)
                return finding && ABOUT[finding].includes(x.key) ? f.number(v) : ''
              },
            },
            // cycle-expression-17: a baseline taken from the data (the median day) is a hand-made line series with a gap at the last bar, so the rule stays off that bar's label, plus a hand-made legend entry.
            {
              mark: 'line',
              key: 'typical',
              label: TYPICAL_ENTRY.label,
              color: N82_SERIES.typical,
              role: 'reference',
              legend: false,
              tooltip: false,
              dash: true,
              weight: 'quiet',
              y: (d) => (d.key === NOW_KEY ? null : typical[x.key]),
            },
          ]}
        />
      ),
    }
  })
  const unusual = rows.length
  const cards = (
    <StatGroup variant="cards" label="Key figures">
      {MEASURES.map((x) => (
        <StatCell
          key={x.key}
          icon={x.icon}
          title={x.label}
          info={x.info}
          value={now ? now[x.key] : null}
          delta={{ value: now ? signed(now[x.key] - typical[x.key]) : '', polarity: 'neutral' }}
          phase={nowPhase}
        />
      ))}
    </StatGroup>
  )
  return (
    <Page area="expr-n82">
      <PageBar title="Planning poker usage" />
      <div className="grid gap-4 @wide:grid-cols-5 @wide:grid-rows-[auto_1fr]">
        <div className="grid content-start @wide:col-span-2 @wide:row-start-1">
          <Section
            title="Last 24 hours"
            summary="Against the 30-day median"
            tabs={{ state: display.field.as, label: 'Show as' }}
          >
            {view === 'cards' ? (
              cards
            ) : (
              <DataPanel
                title="Measures"
                subtitle="One row each"
                phase={nowPhase}
                empty={
                  shotState === 'empty' ? { cause: 'No figure yet, so nothing to compare.' } : null
                }
                bodySize={{ rows: 6 }}
                body={() => (
                  <DataTable
                    table={figureTable}
                    height="fill"
                    focusSeries={{ focus, key: (r) => r.key }}
                  />
                )}
              />
            )}
          </Section>
        </div>
        {/* cycle-expression-17: five stacked panes get a 288 px box at 390 (about 58 px each) and a table panel holds its declared rows only while loading, so a card has no per-pane height and the wrapper holds a floor at both widths. */}
        <div className="grid min-h-180 @wide:col-span-3 @wide:col-start-3 @wide:row-span-2 @wide:row-start-1 @wide:min-h-164">
          <ChartCard
            title="Daily counts"
            subtitle="One bar per day, then now"
            phase={daysPhase}
            empty={chartEmpty}
            height="tall"
            legend={LEGEND}
            figure={{
              value: loading ? null : unusual,
              unit: 'unusual days',
              period: focus.readout<string | undefined>(
                loading ? '' : `in ${prior.length} days, then now`,
                (d) => `${labelOf(d)}: ${countsOf(d)}`,
              ),
            }}
            footer={[
              {
                label: 'Days in use',
                value: loading ? '' : prior.filter((d) => d.votes > 0).length,
              },
            ]}
            panes={panes}
          />
        </div>
        <div className="grid @wide:col-span-2 @wide:row-start-2">
          <DataPanel
            title="Rule breaks"
            subtitle="Newest first"
            phase={daysPhase}
            empty={
              rows.length === 0 && shotState === 'empty'
                ? { cause: 'No day to check yet. Findings show up here after the first report.' }
                : null
            }
            bodySize={{ rows: 6 }}
            body={() => (
              <DataTable
                table={table}
                height="fill"
                focusItems={{ focus, holds: (row, item) => row.key === item.key }}
              />
            )}
          />
        </div>
      </div>
      {focus.live}
    </Page>
  )
}
