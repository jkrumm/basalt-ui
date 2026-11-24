import { useFormat } from 'basalt-ui'
import { useChartFocus } from 'basalt-ui/charts'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import type { Delta, Phase } from 'basalt-ui/cards'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import type { ScenarioProps } from '../../shot-state'
import { NOW, VIEWER, dataset } from './fixture'
import type { MergeRequest, Pipeline } from './fixture'

const HOUR = 3_600_000
/** One rule for "slow": a review owed or an own merge request open longer than this is flagged. */
const SLOW_AFTER_HOURS = 48
const PIPELINE_TONE = { passed: 'neutral', failed: 'bad', running: 'neutral' } as const
const PIPELINE_LABEL: Record<Pipeline, string> = {
  passed: 'Passed',
  failed: 'Failed',
  running: 'Running',
}

type Verdict = 'Stuck' | 'Overdue' | 'Ready' | 'Open'
const VERDICT_TONE = { Stuck: 'bad', Overdue: 'warn', Ready: 'neutral', Open: 'neutral' } as const

type Lane = 'Waiting on you' | 'Yours' | 'Others'

type Item = {
  id: string
  title: string
  by: string
  lane: Lane
  openedAt: number
  pipeline: Pipeline
  approvals: string
  waitingOn: string
  ageHours: number
  /** Own and blocked: a failed pipeline, or older than two days and short of approvals. */
  stuck: boolean
  verdict: Verdict
}

const lanes: readonly Lane[] = ['Waiting on you', 'Yours', 'Others']

function toItem(row: MergeRequest): Item {
  const owesReview = row.reviewers.includes(VIEWER) && !row.approvedBy.includes(VIEWER)
  const own = row.author === VIEWER
  const short = row.approvedBy.length < row.needed
  const pending = row.reviewers.filter((r) => !row.approvedBy.includes(r))
  const lane: Lane = owesReview ? 'Waiting on you' : own ? 'Yours' : 'Others'
  const people = pending.filter((r) => r !== VIEWER).join(', ')
  const waitingOn = people === '' || (!owesReview && !short) ? '\u2014' : people
  const stuck = own && (row.pipeline === 'failed' || (short && row.ageHours > SLOW_AFTER_HOURS))
  const verdict: Verdict = stuck
    ? 'Stuck'
    : owesReview && row.ageHours > SLOW_AFTER_HOURS
      ? 'Overdue'
      : !short && row.pipeline === 'passed'
        ? 'Ready'
        : 'Open'
  return {
    id: row.id,
    title: row.title,
    by: row.author === VIEWER ? 'you' : row.author,
    lane,
    openedAt: NOW - row.ageHours * HOUR,
    pipeline: row.pipeline,
    approvals: `${row.approvedBy.length} of ${row.needed}`,
    waitingOn,
    ageHours: row.ageHours,
    stuck,
    verdict,
  }
}

const mrs = col<Item>()

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0')

function waitingDelta(now: number, before: number): Delta {
  const diff = now - before
  return {
    value: signed(diff),
    polarity: diff === 0 ? 'neutral' : 'up-bad',
    label: 'vs yesterday',
  }
}

export function ExprN36Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const data = dataset(fixture)
  const rows =
    shotState === 'empty' || shotState === 'loading'
      ? []
      : data.rows.map(toItem).toSorted((a, b) => lanes.indexOf(a.lane) - lanes.indexOf(b.lane))
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'GitLab did not answer.', retry: () => undefined }
        : 'ready'

  const waiting = rows.filter((r) => r.lane === 'Waiting on you')
  const mine = rows.filter((r) => r.by === 'you')
  const stuck = mine.filter((r) => r.stuck)
  const oldest = Math.max(0, ...waiting.map((r) => r.ageHours))

  const focus = useChartFocus(rows, {
    announce: (row) => `${row.id}, ${row.verdict}, ${row.approvals} approvals`,
  })

  const t = useDataTable({
    id: 'merge-requests',
    label: 'Open merge requests',
    columns: [
      mrs.entity('title', {
        header: 'Merge request',
        sub: (row) => row.id,
        subMono: true,
        href: (row) => `#mr-${row.id.slice(1)}`,
        priority: 1,
      }),
      mrs.relativeTime('openedAt', { header: 'Opened', priority: 1 }),
      mrs.meter('ageHours', {
        header: 'Age, hours',
        max: Math.max(1, ...rows.map((r) => r.ageHours)),
        priority: 3,
        card: 'hidden',
      }),
      mrs.status('verdict', {
        header: 'Verdict',
        options: ['Stuck', 'Overdue', 'Ready', 'Open'],
        tone: (value) => VERDICT_TONE[value],
        priority: 1,
      }),
      mrs.text('waitingOn', { header: 'Waiting on', priority: 2, card: 'hidden' }),
      mrs.status('pipeline', {
        header: 'Pipeline',
        options: ['passed', 'failed', 'running'],
        labels: PIPELINE_LABEL,
        tone: (value) => PIPELINE_TONE[value],
        priority: 2,
        card: 'meta',
      }),
      mrs.text('approvals', { header: 'Approvals', priority: 3, card: 'meta' }),
      mrs.text('by', { header: 'Author', priority: 3, card: 'hidden' }),
      // cycle-expression-9: a grouped table cannot group by a hidden column, so the queue is a sorted column and not group rows
      mrs.text('lane', { header: 'Queue', priority: 2 }),
    ],
    data: rows,
    phase,
    now: NOW,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    empty: { cause: 'No merge requests are open. New ones appear here when someone opens one.' },
  })

  return (
    <Page area="merge-requests">
      <PageBar title="Open merge requests" />
      <StatGroup variant="cards" label="Your queue">
        <StatCell
          title="Waiting on you"
          info={`Reviews you owe. Overdue after ${SLOW_AFTER_HOURS} hours.`}
          value={waiting.length}
          delta={waitingDelta(waiting.length, shotState === 'empty' ? 0 : data.waitingYesterday)}
          phase={phase}
          rows={[
            {
              label: 'Oldest',
              value: oldest === 0 ? 'None' : f.relative(NOW - oldest * HOUR, NOW),
            },
            {
              label: 'Pipeline failed',
              value: waiting.filter((r) => r.pipeline === 'failed').length,
            },
          ]}
        />
        <StatCell
          title="Yours, stuck"
          info={`Your merge requests with a failed pipeline, or open over ${SLOW_AFTER_HOURS} hours and short of approvals.`}
          subtitle={shotState === 'loading' ? undefined : `of ${mine.length} open`}
          value={stuck.length}
          phase={phase}
          rows={[
            {
              label: 'Failed pipeline',
              value: stuck.filter((r) => r.pipeline === 'failed').length,
            },
            {
              label: 'Short on approvals',
              value: stuck.filter((r) => r.pipeline !== 'failed').length,
            },
          ]}
        />
      </StatGroup>
      <Section title="Merge requests">
        {/* cycle-expression-9: a loading table draws six skeleton rows, not the loaded height, so the page holds it */}
        <div className={shotState === 'loading' ? 'min-h-140' : undefined}>
          <DataTable table={t} focus={focus} />
        </div>
      </Section>
    </Page>
  )
}
