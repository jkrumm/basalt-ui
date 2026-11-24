import { createFormat } from 'basalt-ui'
import type { Phase, Tone } from 'basalt-ui/cards'
import { DataPanel } from 'basalt-ui/cards'
import { Bars, ChartCard, Heatmap, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N64_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { CALLERS, fixtureOf } from './fixture'
import type { CacheCell, Day, Fixture, Reason, Target } from './fixture'

type Row = Day & { topText: string; why: string }
type CellState = 'down' | 'zero'

const REASONS = ['quota', 'policy', 'down'] as const
const REASON_TEXT: Record<Reason, string> = { quota: 'Quota', policy: 'Policy', down: 'Model down' }
const TARGETS: readonly Target[] = ['iu', 'me', 'iu-api']
const ERROR_CAUSE = 'The gateway log did not answer.'
const NOT_LOGGED = 'Not logged'
const REFUSED = 'refused'
const FIRST_WEEK = 'vs first week'
const DASH = '\u2014'
const WEEK = 7

const fmt = createFormat()
const signed = (n: number, unit = ''): string =>
  n === 0 ? `0${unit}` : `${n > 0 ? '+' : '\u2212'}${fmt.number(Math.abs(n))}${unit}`
const sum = <T,>(items: readonly T[], read: (item: T) => number): number =>
  items.reduce((total, item) => total + read(item), 0)
const mean = (cells: readonly CacheCell[]): number => {
  const shares = cells.flatMap((x) => (x.share === null ? [] : [x.share]))
  return shares.length === 0 ? 0 : Math.round(sum(shares, (s) => s) / shares.length)
}

function whyOf(day: Day): string {
  const parts = REASONS.filter((r) => day[r] > 0).map(
    (r) => `${REASON_TEXT[r].toLowerCase()} ${day[r]}`,
  )
  return parts.length === 0 ? DASH : parts.join(', ')
}

/** The kit's own clamp: a day that dwarfs the rest is capped at a round number above the next one. */
function capOf(days: readonly Day[]): number | undefined {
  const totals = days.map((d) => d.total).toSorted((a, b) => b - a)
  const [top = 0, next = 0] = totals
  return top > next * 2.5 ? Math.ceil((next * 1.6) / 10) * 10 : undefined
}

/** The one reading of a day: the readout, the announcement and the status share it. */
function dayRead(day: Row): string {
  const { total, iu, me, iuApi, refused } = day
  return total === 0 ? NOT_LOGGED : `iu ${iu}, me ${me}, iu-api ${iuApi}, ${refused} ${REFUSED}`
}

/** The one reading of a cell. */
function cellRead(cell: CacheCell): string {
  const { share } = cell
  return share === null ? NOT_LOGGED : `${share} % hit`
}

/** A cell's name: its caller and its day. */
function cellName(cell: CacheCell): string {
  const { caller, label } = cell
  return `${caller}, ${label}`
}

/** The caller whose hits fell to zero, and since when. */
function zeroNote(cell: CacheCell): string {
  const { caller, label } = cell
  return `${caller} at 0 % since ${label}`
}

const named = (name: string, read: string): string => `${name}: ${read}`

const c = col<Row>()

/** What a render reads, built once per fixture so every prop that must keep its identity does. */
type View = {
  data: Fixture
  rows: readonly Row[]
  cells: readonly CacheCell[]
  labels: readonly string[]
  ticks: readonly string[]
}
const VIEWS = new Map<string, View>()
function viewOf(name: string | undefined, empty: boolean): View {
  const key = `${name ?? ''}|${empty}`
  const cached = VIEWS.get(key)
  if (cached !== undefined) return cached
  const data = fixtureOf(name)
  const rows = empty
    ? []
    : data.days.map((d): Row => ({ ...d, topText: d.top ?? DASH, why: whyOf(d) }))
  const cells = empty ? [] : data.cache
  const zero = cells.find((x) => x.share === 0)
  const view: View = {
    data,
    rows,
    cells,
    labels: rows.map((d) => d.label),
    ticks: [rows.find((d) => d.total === 0)?.label, zero?.label].flatMap((l) =>
      l === undefined ? [] : [l],
    ),
  }
  VIEWS.set(key, view)
  return view
}

// cycle-expression-14: the playground build has no React Compiler, and a Heatmap recompiles on a new accessor, so each one is hoisted
const cellRow = (x: CacheCell): string => x.caller
const cellCol = (x: CacheCell): string => x.label
const cellShare = (x: CacheCell): number | null => x.share
const cellState = (x: CacheCell): CellState | undefined =>
  x.share === null ? 'down' : x.share === 0 ? 'zero' : undefined
const SHARE_DOMAIN = [0, 100] as const
const percent = (v: number): string => `${fmt.number(v)} %`
const CELL_STATES = [
  { key: 'down', label: NOT_LOGGED, color: BASALT.hairline },
  { key: 'zero', label: 'No hits', tone: 'bad' },
] as const

export function ExprN64Scenario({ shotState, fixture }: ScenarioProps) {
  const { data, rows, cells, labels, ticks } = viewOf(fixture, shotState === 'empty')
  const live = shotState === undefined
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: ERROR_CAUSE, retry: () => undefined }
        : 'ready'

  const total = sum(rows, (d) => d.total)
  const refused = sum(rows, (d) => d.refused)
  const refusedBefore = sum(rows.slice(0, WEEK), (d) => d.refused)
  const refusedAfter = refused - refusedBefore
  const down = rows.find((d) => d.total === 0)
  const led = TARGETS.map((t) => ({ t, n: rows.filter((d) => d.top === t).length })).toSorted(
    (a, b) => b.n - a.n,
  )[0]
  const pickDays = rows.filter((d) => d.top !== null).length
  const reasons = REASONS.map((r) => ({ r, n: sum(rows, (d) => d[r]) })).toSorted(
    (a, b) => b.n - a.n,
  )[0]
  const worstDay = rows.toSorted((a, b) => b.refused - a.refused)[0]
  const cap = capOf(rows)

  const restVerdict: { tone: Tone; label: string } = {
    tone: 'neutral',
    label: live && led !== undefined ? `${led.t} led on ${led.n} of ${pickDays} days` : '',
  }
  const dayFocus = useChartFocus(rows, {
    announce: (d) => named(d.label, dayRead(d)),
  })

  const week = data.days.slice(0, WEEK)
  const shareBefore = mean(cells.filter((x) => week.some((d) => d.id === x.day)))
  const shareAfter = mean(cells.filter((x) => !week.some((d) => d.id === x.day)))
  const zeroCells = cells.filter((x) => x.share === 0)
  const zeroCell = zeroCells[0]
  const bestCell = cells.toSorted((a, b) => (b.share ?? -1) - (a.share ?? -1))[0]
  const cacheVerdict: { tone: Tone; label: string } =
    live && zeroCell !== undefined
      ? { tone: 'bad', label: zeroNote(zeroCell) }
      : { tone: 'neutral', label: live ? 'None at 0 %' : '' }
  const cellFocus = useChartFocus(cells, {
    announce: (x) => named(cellName(x), cellRead(x)),
  })

  const table = useDataTable({
    id: 'expr-n64-days',
    label: 'Targets and refusals per day',
    columns: [
      c.entity('label', { header: 'Day', mono: true, priority: 1, sortable: false }),
      c.text('topText', { header: 'Leader', priority: 2, sortable: false, card: 'subtitle' }),
      c.meter('refused', {
        header: 'Refused',
        max: Math.max(1, worstDay?.refused ?? 1),
        priority: 1,
        sortable: false,
        card: 'value',
      }),
      c.text('why', { header: 'Reason', priority: 2, sortable: false, card: 'meta' }),
    ],
    data: rows,
    getRowId: (d) => d.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: 14,
    empty: { cause: 'Nothing to list. A row appears with the first pick.' },
  })

  const figure = {
    value: live ? refused : null,
    unit: `${REFUSED} of ${live ? fmt.number(total) : ''} picks`,
    delta: {
      value: live ? signed(refusedAfter - refusedBefore) : '',
      polarity: refusedAfter === refusedBefore ? ('neutral' as const) : ('up-bad' as const),
      label: FIRST_WEEK,
    },
    period: dayFocus.readout('', (d) => d.label),
    periodMono: true,
    status: dayFocus.readout(restVerdict, (d) => ({ tone: 'neutral' as const, label: dayRead(d) })),
  }
  const footer = [
    {
      label: 'Top reason',
      value:
        live && reasons !== undefined && reasons.n > 0
          ? `${REASON_TEXT[reasons.r].toLowerCase()} ${reasons.n}`
          : live
            ? 'none'
            : '',
    },
    {
      label: 'Worst day',
      value:
        live && worstDay !== undefined && worstDay.refused > 0
          ? worstDay.label
          : live
            ? 'none'
            : '',
      mono: true,
    },
  ] as const

  const cacheFigure = {
    value: live ? mean(cells) : null,
    unit: '%',
    delta: {
      value: live ? signed(shareAfter - shareBefore, ' pts') : '',
      polarity: shareAfter === shareBefore ? ('neutral' as const) : ('up-good' as const),
      label: FIRST_WEEK,
    },
    period: cellFocus.readout('', cellName),
    periodMono: true,
    status: cellFocus.readout(cacheVerdict, (x) => ({
      tone: x.share === 0 ? ('bad' as const) : ('neutral' as const),
      label: cellRead(x),
    })),
  }
  const cacheFooter = [
    {
      label: `Best caller, ${live ? (bestCell?.share ?? '') : ''} %`,
      value: live ? (bestCell?.caller ?? '') : '',
      mono: true,
    },
    { label: 'Days at 0 %', value: live ? zeroCells.length : '' },
  ] as const

  return (
    <Page area="expr-n64">
      <PageBar title="Model router, last 14 days" />
      <div className="grid gap-3 @wide:grid-cols-2">
        <div className="min-w-0">
          <ChartCard
            title="Picks by day"
            subtitle="Blue marks a day another target led"
            phase={phase}
            empty={
              rows.length === 0
                ? {
                    cause:
                      'Nothing logged in this window. Check that the router writes to the gateway.',
                  }
                : null
            }
            height="tall"
            figure={figure}
            footer={footer}
            chart={(box) => (
              <Bars
                label="Targets per day, with refusals by reason"
                data={rows}
                height={box.height}
                focus={dayFocus}
                tooltip={false}
                x={{ value: (d) => d.label }}
                y={{
                  title: 'Picks',
                  ...(cap === undefined ? {} : { domain: [0, cap] as [number, number] }),
                }}
                zones={
                  down === undefined
                    ? []
                    : [
                        {
                          axis: 'x',
                          from: down.label,
                          to: down.label,
                          fill: alpha(BASALT.ink, 0.08),
                          label: 'Gateway down',
                        },
                      ]
                }
                series={[
                  { mark: 'bar', key: 'iu', label: 'iu', color: N64_SERIES.iu, y: (d) => d.iu },
                  {
                    mark: 'bar',
                    key: 'me',
                    label: 'me',
                    color: N64_SERIES.me,
                    y: (d) => d.me,
                    highlight: (d) => d.top === 'me',
                  },
                  {
                    mark: 'bar',
                    key: 'iuApi',
                    label: 'iu-api',
                    color: N64_SERIES.iuApi,
                    y: (d) => d.iuApi,
                    highlight: (d) => d.top === 'iu-api',
                  },
                  {
                    mark: 'bar',
                    key: 'quota',
                    label: REASON_TEXT.quota,
                    note: REFUSED,
                    color: N64_SERIES.quota,
                    y: (d) => d.quota,
                  },
                  {
                    mark: 'bar',
                    key: 'policy',
                    label: REASON_TEXT.policy,
                    note: REFUSED,
                    color: N64_SERIES.policy,
                    y: (d) => d.policy,
                  },
                  {
                    mark: 'bar',
                    key: 'down',
                    label: REASON_TEXT.down,
                    note: REFUSED,
                    color: N64_SERIES.down,
                    y: (d) => d.down,
                    values: true,
                  },
                ]}
              />
            )}
          />
        </div>
        <div className="min-w-0 @wide:col-span-2 @wide:row-start-2">
          <ChartCard
            title="Cache hits by caller"
            subtitle="Share served from cache, per day"
            phase={phase}
            empty={
              cells.length === 0
                ? { cause: 'No readings. Each pick reports its cache share.' }
                : null
            }
            figure={cacheFigure}
            footer={cacheFooter}
            chart={() => (
              <Heatmap<CacheCell, CellState>
                label="Hit share for each caller and day"
                data={cells}
                focus={cellFocus}
                matchHeight
                getRow={cellRow}
                getCol={cellCol}
                getValue={cellShare}
                rows={CALLERS}
                cols={labels}
                color={BASALT.ink}
                domain={SHARE_DOMAIN}
                tickCols={ticks}
                formatValue={percent}
                formatLegend={percent}
                getState={cellState}
                states={CELL_STATES}
              />
            )}
          />
        </div>
        <div className="min-w-0 @wide:col-start-2 @wide:row-start-1">
          <DataPanel
            title="Targets and refusals"
            subtitle="Leader and refusal reasons, per day"
            phase={phase}
            empty={null}
            bodySize={{ rows: 15 }}
            body={() => <DataTable table={table} focus={dayFocus} height="fill" />}
          />
        </div>
      </div>
    </Page>
  )
}
