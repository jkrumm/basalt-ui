import { useFormat } from 'basalt-ui'
import { DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, Sparkline, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N73_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { DAY, SLIPPED_STEPS, SLIP_LIMIT, STEP_NAMES, TODAY, usualGapDays, viewOf } from './fixture'
import type { DueRow, StepRow } from './fixture'

/** The last session stands six days back, so no item is more than five days late. */
const LATE_MAX = 6
const CONFIDENCE = [...STEP_NAMES, 'In progress'] as const

const c = col<DueRow>()
const COLUMNS = [
  c.entity('id', { header: 'Item', mono: true, sub: (r) => r.deck, priority: 1 }),
  c.meter('overdue', { header: 'Days overdue', max: LATE_MAX, priority: 1, card: 'value' }),
  c.status('confidence', {
    header: 'Confidence',
    options: CONFIDENCE,
    tone: (v) => (v === 'Forgotten' || v === 'Shaky' ? 'accent' : 'neutral'),
    priority: 2,
  }),
  c.number('interval', { header: 'Interval', unit: 'days', priority: 2 }),
  c.date('due', { header: 'Due', style: 'short', priority: 3 }),
]

const BAR_X = { value: (s: StepRow) => s.name, ticks: [...STEP_NAMES] }
const BAR_Y = { title: 'Items', domain: { floor: 0, pad: 0.12 } }
const BAR_SERIES = [
  {
    mark: 'bar',
    key: 'items',
    label: 'Count',
    color: N73_SERIES.items,
    y: (s: StepRow) => s.count,
    values: true,
    highlight: (s: StepRow) => s.slipped,
  },
] as const

const readStep = (s: StepRow): string => `${s.name}: ${s.count} learned, ${s.due} due`

// cycle-expression-15: frames that share one `retry` draw its button once, so each card of the items source takes a function of its own to keep its own Retry
const retryStrip = (): void => undefined
const retryChart = (): void => undefined
const retryTable = (): void => undefined
const retrySessions = (): void => undefined

const round1 = (n: number): number => Math.round(n * 10) / 10
const signed = (n: number, unit: string): string =>
  `${n > 0 ? '+' : n < 0 ? '\u2212' : ''}${Math.abs(n)}${unit}`

export function ExprN73Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const loading = shotState === 'loading'
  const failed = shotState === 'error'
  const settled = !loading && !failed
  const { items, sessions, steps, dueRows, daily } = viewOf(
    fixture,
    !settled || shotState === 'empty',
  )

  const itemsPhase = (retry: () => void): Phase =>
    failed
      ? { tag: 'error', message: 'The server did not answer.', retry }
      : loading
        ? 'loading'
        : 'ready'
  const sessionsPhase: Phase = failed
    ? { tag: 'error', message: 'The log did not answer.', retry: retrySessions }
    : loading
      ? 'loading'
      : 'ready'

  const learned = items.filter((i) => i.state === 'learned').length
  const slippedN = steps.filter((s) => s.slipped).reduce((n, s) => n + s.count, 0)
  const slipCap = Math.floor(learned * SLIP_LIMIT)
  const share = round1(learned === 0 ? 0 : (slippedN / learned) * 100)
  const limitPts = SLIP_LIMIT * 100
  const dueToday = dueRows.filter((r) => r.overdue === 0).length
  const lateN = dueRows.length - dueToday
  const started = items.filter((i) => i.due !== null)
  const nextDue = started
    .map((i) => i.due ?? TODAY)
    .filter((t) => t > TODAY)
    .sort((a, b) => a - b)[0]

  const lastSession = sessions.at(-1) ?? TODAY
  const idle = (TODAY - Math.floor(lastSession / DAY) * DAY) / DAY
  const lastDay = sessions.length === 0 ? '' : f.date(lastSession, 'day')
  const gap = usualGapDays(sessions)

  const focus = useChartFocus<StepRow>(steps, {
    announce: readStep,
  })

  const dueEmpty =
    items.length === 0
      ? 'No items yet. Add some to start.'
      : `Nothing is due. The next item is due on ${nextDue === undefined ? 'a later day' : f.date(nextDue, 'day')}.`

  const table = useDataTable({
    id: 'n73-due',
    label: 'Review list',
    columns: COLUMNS,
    data: dueRows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: failed ? 'ready' : itemsPhase(retryTable),
    bodyRows: 10,
  })

  const limitDelta = signed(round1(share - limitPts), ' pts')

  return (
    <Page area="expr-n73">
      <PageBar title="Review queue" />
      <div className="@container">
        <div className="grid gap-3 @wide:grid-cols-3">
          {/* cycle-expression-15: one StatGroup shows one error arm for all its cells, so the sessions source sits in a group of its own to keep its own banner and Retry */}
          <div className="@wide:col-span-2">
            <StatGroup variant="cards" label="Queue figures">
              <StatCell
                title="Due now"
                value={dueRows.length}
                unit="items"
                rows={[
                  { label: 'Today', value: dueToday },
                  { label: 'Overdue', value: lateN },
                ]}
                phase={itemsPhase(retryStrip)}
                empty={items.length === 0 ? { cause: 'Empty. Add an item.' } : null}
              />
              <StatCell
                title="Slipped share"
                subtitle="of learned"
                value={share}
                unit="%"
                delta={{
                  value: limitDelta,
                  polarity: share === limitPts ? 'neutral' : 'up-bad',
                  label: `vs ${limitPts} %`,
                }}
                rows={[
                  { label: 'Slipped', value: slippedN },
                  { label: 'Limit', value: slipCap },
                ]}
                meter={{
                  label: 'Share of learned',
                  value: share,
                  max: 40,
                  zones: [
                    { to: limitPts, tone: 'neutral', label: 'Under' },
                    { to: 40, tone: 'bad', label: 'Over' },
                  ],
                  format: (v) => `${v} %`,
                }}
                phase={itemsPhase(retryStrip)}
                empty={items.length === 0 ? { cause: 'No share. Rate one.' } : null}
              />
            </StatGroup>
          </div>
          <StatGroup variant="cards" label="Session figures">
            <StatCell
              title="Last session"
              value={idle}
              unit="days ago"
              sub={lastDay}
              subMono
              chart={(box) => (
                // cycle-expression-15: the lint does not know StatCell's 28 px chart slot (StatCard's is allowed)
                <Sparkline
                  height={box.height}
                  label="Sessions per day, last eight weeks"
                  points={daily}
                />
              )}
              rows={[
                { label: 'Sessions', value: f.number(sessions.length) },
                { label: 'Usual gap', value: `${gap} ${gap === 1 ? 'day' : 'days'}` },
              ]}
              phase={sessionsPhase}
              empty={sessions.length === 0 ? { cause: 'None yet. Start one.' } : null}
            />
          </StatGroup>
        </div>
      </div>
      <div className="@container">
        <div className="grid gap-3 @wide:grid-cols-2">
          {/* cycle-expression-15: no ChartCard `legend` entry for the highlighted bars: any `legend` on this Bars chart loops the plot measure (React error 185); the zone label names the accent instead */}
          <ChartCard
            title="Confidence by step"
            height="tall"
            phase={itemsPhase(retryChart)}
            empty={items.length === 0 ? { cause: 'Nothing to chart. Rate one.' } : null}
            figure={{
              value: learned,
              unit: 'learned',
              delta: {
                value: f.percent(learned / Math.max(items.length, 1), { maximumFractionDigits: 0 }),
                polarity: 'neutral',
                label: `of all ${items.length}`,
              },
              period: focus.readout('All steps', readStep),
            }}
            footer={[
              { label: 'In progress', value: items.filter((i) => i.state === 'progress').length },
              { label: 'Not started', value: items.filter((i) => i.state === 'new').length },
            ]}
            chart={() => (
              <Bars
                label="Count at each step from unrated to fluent"
                data={steps}
                focus={focus}
                tooltip={false}
                x={BAR_X}
                y={BAR_Y}
                series={BAR_SERIES}
                zones={[
                  {
                    axis: 'x',
                    from: STEP_NAMES[SLIPPED_STEPS[0] ?? 1] ?? 'Forgotten',
                    to: STEP_NAMES[SLIPPED_STEPS[1] ?? 2] ?? 'Shaky',
                    fill: alpha(BASALT.brand, 0.1),
                    label: 'Forgotten or shaky',
                  },
                ]}
              />
            )}
          />
          <DataPanel
            title="Items to review"
            subtitle="Most overdue first"
            phase={itemsPhase(retryTable)}
            empty={dueRows.length === 0 ? { cause: dueEmpty } : null}
            bodySize={{ rows: 18 }}
            body={() => (
              <DataTable
                table={table}
                height="fill"
                focusItems={{ focus, holds: (row, s) => row.step === s.step }}
              />
            )}
          />
        </div>
      </div>
    </Page>
  )
}
