import { useFormat, createFormat } from 'basalt-ui'
import { BarList } from 'basalt-ui/cards'
import type { Format } from 'basalt-ui'
import { ChartCard, Heatmap, useChartFocus } from 'basalt-ui/charts'
import type { HeatmapState } from 'basalt-ui/charts'
import { filterSlot, spec } from 'basalt-ui/controls'
import { Page, PageBar } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { BASALT } from 'basalt-ui/tokens'
import type { ScenarioProps } from '../../shot-state'
import { HOURS, OWNER_ZONE, WEEKDAYS, fixtureKey, fixtureOf } from './fixture'
import type { Cell, FixtureName, Largest } from './fixture'

type Measure = 'cost' | 'tokens'

const store = defineControls({
  id: 'expr-n83',
  scope: 'page',
  fields: {
    measure: field
      .enum(['cost', 'tokens'] as const, 'cost', { url: false, persist: false })
      .labels({ cost: 'Cost', tokens: 'Tokens' }),
  },
})

const CONTROLS = filterSlot([spec(store.field.measure, 'Measure', { as: 'segmented' })])

// cycle-expression-17: Heatmap takes accessors with a stable identity, so the number formats the cells print are built at module scope; the page's own text goes through useFormat.
const cellFormat = createFormat({ locale: 'en-GB' })
const short = (measure: Measure, n: number): string =>
  measure === 'cost'
    ? cellFormat.number(Math.round(n))
    : cellFormat.number(n, { notation: 'compact', maximumFractionDigits: 1 })

/** The note a cell prints: no decimals, so a compact token count fits a cell. */
const tight = (measure: Measure, n: number): string =>
  measure === 'cost'
    ? cellFormat.number(Math.round(n))
    : cellFormat.number(n, { notation: 'compact', maximumFractionDigits: 0 })

const valueOf: Record<Measure, (c: Cell) => number | null> = {
  cost: (c) => c.cost,
  tokens: (c) => (c.records > 0 ? c.tokens : null),
}
const stateOf: Record<Measure, (c: Cell) => 'none' | 'unpriced' | undefined> = {
  cost: (c) => (c.records === 0 ? 'none' : c.priced === 0 ? 'unpriced' : undefined),
  tokens: (c) => (c.records === 0 ? 'none' : undefined),
}
const NONE = { key: 'none', label: 'No record', color: BASALT.hairline } as const
const UNPRICED = {
  key: 'unpriced',
  label: 'No cost',
  color: BASALT.inkFaint,
  glyph: '–',
} as const
const getRow = (c: Cell): string => c.weekday
const getCol = (c: Cell): string => c.hour
const formatCol = (h: string): string => `${h}:00`
const TICKS = ['00', '03', '06', '09', '12', '15', '18', '21']

type View = {
  states: readonly HeatmapState[]
  domain: readonly [number, number]
  annotate: (c: Cell) => string | null
  formatLegend: (v: number) => string
  formatValue: (v: number) => string
}

/** A colour cap just over the third-largest cell, so the one batch past it clips to the top step and names its true value on the cell. */
function capOf(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b)
  const p = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.97))] ?? 1
  const unit = 5 * 10 ** (Math.floor(Math.log10(p)) - 1)
  return Math.ceil(p / unit) * unit
}

const VIEWS = new Map<string, View>()
function viewOf(name: FixtureName, measure: Measure): View {
  const id = `${name}-${measure}`
  const hit = VIEWS.get(id)
  if (hit !== undefined) return hit
  const read = valueOf[measure]
  const values = fixtureOf(name)
    .cells.map(read)
    .filter((v): v is number => v !== null)
  const cap = capOf(values.length > 0 ? values : [1])
  const unpriced = fixtureOf(name).records.filter((r) => r.cost === null).length
  const made: View = {
    states: measure === 'cost' ? [NONE, { ...UNPRICED, note: `${unpriced} records` }] : [NONE],
    domain: [0, cap],
    annotate: (c) => {
      const v = read(c)
      return v !== null && v >= cap * 0.8 ? tight(measure, v) : null
    },
    formatLegend: (v) => (v >= cap ? `${short(measure, v)}+` : short(measure, v)),
    formatValue: (v) => short(measure, v),
  }
  VIEWS.set(id, made)
  return made
}

const within = (c: Cell, from: string, to: string): boolean => from <= c.hour && c.hour < to
const WORKDAYS: ReadonlySet<string> = new Set(WEEKDAYS.slice(0, 5))
const OFFICE = (c: Cell): boolean => WORKDAYS.has(c.weekday) && within(c, '09', '18')
const OFFICE_HOURS = 45 / 168
const PARTS = [
  { label: '00:00 to 06:00', from: '00', to: '06' },
  { label: '06:00 to 12:00', from: '06', to: '12' },
  { label: '12:00 to 18:00', from: '12', to: '18' },
  { label: '18:00 to 24:00', from: '18', to: '24' },
]

const sum = (cells: readonly Cell[], measure: Measure): number =>
  cells.reduce((s, c) => s + (valueOf[measure](c) ?? 0), 0)

const usd = (f: Format, n: number): string =>
  f.money(n, 'USD', { maximumFractionDigits: n < 10 ? 2 : 0 })
const text = (f: Format, measure: Measure, n: number): string =>
  measure === 'cost' ? usd(f, n) : f.number(n, { notation: 'compact', maximumFractionDigits: 1 })

const noop = (): void => undefined
const ERROR = { tag: 'error' as const, message: 'The usage export did not answer.', retry: noop }

