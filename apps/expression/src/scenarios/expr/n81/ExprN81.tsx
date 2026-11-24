import { useState } from 'react'
import { useFormat } from 'basalt-ui'
import type { Format } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { alpha, BASALT } from 'basalt-ui/tokens'
import { N81_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { studyFor } from './fixture'
import type { Item, Status, Study } from './fixture'

type Source = 'sessions' | 'items' | 'reviews'

const SOURCES: readonly Source[] = ['sessions', 'items', 'reviews']
const LOST: Record<Source, string> = {
  sessions: 'The session log did not answer.',
  items: 'The catalogue did not answer.',
  reviews: 'The review schedule did not answer.',
}

const LEVELS = [1, 2, 3, 4, 5]
/** The confidence axis stops here; the unrated stack is the kit's off-scale caret. */
const CONFIDENCE_CAP = 8
const REVIEW_SPAN = 7
const DAY_MS = 86_400_000

type DayRow = { day: string; top: number; rest: number; total: number }
type LevelRow = { key: string; done: number; learning: number; notStarted: number; total: number }
type ReviewRow = { day: string; due: number; later: number; total: number }
type ItemRow = {
  id: string
  name: string
  status: Status
  confidence: number | null
  level: string
  sessions: number
  lastOn: string | null
}

const STATUS_LABEL: Record<Status, string> = {
  done: 'Done',
  learning: 'Learning',
  notStarted: 'Not started',
}
const STATUS_OPTIONS: readonly Status[] = ['done', 'learning', 'notStarted']

const c = col<ItemRow>()
const COLUMNS = [
  c.entity('name', { header: 'Item', priority: 1 }),
  c.status('status', {
    header: 'Status',
    options: STATUS_OPTIONS,
    labels: STATUS_LABEL,
    tone: () => 'neutral',
    priority: 2,
  }),
  c.meter('confidence', { header: 'Confidence', max: 5, card: 'value', priority: 1 }),
  c.meter('sessions', { header: 'Sessions', max: 25, card: 'detail', priority: 2 }),
  // cycle-expression-17: c.date types style 'day' (DateStyle) but the table kind rejects it at runtime, so the default style stays
  c.date('lastOn', { header: 'Practised', mono: true, priority: 3 }),
]

const noun = (f: Format, n: number, one: string, many: string): string =>
  f.plural(n) === 'one' ? one : many

const parseDay = (day: string): Date => new Date(`${day}T00:00:00Z`)
const shiftDay = (day: string, by: number): string =>
  new Date(parseDay(day).getTime() + by * DAY_MS).toISOString().slice(0, 10)

function practiceRows(study: Study, topId: string): DayRow[] {
  return study.days.map((day) => {
    const on = study.sessions.filter((s) => s.day === day)
    const top = on.filter((s) => s.itemId === topId).length
    return { day, top, rest: on.length - top, total: on.length }
  })
}

function topItem(study: Study): Item | undefined {
  const tally = new Map<string, number>()
  for (const s of study.sessions) tally.set(s.itemId, (tally.get(s.itemId) ?? 0) + 1)
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
  return study.items.find((i) => i.id === best?.[0])
}

/** One text for a level: the confidence, or 'None' for an item without one. */
const levelKey = (confidence: number | null): string =>
  confidence === null ? 'None' : String(confidence)

function levelRows(items: readonly Item[]): LevelRow[] {
  const count = (status: Status, level: number | null): number =>
    items.filter((i) => i.status === status && i.confidence === level).length
  const row = (key: string, level: number | null): LevelRow => {
    const done = count('done', level)
    const learning = count('learning', level)
    const notStarted = count('notStarted', level)
    return { key, done, learning, notStarted, total: done + learning + notStarted }
  }
  return [...LEVELS.map((level) => row(String(level), level)), row(levelKey(null), null)]
}

function reviewRows(study: Study): ReviewRow[] {
  return Array.from({ length: REVIEW_SPAN * 2 + 1 }, (_, i) => {
    const day = shiftDay(study.today, i - REVIEW_SPAN)
    const on = study.reviews.filter((r) => r.dueOn === day).length
    const due = day <= study.today ? on : 0
    return { day, due, later: on - due, total: on }
  })
}

/** Weakest first: rated items by confidence, then graded without one, then not started. */
function itemRows(study: Study): ItemRow[] {
  const rank = (i: Item): number => i.confidence ?? (i.graded ? 6 : 7)
  return [...study.items]
    .sort((a, b) => rank(a) - rank(b))
    .map((i) => ({
      id: i.id,
      name: i.name,
      status: i.status,
      confidence: i.confidence,
      level: levelKey(i.confidence),
      sessions: study.sessions.filter((s) => s.itemId === i.id).length,
      lastOn: study.sessions.findLast((s) => s.itemId === i.id)?.day ?? null,
    }))
}

const sum = (rows: readonly DayRow[]): number => rows.reduce((n, r) => n + r.total, 0)

export function ExprN81Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const study = studyFor(fixture, shotState === 'empty')
  const [failed, setFailed] = useState<readonly Source[]>(shotState === 'error' ? SOURCES : [])

  const retries: Record<Source, () => void> = {
    sessions: () => setFailed((list) => list.filter((s) => s !== 'sessions')),
    items: () => setFailed((list) => list.filter((s) => s !== 'items')),
    reviews: () => setFailed((list) => list.filter((s) => s !== 'reviews')),
  }
  const phaseOf = (source: Source): Phase => {
    if (shotState === 'loading') return 'loading'
    if (!failed.includes(source)) return 'ready'
    return { tag: 'error', message: LOST[source], retry: retries[source] }
  }
  const practicePhase = phaseOf('sessions')
  const itemsPhase = phaseOf('items')
  const reviewsPhase = phaseOf('reviews')

  const top = topItem(study)
  const days = practiceRows(study, top?.id ?? '')
  const levels = levelRows(study.items)
  const reviews = reviewRows(study)
  const items = itemRows(study)
  const rated = study.items.filter((i) => i.confidence !== null)
  const mean = rated.reduce((n, i) => n + (i.confidence ?? 0), 0) / Math.max(rated.length, 1)
  const gradedUnrated = study.items.filter((i) => i.graded && i.confidence === null).length
  const half = Math.floor(days.length / 2)
  const topSessions = days.reduce((n, d) => n + d.top, 0)
  const dueNow = study.reviews
    .filter((r) => r.dueOn <= study.today)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
  const later = study.reviews.filter((r) => r.dueOn > study.today)
  const nameOf = (id: string): string => study.items.find((i) => i.id === id)?.name ?? ''
  const dayLabel = (day: string): string =>
    day === study.today ? 'Today' : f.date(parseDay(day), 'day')

  const practiceFocus = useChartFocus(days, {
    announce: (d) =>
      `${dayLabel(d.day)}: ${d.total} ${noun(f, d.total, 'session', 'sessions')}, ${d.top} on ${top?.name ?? 'the top item'}`,
  })
  const confidenceFocus = useChartFocus(levels, {
    announce: (d) => `${d.key}: ${d.total} ${noun(f, d.total, 'item', 'items')}`,
  })
  const reviewFocus = useChartFocus(reviews, {
    announce: (d) => `${dayLabel(d.day)}: ${d.total} ${noun(f, d.total, 'review', 'reviews')}`,
  })

  const table = useDataTable({
    id: 'n81-items',
    label: 'Study catalogue',
    columns: COLUMNS,
    data: items,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    phase: itemsPhase,
    bodyRows: 8,
  })

  return (
    <Page area="study-stats">
      <PageBar title="Study stats" />
      <CardGrid min="regular">
        <div className="grid @wide:col-span-2">
          <ChartCard
            title="Practice"
            subtitle="Per day, last 30 days"
            height="tall"
            phase={practicePhase}
            empty={
              study.sessions.length === 0
                ? { cause: 'No session yet. Start one and its day appears here.' }
                : null
            }
            figure={{
              value: practicePhase === 'ready' ? study.sessions.length : '',
              unit: 'sessions',
              delta: {
                value:
                  practicePhase === 'ready'
                    ? f.number(sum(days.slice(half)) - sum(days.slice(0, half)), {
                        signDisplay: 'exceptZero',
                      })
                    : '',
                polarity: 'up-good',
                label: 'vs the 15 before',
              },
              period: practiceFocus.readout(
                '',
                (d) => `${dayLabel(d.day)}, ${d.total} ${noun(f, d.total, 'session', 'sessions')}`,
              ),
            }}
            footer={[
              {
                label: 'Most practised',
                value: practicePhase === 'ready' ? (top?.name ?? '') : '',
              },
              {
                label: 'Its share',
                value:
                  practicePhase === 'ready' ? f.percent(topSessions / study.sessions.length) : '',
              },
            ]}
            chart={() => (
              <Bars
                label="Sessions per day, the busiest name against the rest"
                data={days}
                focus={practiceFocus}
                tooltip={false}
                cursor="n81-practice"
                x={{
                  value: (d) => d.day,
                  format: (k) => dayLabel(String(k)),
                  ticks: [days[0]?.day ?? '', days[half]?.day ?? '', days.at(-1)?.day ?? ''],
                }}
                y={{ title: 'Sessions' }}
                zones={[
                  {
                    axis: 'x',
                    from: days[half]?.day ?? '',
                    to: days.at(-1)?.day ?? '',
                    fill: alpha(BASALT.ink, 0.05),
                    label: 'Last 15 days',
                  },
                ]}
                series={[
                  {
                    mark: 'bar',
                    key: 'rest',
                    label: 'The rest',
                    color: N81_SERIES.rest,
                    y: (d) => d.rest,
                  },
                  {
                    mark: 'bar',
                    key: 'top',
                    label: top?.name ?? '',
                    color: N81_SERIES.top,
                    y: (d) => d.top,
                  },
                ]}
              />
            )}
          />
        </div>
        <ChartCard
          title="Confidence"
          subtitle="Across the catalogue"
          height="tall"
          phase={itemsPhase}
          empty={
            rated.length === 0
              ? { cause: 'Nothing is set yet. Grade a review, then set one.' }
              : null
          }
          figure={{
            value: itemsPhase === 'ready' ? f.number(mean, { maximumFractionDigits: 1 }) : '',
            unit: 'of 5',
            period: confidenceFocus.readout(
              'On average',
              (d) => `${d.key}: ${d.total} ${noun(f, d.total, 'item', 'items')}`,
            ),
          }}
          footer={[
            { label: 'Set', value: itemsPhase === 'ready' ? rated.length : '' },
            { label: 'Graded, none set', value: itemsPhase === 'ready' ? gradedUnrated : '' },
          ]}
          chart={() => (
            <Bars
              label="Count at each confidence from 1 to 5 and unset, stacked by status"
              data={levels}
              focus={confidenceFocus}
              tooltip={false}
              cursor="n81-confidence"
              x={{ value: (d) => d.key }}
              y={{ title: 'Items', domain: [0, CONFIDENCE_CAP] }}
              series={[
                {
                  mark: 'bar',
                  key: 'done',
                  label: STATUS_LABEL.done,
                  color: N81_SERIES.done,
                  y: (d) => d.done,
                },
                {
                  mark: 'bar',
                  key: 'learning',
                  label: STATUS_LABEL.learning,
                  color: N81_SERIES.learning,
                  y: (d) => d.learning,
                },
                {
                  mark: 'bar',
                  key: 'notStarted',
                  label: STATUS_LABEL.notStarted,
                  color: N81_SERIES.notStarted,
                  y: (d) => d.notStarted,
                  values: (_v, d) => String(d.total),
                },
              ]}
            />
          )}
        />
        <ChartCard
          title="Reviews"
          subtitle="Per day, a week either side"
          phase={reviewsPhase}
          empty={
            study.reviews.length === 0
              ? { cause: 'No review is scheduled. A graded review schedules the next.' }
              : null
          }
          figure={{
            value: reviewsPhase === 'ready' ? dueNow.length : '',
            unit: 'due now',
            delta: {
              value: reviewsPhase === 'ready' ? `${dueNow.length} of ${study.reviews.length}` : '',
              polarity: 'neutral',
              label: 'scheduled',
            },
            period: reviewFocus.readout(
              '',
              (d) => `${dayLabel(d.day)}, ${d.total} ${noun(f, d.total, 'review', 'reviews')}`,
            ),
          }}
          footer={[
            {
              label: 'Waiting',
              value: reviewsPhase === 'ready' ? dueNow.map((r) => nameOf(r.itemId)).join(', ') : '',
            },
            {
              label: 'Next',
              value: reviewsPhase === 'ready' ? (later[0] ? nameOf(later[0].itemId) : '') : '',
            },
          ]}
          chart={() => (
            <Bars
              label="Reviews per day, a week before today to a week after"
              data={reviews}
              focus={reviewFocus}
              tooltip={false}
              cursor="n81-reviews"
              x={{
                value: (d) => d.day,
                format: (k) => dayLabel(String(k)),
                ticks: [...new Set([...study.reviews.map((r) => r.dueOn), study.today])].sort(),
              }}
              y={{ title: 'Reviews', domain: [0, 2] }}
              refLines={[{ axis: 'x', value: study.today, color: N81_SERIES.rule, dashed: true }]}
              series={[
                {
                  mark: 'bar',
                  key: 'due',
                  label: 'Past due',
                  color: N81_SERIES.due,
                  y: (d) => d.due || null,
                },
                {
                  mark: 'bar',
                  key: 'later',
                  label: 'Not yet due',
                  color: N81_SERIES.later,
                  y: (d) => d.later || null,
                },
              ]}
            />
          )}
        />
        <div className="grid @wide:col-span-2">
          <DataPanel
            title="Items"
            subtitle="Weakest first"
            phase={itemsPhase}
            bodySize={{ rows: 10 }}
            body={() => (
              <DataTable
                table={table}
                height="fill"
                focusItems={{
                  focus: confidenceFocus,
                  holds: (row, level) => row.level === level.key,
                }}
              />
            )}
          />
        </div>
      </CardGrid>
    </Page>
  )
}
