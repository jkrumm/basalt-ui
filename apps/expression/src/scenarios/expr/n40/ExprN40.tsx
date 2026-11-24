/**
 * Expression n40: what the task list asks of today. Which tasks are overdue, how much is due today
 * and which list keeps growing: three figures, the due dates one dot per task beside the table of
 * the same tasks (one focus), the weekly backlog per list, and the 30-day pace as the baseline.
 * `?fixture=clear` is a list with nothing late or due; `?fixture=backlog` lets much of it slip, one
 * task by 212 days.
 */
import { text } from '@tanstack/charts/text'
import { useFormat } from 'basalt-ui'
import { DataPanel, StatCard } from 'basalt-ui/cards'
import type { Delta, Empty, Fact, Phase, Verdict } from 'basalt-ui/cards'
import {
  Bars,
  CartesianChart,
  ChartCard,
  Lines,
  chartLabels,
  useChartFocus,
} from 'basalt-ui/charts'
import type { LineSeries } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { alpha, BASALT } from 'basalt-ui/tokens'
import { TASK_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  DAY,
  LISTS,
  TODAY,
  backlogByWeek,
  completedPerDay,
  isDated,
  leaderOf,
  paceOf,
  summaryOf,
  tasksOf,
  variantOf,
} from './tasks'
import type { DatedTask, Done, Task, TaskState, WeekPoint } from './tasks'

type Model = ReturnType<typeof modelOf>

function modelOf(tasks: readonly Task[]) {
  const weeks = backlogByWeek(tasks)
  return {
    tasks,
    dated: tasks.filter(isDated),
    summary: summaryOf(tasks),
    weeks,
    leader: leaderOf(weeks),
  }
}

const MODELS = {
  rest: modelOf(tasksOf(undefined)),
  clear: modelOf(tasksOf('clear')),
  backlog: modelOf(tasksOf('backlog')),
  empty: modelOf([]),
}
const DONE = completedPerDay()
const PACE = paceOf(DONE)

const EMPTY = {
  overdue: { cause: 'No open tasks, so nothing is overdue.' },
  today: { cause: 'No open tasks, so nothing is due today.' },
  dates: { cause: 'No open tasks to place by date. Add one and give it a due date.' },
  table: { cause: 'No open tasks. Add one to a list and it shows here.' },
  backlog: { cause: 'No open tasks, so no list has a backlog. Add tasks to your lists.' },
} satisfies Record<string, Empty>
const FAILED: Phase = {
  tag: 'error',
  message: 'The task service did not answer.',
  retry: () => undefined,
}

/** A task's dot: moved one minute per stacked task so every task has its own x. */
const atOf = (t: DatedTask): Date => new Date(t.due + (t.stack - 1) * 60_000)

const c = col<Task>()

function columnsOf(oldest: number, dueOf: (t: Task) => string) {
  return [
    c.entity('title', { header: 'Task', priority: 1, sub: dueOf, subMono: true }),
    c.meter('daysLate', { header: 'Days past due', max: Math.max(1, oldest), priority: 1 }),
    c.text('list', { header: 'List', priority: 2 }),
    c.text('priority', { header: 'Priority', priority: 3 }),
  ]
}

export function ExprN40Scenario({ shotState, fixture }: ScenarioProps) {
  const model = shotState === 'empty' ? MODELS.empty : MODELS[variantOf(fixture) ?? 'rest']
  const phase: Phase =
    shotState === 'loading' ? 'loading' : shotState === 'error' ? FAILED : 'ready'
  return (
    <Page area="expr-n40">
      <PageBar title="Tasks across five lists" />
      <Board model={model} phase={phase} />
    </Page>
  )
}