const blank = (c: Cell): Cell => ({ ...c, records: 0, priced: 0, cost: null, tokens: 0 })
const cellName = (c: Cell): string => `${c.weekday} ${c.hour}:00`
function cellReading(f: Format, c: Cell, measure: Measure): string {
  if (c.records === 0) return 'empty'
  const v = valueOf[measure](c)
  return v === null ? UNPRICED.label : text(f, measure, v)
}
function spanName(run: readonly Cell[]): string {
  const first = run[0]
  if (first === undefined || run.every((c) => c.weekday === first.weekday))
    return first?.weekday ?? ''
  const hours = run.map((c) => Number(c.hour))
  return `${String(Math.min(...hours)).padStart(2, '0')}:00 to ${String(Math.max(...hours) + 1).padStart(2, '0')}:00`
}
const spanReading = (f: Format, run: readonly Cell[], measure: Measure): string =>
  `${spanName(run)}, ${text(f, measure, sum(run, measure))}`

export function ExprN83Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const [measure] = store.field.measure.use()
  const name = fixtureKey(fixture)
  const base = fixtureOf(name)
  const none = shotState === 'empty'
  const cells = none ? base.cells.map(blank) : base.cells
  const ready = shotState === undefined
  const phase = shotState === 'loading' ? 'loading' : shotState === 'error' ? ERROR : 'ready'
  const view = viewOf(name, measure)
  const word = measure === 'cost' ? 'cost' : 'tokens'
  const largest: Largest | null = none ? null : base.largest[measure]
  const total = sum(cells, measure)
  const office = sum(cells.filter(OFFICE), measure)
  const share = total > 0 ? office / total : 0
  const priced = total > 0

  const focus = useChartFocus(cells, {
    columns: 24,
    announce: (c) => `${cellName(c)}: ${cellReading(f, c, measure)}`,
    announceSpan: (run) => spanReading(f, run, measure),
  })

  const days = WEEKDAYS.map((d) => ({
    label: d,
    value: sum(
      cells.filter((c) => c.weekday === d),
      measure,
    ),
  }))
  const share_ = (v: number): string =>
    total > 0 ? f.percent(v / total, { maximumFractionDigits: 0 }) : ''
  const dayItems = days.map((d) => ({ ...d, secondary: share_(d.value) }))
  const partItems = PARTS.map((p) => ({
    label: p.label,
    value: sum(
      cells.filter((c) => within(c, p.from, p.to)),
      measure,
    ),
  })).map((p) => ({ ...p, secondary: share_(p.value) }))

  const figure = {
    value: ready ? (priced ? f.percent(share, { maximumFractionDigits: 0 }) : null) : '',
    unit: `of ${word}`,
    delta:
      ready && !priced
        ? undefined
        : {
            value: priced ? `+${Math.round((share - OFFICE_HOURS) * 100)} pts` : '',
            polarity: 'neutral' as const,
            label: `vs ${f.percent(OFFICE_HOURS, { maximumFractionDigits: 0 })} of hours`,
          },
    period:
      focus.span.length > 1
        ? spanReading(f, focus.span, measure)
        : focus.readout(
            priced ? 'Mon to Fri, 09:00 to 18:00' : 'Nothing priced yet',
            (c) => `${cellName(c)}, ${cellReading(f, c, measure)}`,
          ),
    periodMono: true,
  }
  const footer = [
    {
      label: 'Top record',
      value: !ready
        ? ''
        : largest !== null && priced
          ? `${text(f, measure, largest.value)}, ${f.percent(largest.value / largest.week, { maximumFractionDigits: 0 })} of week`
          : '—',
      mono: true,
    },
  ] as const

  return (
    <Page area="expr-n83">
      <PageBar title="When agents run, last 30 days" controls={CONTROLS} />
      <div className="grid gap-4 @wide:grid-cols-3">
        <div className="@wide:col-span-2">
          <ChartCard
            height="tall"
            title="Weekday by hour"
            subtitle={`${OWNER_ZONE}; Sun 02:00 holds the 25 Oct clock change`}
            phase={phase}
            empty={
              none
                ? {
                    cause: 'No usage yet. Run an agent through the gateway and it lands here.',
                  }
                : null
            }
            figure={figure}
            footer={footer}
            chart={() => (
              <Heatmap
                label={`${word === 'cost' ? 'Cost' : 'Tokens'} in each of 168 cells`}
                data={cells}
                rows={WEEKDAYS}
                cols={HOURS}
                getRow={getRow}
                getCol={getCol}
                getValue={valueOf[measure]}
                getState={stateOf[measure]}
                states={view.states}
                color={BASALT.ink}
                domain={view.domain}
                formatCol={formatCol}
                tickCols={TICKS}
                formatValue={view.formatValue}
                formatLegend={view.formatLegend}
                legend={{ label: measure === 'cost' ? 'US$ per cell' : 'Tokens per cell' }}
                annotate={view.annotate}
                tooltip={false}
                focus={focus}
                matchHeight
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-4">
          <BarList
            bodyRows={7}
            title="Totals by day of week"
            subtitle="Summed over its hours"
            phase={phase}
            empty={none ? { cause: 'No day of the week to rank until usage lands.' } : null}
            items={dayItems}
            format={(v) => (priced ? text(f, measure, v) : '—')}
            focusItems={{ focus, holds: (row, c) => c.weekday === row.label }}
          />
          <BarList
            bodyRows={4}
            mono
            title="Totals by time of day"
            subtitle="Summed over its days"
            phase={phase}
            empty={none ? { cause: 'No time of day to rank without a first run.' } : null}
            items={partItems}
            format={(v) => (priced ? text(f, measure, v) : '—')}
            focusItems={{
              focus,
              holds: (row, c) =>
                PARTS.some((p) => p.label === row.label && within(c, p.from, p.to)),
            }}
          />
        </div>
      </div>
    </Page>
  )
}
