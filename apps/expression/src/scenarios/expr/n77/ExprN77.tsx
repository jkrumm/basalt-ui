import { createFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Phase, Verdict } from 'basalt-ui/cards'
import { ChartCard, Heatmap, useChartFocus } from 'basalt-ui/charts'
import type { HeatmapState } from 'basalt-ui/charts'
import { Page, PageBar, useSizeClass } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import type { ScenarioProps } from '../../shot-state'
import { ALL, APPS, DAYS, cellsOf, jobsFor, longestStreak, rowsOf } from './fixture'
import type { AppRow, Cell, Job, Streak } from './fixture'

type CellState = 'clean' | 'idle' | 'unseen'

const FMT = createFormat()
const RETRY = (): void => undefined

const dayName = (day: string): string => {
  const at = new Date(day)
  return `${FMT.date(at, 'weekday')} ${FMT.date(at, 'day')}`
}
const clock = (iso: string): string =>
  FMT.time(new Date(iso), { hour: '2-digit', minute: '2-digit', hour12: false })

const getRow = (d: Cell): string => d.app
const getCol = (d: Cell): string => d.day
const getValue = (d: Cell): number | null => (d.failed > 0 ? d.failed : null)
const getState = (d: Cell): CellState | undefined => {
  if (!d.seen) return 'unseen'
  if (d.total === 0) return 'idle'
  if (d.failed > 0) return undefined
  return 'clean'
}
const annotate = (d: Cell): string | null => (d.failed > 0 ? String(d.failed) : null)
const appName = (app: string): string => (app === ALL ? 'all apps' : app)
const formatCol = (day: string): string => FMT.date(new Date(day), 'day')
const DOMAIN = [0, 4] as const
const formatCount = (v: number): string => (v >= DOMAIN[1] ? `${v}+` : String(v))
// cycle-expression-16: the kit thins a band axis unevenly once every day is named (7, 9, 11, 14, 17, 20 at 390) and has no container-class hook for a tick stride, so the narrow viewport names every third day itself
const STEP_DAYS: readonly string[] = DAYS.filter((_, i) => i % 3 === 0)
const stepCol = (day: string): string => (STEP_DAYS.includes(day) ? formatCol(day) : '')

const STATES: readonly HeatmapState<CellState>[] = [
  { key: 'clean', label: 'Clean', color: alpha(BASALT.inkMuted, 0.32) },
  { key: 'idle', label: 'No deploy', color: alpha(BASALT.inkFaint, 0.07) },
  {
    key: 'unseen',
    label: 'Past the cap',
    color: alpha(BASALT.inkMuted, 0.16),
    note: 'web before 10 Nov',
  },
]

const stateLabel = (key: CellState): string => STATES.find((s) => s.key === key)?.label ?? ''
const outcome = (n: { failed: number; landed: number }): string =>
  `${n.failed} failed, ${n.landed} landed`
/** The cell's reading: its state's word where it holds no job, else its counts. */
const reading = (d: Cell): string => {
  if (!d.seen) return stateLabel('unseen')
  if (d.total === 0) return stateLabel('idle')
  return outcome(d)
}

type Board = {
  jobs: Job[]
  rows: AppRow[]
  heatRows: string[]
  cells: Cell[]
  streak: Streak | null
}
const BOARDS = new Map<string, Board>()

/** One stable board per fixture, so the heat grid and the table keep their data identity across renders. */
function boardFor(name: string | undefined, empty: boolean): Board {
  const key = `${empty ? 'empty' : 'jobs'}:${name ?? ''}`
  const known = BOARDS.get(key)
  if (known !== undefined) return known
  const jobs = empty ? [] : jobsFor(name)
  const rows = rowsOf(jobs)
  const board = {
    jobs,
    rows,
    heatRows: [...rows.map((r) => r.app), ALL],
    cells: cellsOf(
      jobs,
      rows.map((r) => r.app),
    ),
    streak: longestStreak(jobs),
  }
  BOARDS.set(key, board)
  return board
}

const spanOutcome = (run: readonly Cell[]): string =>
  outcome({
    failed: run.reduce((n, x) => n + x.failed, 0),
    landed: run.reduce((n, x) => n + x.landed, 0),
  })

const c = col<AppRow>()
const j = col<Job>()
const FLIGHT_COLUMNS = [
  j.entity('app', { header: 'App', mono: true, priority: 1 }),
  j.status('status', {
    header: 'State',
    options: ['running', 'queued'],
    labels: { running: 'Running', queued: 'Queued' },
    tone: () => 'neutral',
    priority: 2,
  }),
  j.entity('tag', { header: 'Image tag', mono: true, sortable: false, priority: 2 }),
]
const COLUMNS = [
  c.entity('app', {
    header: 'App',
    mono: true,
    sortable: false,
    width: 'content',
    priority: 1,
  }),
  c.meter('landedPct', {
    header: 'Landed',
    max: 100,
    sortable: false,
    priority: 2,
    card: 'value',
  }),
  c.number('failed', { header: 'Failed', sortable: false, priority: 2, card: 'meta' }),
]