function Board({ model, phase }: { model: Model; phase: Phase }) {
  const fmt = useFormat()
  const { tasks, dated, summary, weeks, leader } = model
  const whenNone = (cause: Empty): Empty | null => (tasks.length === 0 ? cause : null)
  const one = (n: number): string => fmt.number(Math.abs(n), { maximumFractionDigits: 1 })
  // cycle-expression-10: useFormat has no signed number, so the sign and the true minus are written here.
  const signed = (n: number): string => `${n > 0 ? '+' : n < 0 ? '\u2212' : ''}${one(n)}`
  const days = (n: number): string => `${one(n)} ${n === 1 ? 'day' : 'days'}`
  const day = (at: number): string =>
    fmt.date(at, 'short', { day: 'numeric', month: 'short', year: undefined })
  // cycle-expression-10: a footer keeps its value in the empty phase (only error holds it), so a dash is passed until there are rows.
  const fact = (label: string, value: string | number): Fact => ({
    label,
    value: tasks.length === 0 ? '\u2014' : value,
  })

  const dueWord = (t: Task): string => {
    if (t.state === 'overdue') return `${days(t.daysLate ?? 0)} late`
    if (t.due === null) return 'no due date'
    if (t.state === 'today') return 'due today'
    return `due ${day(t.due)}`
  }
  const focus = useChartFocus(dated, {
    announce: (t) => `${t.title}: ${t.list}, ${dueWord(t)}, ${t.priority}`,
  })
  const weekFocus = useChartFocus(weeks, {
    announce: (w) => `${day(w.at)}: ${LISTS.map((l) => `${l} ${w.counts[l]}`).join(', ')}`,
  })
  const doneRows = DONE.map((d) => ({ ...d, label: day(d.day) }))
  const doneFocus = useChartFocus(doneRows, {
    announce: (d) => `${d.label}: ${d.done} tasks done`,
  })
  const table = useDataTable({
    id: 'expr-n40-tasks',
    label: 'Open tasks',
    columns: columnsOf(summary.oldestLate, (t) =>
      t.due === null ? 'no due date' : t.state === 'today' ? 'due today' : `due ${day(t.due)}`,
    ),
    data: tasks,
    getRowId: (t) => t.id,
    mode: { kind: 'client' },
    now: TODAY,
  })

  const overdueDays = summary.overdue / Math.max(0.1, PACE.perDay)
  const overdueStatus: Verdict =
    summary.overdue === 0
      ? { tone: 'neutral', label: 'Nothing late' }
      : {
          tone: 'bad',
          label: summary.overOneMonth > 0 ? `${summary.overOneMonth} over a month` : 'Past due',
        }
  const todayStatus: Verdict =
    summary.today === 0
      ? { tone: 'neutral', label: 'Nothing due' }
      : { tone: 'accent', label: `${summary.todayFirst} priority 1` }
  const nothingDue = summary.listsWithNothingDue.join(', ')

  const peak = Math.max(1, ...dated.map((t) => t.stack))
  const firstDue = dated[0]?.due
  const lastDue = dated.at(-1)?.due
  // cycle-expression-10: the x domain does not widen for a refLine, so the window is set to hold today when nothing is late.
  const window: [Date, Date] = [
    new Date(Math.min(firstDue ?? TODAY, TODAY) - 2 * DAY),
    new Date(Math.max(lastDue ?? TODAY, TODAY) + 2 * DAY),
  ]
  const stackOf = (t: DatedTask, state: TaskState): number | null =>
    t.state === state ? t.stack : null
  // cycle-expression-10: the time axis picks its own date ticks (irregular at 390), so a fortnightly list anchored on today is built here.
  const tickStep = (window[1].getTime() - window[0].getTime() > 120 * DAY ? 42 : 14) * DAY
  const firstTick = TODAY - Math.floor((TODAY - window[0].getTime()) / tickStep) * tickStep
  const dateTicks = Array.from(
    { length: Math.floor((window[1].getTime() - firstTick) / tickStep) + 1 },
    (_, i) => new Date(firstTick + i * tickStep),
  )
  // cycle-expression-10: no kit label marks the tasks past a threshold, so the ones over a month late are named with text marks placed by chartLabels.
  const lateMarks = CartesianChart.custom<DatedTask>((plot) => {
    const reach = 4
    const dots = plot.data.flatMap((t) => {
      const px = plot.x(atOf(t))
      return px === null
        ? []
        : [{ left: px - reach, top: plot.y(t.stack) - reach, width: 2 * reach, height: 2 * reach }]
    })
    const late = plot.rows('overdue').filter((t) => (t.daysLate ?? 0) > 30)
    const byId = new Map(late.map((t) => [t.id, t]))
    const { placed } = chartLabels.place(
      late.map((t) => ({
        key: t.id,
        text: `${t.daysLate} d`,
        x: plot.x(atOf(t)) ?? 0,
        y: plot.y(t.stack),
      })),
      { width: plot.plotWidth, height: plot.plotHeight },
      { obstacles: dots, gap: reach + 3 },
    )
    return [
      text(placed, {
        x: (l) => {
          const t = byId.get(l.key)
          return t === undefined ? new Date(TODAY) : atOf(t)
        },
        y: (l) => byId.get(l.key)?.stack ?? 1,
        text: (l) => l.text,
        dx: (l) => l.dx,
        dy: (l) => l.dy,
        anchor: (l) => l.textAnchor,
        fill: BASALT.ink,
        fontSize: BASALT.text.micro,
      }),
    ]
  })

  const gainAt = (w: WeekPoint): Delta | undefined => {
    const before = weeks[weeks.indexOf(w) - 4]
    if (before === undefined) return undefined
    const gain = w.counts[leader.list] - before.counts[leader.list]
    return { value: signed(gain), label: 'in 4 weeks', polarity: gain > 0 ? 'up-bad' : 'neutral' }
  }
  const growing = leader.gain > 0
  const growthNow: Delta = {
    value: signed(leader.gain),
    label: 'in 4 weeks',
    polarity: growing ? 'up-bad' : 'neutral',
  }
  const lines = LISTS.map((list): LineSeries<WeekPoint> => ({
    mark: 'line',
    key: list,
    label: list,
    color: growing && list === leader.list ? TASK_SERIES.grows : TASK_SERIES.lists,
    weight: growing && list === leader.list ? 'strong' : 'quiet',
    y: (w) => w.counts[list],
  }))
  const addedLately = tasks.filter((t) => t.created > TODAY - 28 * DAY).length
  const weekTicks = doneRows
    .filter((_, i) => i % 7 === 0 || i === doneRows.length - 1)
    .map((d) => d.label)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <CardGrid min="regular" narrow="stack">
        <StatCard
          title="Overdue"
          info="Open tasks past their due date. Fewer is better."
          value={summary.overdue}
          unit="tasks"
          delta={{
            value: signed(summary.overdue - PACE.perDay),
            label: 'vs done a day',
            polarity: summary.overdue > PACE.perDay ? 'up-bad' : 'neutral',
          }}
          status={overdueStatus}
          footer={[
            fact('Priority 1', summary.overdueFirst),
            fact('Clears in', `≈ ${days(overdueDays)}`),
          ]}
          phase={phase}
          empty={whenNone(EMPTY.overdue)}
        />
        <StatCard
          title="Due today"
          info="Open tasks due today. Fewer than the tasks you finish a day is good."
          value={summary.today}
          unit="tasks"
          delta={{
            value: signed(summary.today - PACE.perDay),
            label: 'vs done a day',
            polarity: summary.today > PACE.perDay ? 'up-bad' : 'neutral',
          }}
          status={todayStatus}
          footer={[
            fact('Tomorrow', summary.tomorrow),
            fact('Nothing due', nothingDue === '' ? 'None' : nothingDue),
          ]}
          phase={phase}
          empty={whenNone(EMPTY.today)}
        />
      </CardGrid>
      <div className="grid gap-4 @wide:grid-cols-2">
        <ChartCard
          title="Due dates"
          subtitle="One dot per open task, stacked by due day"
          // cycle-expression-10: a DataPanel body is a fixed box and cannot follow the card beside it, so this card fills the row the panel's rows set.
          height="fill"
          figure={{
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n40, kept as its builder left it: its figure follows focus, built before figure-readout
            value: focus.readout(String(summary.nextWeek), dueWord),
            unit: focus.readout<string | undefined>('due in 7 days', (t) => t.list),
            // cycle-expression-10: the loading skeleton always draws a period row (18 px at 390), so every card fills its period slot at rest.
            period: focus.readout<string | undefined>(
              `of ${dated.length} with a date`,
              (t) => t.title,
            ),
          }}
          footer={[
            fact('No due date', summary.undated),
            fact('Later than 7 days', summary.afterNextWeek),
          ]}
          phase={phase}
          empty={whenNone(EMPTY.dates)}
          chart={(box) => (
            <CartesianChart<DatedTask>
              label="Open tasks by due date, one dot per task, stacked by day"
              summary={`${summary.overOneMonth} of ${summary.overdue} overdue tasks are more than a month late.`}
              height={box.height}
              data={dated}
              focus={focus}
              cursor="expr-n40-due"
              tooltip={false}
              // cycle-expression-10: arrow keys ride the x cursor and map back to the first item at that x, so stacked dots (one due day) were unreachable; each stacked task is moved one minute so every item has its own x.
              x={{ value: atOf, domain: window, ticks: dateTicks }}
              y={{ title: 'Tasks due that day', domain: { floor: 0, ceil: peak + 1 } }}
              series={[
                {
                  mark: 'dot',
                  key: 'overdue',
                  label: 'Overdue',
                  color: TASK_SERIES.overdue,
                  legend: false,
                  r: () => 3,
                  y: (t) => stackOf(t, 'overdue'),
                },
                {
                  mark: 'dot',
                  key: 'today',
                  label: 'Today',
                  color: TASK_SERIES.today,
                  legend: false,
                  r: () => 3,
                  y: (t) => stackOf(t, 'today'),
                },
                {
                  mark: 'dot',
                  key: 'later',
                  label: 'Later',
                  color: TASK_SERIES.later,
                  r: () => 3,
                  y: (t) => stackOf(t, 'later'),
                },
              ]}
              zones={
                firstDue === undefined || summary.overdue === 0
                  ? []
                  : [
                      {
                        axis: 'x',
                        from: new Date(firstDue),
                        to: new Date(TODAY),
                        fill: alpha(BASALT.bad, 0.08),
                        label: 'Overdue',
                      },
                    ]
              }
              refLines={[
                { axis: 'x', value: new Date(TODAY), color: TASK_SERIES.rule, label: 'Today' },
              ]}
              marks={lateMarks}
            />
          )}
        />
        <DataPanel
          title="Open tasks"
          subtitle="By due date, oldest first"
          phase={phase}
          empty={whenNone(EMPTY.table)}
          bodySize={{ rows: 11 }}
          body={() => <DataTable table={table} focus={focus} height="fill" />}
        />
      </div>
      <div className="grid gap-4 @wide:grid-cols-2">
        <ChartCard
          title="Backlog by list"
          subtitle="Open tasks by the day each was added"
          height="short"
          figure={{
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n40, kept as its builder left it: its figure follows focus, built before figure-readout
            value: weekFocus.readout(String(leader.now), (w) => String(w.counts[leader.list])),
            unit: `in ${leader.list}`,
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n40, kept as its builder left it: its figure follows focus, built before figure-readout
            delta: weekFocus.readout<Delta | undefined>(growthNow, gainAt),
            period: weekFocus.readout<string | undefined>(
              `by ${day(TODAY)}`,
              (w) => `by ${day(w.at)}`,
            ),
          }}
          footer={[fact('Added in 4 weeks', addedLately), fact('Open now', summary.open)]}
          phase={phase}
          empty={whenNone(EMPTY.backlog)}
          chart={(box) => (
            <Lines
              label="Open tasks per list over 12 weeks, by the day each was added"
              height={box.height}
              data={weeks}
              focus={weekFocus}
              cursor="expr-n40-backlog"
              tooltip={false}
              naming="endLabels"
              // cycle-expression-10: end labels sit on the lines where they converge, so the axis runs 12 days past the last week to give them clear space.
              x={{
                value: (w) => new Date(w.at),
                domain: [new Date(weeks[0]?.at ?? TODAY), new Date(TODAY + 12 * DAY)],
              }}
              y={{ title: 'Open tasks', domain: { floor: 0 } }}
              series={lines}
            />
          )}
        />
        <ChartCard
          title="Done per day"
          subtitle="Tasks completed, to yesterday"
          height="short"
          figure={{
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n40, kept as its builder left it: its figure follows focus, built before figure-readout
            value: doneFocus.readout(one(PACE.perDay), (d) => String(d.done)),
            unit: doneFocus.readout('a day', () => 'done'),
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n40, kept as its builder left it: its figure follows focus, built before figure-readout
            delta: doneFocus.readout<Delta>(
              {
                value: signed(PACE.change),
                label: 'vs the 15 days before',
                polarity: 'neutral',
              },
              (d) => ({
                value: signed(d.done - PACE.perDay),
                label: 'vs average',
                polarity: 'neutral',
              }),
            ),
            period: doneFocus.readout<string | undefined>('30-day average', (d) => d.label),
          }}
          footer={[
            { label: 'Idle days', value: PACE.idleDays },
            { label: 'Busiest', value: `${PACE.busiest.done}, ${day(PACE.busiest.day)}` },
          ]}
          phase={phase}
          chart={(box) => (
            <Bars<Done & { label: string }>
              label="Tasks done per day over the last 30 days"
              height={box.height}
              data={doneRows}
              focus={doneFocus}
              cursor="expr-n40-done"
              tooltip={false}
              x={{ value: (d) => d.label, ticks: weekTicks }}
              y={{ title: 'Tasks done' }}
              refLines={[
                { value: PACE.perDay, color: TASK_SERIES.rule, dashed: true, label: 'Average' },
              ]}
              series={[
                {
                  mark: 'bar',
                  key: 'done',
                  label: 'Done',
                  color: TASK_SERIES.done,
                  values: true,
                  y: (d) => d.done,
                },
              ]}
            />
          )}
        />
      </div>
    </div>
  )
}