export function ExprN77Scenario({ shotState, fixture }: ScenarioProps) {
  const ready = shotState === undefined
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The runner did not answer within 10 s.', retry: RETRY }
        : 'ready'
  const empty = shotState === 'empty'
  const { jobs, rows, heatRows, cells, streak } = boardFor(fixture, empty)
  const flight = jobs.filter((x) => x.status === 'running' || x.status === 'queued')

  const focus = useChartFocus(cells, {
    columns: DAYS.length,
    announce: (d) => `${appName(d.app)}, ${dayName(d.day)}: ${reading(d)}`,
    announceSpan: (run) => `${appName(run[0]?.app ?? '')}: ${spanOutcome(run)}`,
  })

  const table = useDataTable({
    id: 'expr-n77-apps',
    label: 'Per app',
    columns: COLUMNS,
    data: rows,
    getRowId: (r) => r.app,
    mode: { kind: 'client' },
    phase,
    bodyRows: APPS.length,
    phone: 'columns',
  })

  const flightTable = useDataTable({
    id: 'expr-n77-flight',
    label: 'Waiting or active',
    columns: FLIGHT_COLUMNS,
    data: flight,
    getRowId: (x) => x.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: 3,
  })

  const failedTotal = rows.reduce((n, r) => n + r.failed, 0)
  const finishedTotal = rows.reduce((n, r) => n + r.finished, 0)
  const narrow = useSizeClass() === 'compact'

  const restStatus: Verdict = {
    tone: 'neutral',
    label: !ready
      ? ''
      : streak === null
        ? 'No failures'
        : streak.endedAt === null
          ? 'Not recovered yet'
          : `Recovered ${clock(streak.endedAt)}`,
  }
  const readStatus = (d: Cell): Verdict => {
    const run = focus.span
    if (run.length > 1) {
      return {
        tone: run.some((x) => x.failed > 0) ? 'bad' : 'neutral',
        label: spanOutcome(run),
      }
    }
    const tag = d.lastFailedTag === null ? '' : `, image ${d.lastFailedTag}`
    return { tone: d.failed > 0 ? 'bad' : 'neutral', label: `${reading(d)}${tag}` }
  }
  const restPeriod = ready && streak !== null ? `${streak.app}, ${dayName(streak.day)}` : ''
  const readPeriod = (d: Cell): string =>
    focus.span.length > 1 ? appName(d.app) : `${appName(d.app)}, ${dayName(d.day)}`

  return (
    <Page area="expr-n77">
      <PageBar title="Deploy board, last 14 days" />
      <div className="grid gap-3 @wide:grid-cols-2">
        <ChartCard
          title="Deploy failures by app and day"
          subtitle="200 newest jobs, UTC"
          phase={phase}
          height="tall"
          empty={empty ? { cause: 'No job in the list. A first run fills its day here.' } : null}
          figure={{
            value: ready ? (streak?.length ?? 0) : null,
            unit: ready ? 'failures in a row' : '',
            period: focus.readout(restPeriod, readPeriod),
            periodMono: true,
            status: focus.readout(restStatus, readStatus),
          }}
          footer={[{ label: 'Failed', value: ready ? `${failedTotal} of ${finishedTotal}` : '' }]}
          chart={(box) => (
            <Heatmap
              label="Count by app and day, one cell each"
              data={cells}
              height={box.height}
              rows={heatRows}
              cols={DAYS}
              getRow={getRow}
              getCol={getCol}
              getValue={getValue}
              getState={getState}
              states={STATES}
              annotate={annotate}
              color={BASALT.bad}
              domain={DOMAIN}
              formatRow={appName}
              formatCol={narrow ? stepCol : formatCol}
              formatValue={formatCount}
              formatLegend={formatCount}
              tickCols={narrow ? STEP_DAYS : DAYS}
              legend={{ label: 'Jobs per cell, the top color from 4' }}
              tooltip={false}
              focus={focus}
            />
          )}
        />
        <div className="flex flex-col gap-3">
          <DataPanel
            title="Apps"
            subtitle="Share that landed, per app"
            phase={phase}
            empty={
              empty
                ? {
                    cause:
                      'No app has a job yet, so there is no row to rank. The first job adds one.',
                  }
                : null
            }
            // cycle-expression-16: DataPanel's loading box counts phone cards per row even for a phone:'columns' table, so the 390 skeleton ran twice as tall as the loaded table; the narrow viewport states its height
            bodySize={narrow ? { height: 308 } : { rows: APPS.length + 1 }}
            body={() => (
              <DataTable
                table={table}
                height="fill"
                focusItems={{ focus, holds: (row, cell) => cell.app === row.app }}
              />
            )}
          />
          <DataPanel
            title="Unfinished jobs"
            subtitle="Running or queued on 20 Nov"
            phase={phase}
            empty={empty ? { cause: 'Nothing is open. A started job waits here.' } : null}
            // cycle-expression-16: DataPanel's loading box counts the header row as a phone card, so the 390 skeleton ran one card taller than the loaded list; the narrow viewport states its height
            bodySize={narrow ? { height: 204 } : { rows: 4 }}
            body={() => (
              <DataTable
                table={flightTable}
                height="fill"
                focusItems={{
                  focus,
                  holds: (job, cell) =>
                    cell.app === job.app && cell.day === job.startedAt.slice(0, 10),
                }}
              />
            )}
          />
        </div>
      </div>
    </Page>
  )
}
