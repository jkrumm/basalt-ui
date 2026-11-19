import type { ComponentProps, ReactNode } from 'react'
import { useFormat } from 'basalt-ui'
import type { Phase } from 'basalt-ui/cards'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { Card, CardBand, Inset } from 'basalt-ui/ui/card'
import type { ScenarioProps } from '../../shot-state'
import {
  EMPTY_REVIEW,
  SPEC_NAME,
  reviewFor,
  type Annotation,
  type Outcome,
  type Reply,
  type Revision,
} from './fixture'

// cycle-expression-12: `StatRow` is not exported from basalt-ui/cards, so the row type is read off StatCell
type StatRow = NonNullable<ComponentProps<typeof StatCell>['rows']>[number]

// cycle-expression-12: DataPanel fixes its body at `bodySize` rows of the desktop row height, and at 390 the same table becomes cards or taller rows, so it cut 3 of 5 revisions and 5 of 14 annotations with no way to reach them; the frame is rebuilt from Card, CardBand and Inset, the table drawing its own phase arms
function TablePanel({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <Card flush>
      <CardBand title={title} subtitle={subtitle} />
      <Inset>{children}</Inset>
    </Card>
  )
}

const noop = (): void => undefined

const OUTCOMES = ['changes', 'good'] as const satisfies readonly Outcome[]
const OUTCOME_LABEL: Readonly<Record<Outcome, string>> = { changes: 'Changes', good: 'Looks good' }

/** Unanswered first, so the answer to the third clause sits above the cut. */
const REPLIES = ['none', 'deferred', 'declined', 'applied'] as const satisfies readonly Reply[]
const REPLY_LABEL: Readonly<Record<Reply, string>> = {
  none: 'Unanswered',
  deferred: 'Deferred',
  declined: 'Declined',
  applied: 'Applied',
}

const rc = col<Revision>()
const ac = col<Annotation>()

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const hi = sorted[mid] ?? 0
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? hi) + hi) / 2 : hi
}

export function ExprN55Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const loaded = reviewFor(fixture)
  const review = shotState === 'empty' ? EMPTY_REVIEW : loaded
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The review log did not respond.' }
        : 'ready'
  const ready = phase === 'ready' && review.revisions.length > 0
  /** An empty Spec prints a dash where a figure would stand; a loading one holds the slot blank. */
  const held = phase === 'ready' ? '–' : ''

  const { revisions, annotations } = review
  const unansweredOf = (rows: readonly Annotation[]): number =>
    rows.filter((a) => a.reply === 'none').length
  const stamp = (iso: string): string =>
    f.time(new Date(iso), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: 'UTC',
    })
  const hours = (h: number): string => f.number(h, { maximumFractionDigits: 1 })

  const focus = useChartFocus(revisions, {
    announce: (r) => {
      const on = annotations.filter((a) => a.revision === r.n)
      return `${r.name}: ${OUTCOME_LABEL[r.outcome]}, ${hours(r.hours)} h wait, ${on.length} annotations, ${unansweredOf(on)} unanswered`
    },
  })

  const longest = revisions.reduce<Revision | undefined>(
    (top, r) => (top === undefined || r.hours > top.hours ? r : top),
    undefined,
  )
  const first = revisions[0]
  const last = revisions.at(-1)
  const picked = focus.datum
  const scope = picked === null ? annotations : annotations.filter((a) => a.revision === picked.n)
  const count = (reply: Reply): number => scope.filter((a) => a.reply === reply).length
  const wait = picked ?? longest
  const replyRow = (reply: Reply): StatRow => ({
    label: REPLY_LABEL[reply],
    value: ready ? count(reply) : held,
    bar: { value: ready ? count(reply) : 0, max: Math.max(scope.length, 1) },
  })
  const spanDays =
    first === undefined || last === undefined
      ? 0
      : (Date.parse(last.sentAt) + last.hours * 3_600_000 - Date.parse(first.sentAt)) / 86_400_000
  const typical = median(revisions.map((r) => r.hours))

  const revisionTable = useDataTable({
    id: 'expr-n55-revisions',
    label: 'Revisions',
    columns: [
      // cycle-expression-12: a table in a half-width cell keeps only 480 px of priority 1 and 2 columns (entity 18ch, status 12ch, meter 14ch), so the size has no column of its own and rides the entity sub line with the sent time
      rc.entity('name', {
        header: 'Revision',
        sub: (r) => `${stamp(r.sentAt)}, ${f.number(r.bytes)} B`,
        subMono: true,
      }),
      rc.meter('hours', {
        header: 'Wait (h)',
        max: longest?.hours ?? 1,
        priority: 1,
        card: 'meta',
      }),
      rc.status('outcome', {
        header: 'Verdict',
        priority: 2,
        options: OUTCOMES,
        labels: OUTCOME_LABEL,
        tone: () => 'neutral',
      }),
    ],
    data: revisions,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: loaded.revisions.length,
    empty: {
      cause: 'This Spec has not been sent for review. Send revision 1 to start the log.',
    },
  })

  const ordered = [...annotations].sort(
    (a, b) => REPLIES.indexOf(a.reply) - REPLIES.indexOf(b.reply) || a.revision - b.revision,
  )
  const annotationTable = useDataTable({
    id: 'expr-n55-annotations',
    label: 'Annotations',
    columns: [
      ac.status('reply', {
        header: 'Reply',
        options: REPLIES,
        labels: REPLY_LABEL,
        tone: (r) => (r === 'none' ? 'warn' : 'neutral'),
      }),
      ac.entity('note', { header: 'Annotation', sub: (a) => a.section }),
      ac.number('revision', { header: 'Revision', priority: 2 }),
    ],
    data: ordered,
    getRowId: (a) => a.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: loaded.annotations.length,
    empty: { cause: 'Annotations appear when a reviewer marks a revision.' },
  })

  return (
    <Page area="expr-n55">
      <PageBar title={SPEC_NAME} />
      <div className="grid items-start gap-3 @wide:grid-cols-2">
        <div className="flex flex-col gap-3">
          <StatGroup variant="cards" label="Review at a glance">
            <StatCell
              label="Revisions"
              value={ready ? revisions.length : null}
              status={
                ready && last !== undefined
                  ? { tone: 'neutral', label: OUTCOME_LABEL[last.outcome] }
                  : undefined
              }
              phase={phase}
              rows={[
                {
                  label: 'Size growth',
                  value:
                    ready && first !== undefined && last !== undefined
                      ? `+${f.number(last.bytes - first.bytes)} B`
                      : held,
                },
                {
                  label: 'To looks good',
                  value:
                    ready && first !== undefined && last !== undefined
                      ? `${f.number(spanDays, { maximumFractionDigits: 1 })} days`
                      : held,
                },
              ]}
            />
            <StatCell
              label="Verdict wait"
              value={ready && wait !== undefined ? wait.hours : null}
              unit="h"
              sub={
                ready && wait !== undefined
                  ? picked === null
                    ? `Longest, ${wait.name}`
                    : `${wait.name}, ${OUTCOME_LABEL[wait.outcome].toLowerCase()}`
                  : ''
              }
              phase={phase}
              rows={[
                {
                  label: 'Median',
                  value: ready ? `${hours(typical)} h` : held,
                  bar: { value: ready ? typical : 0, max: longest?.hours ?? 1 },
                },
              ]}
            />
            <StatCell
              label="Unanswered"
              value={ready ? unansweredOf(scope) : null}
              unit={ready ? `of ${scope.length} annotations` : ''}
              sub={ready ? (picked === null ? 'Whole Spec' : picked.name) : ''}
              phase={phase}
              rows={[replyRow('deferred'), replyRow('declined'), replyRow('applied')]}
            />
          </StatGroup>
          <TablePanel title="Revisions" subtitle="Times in UTC, bars scaled to the longest">
            <DataTable table={revisionTable} focus={focus} />
          </TablePanel>
        </div>
        <TablePanel title="Annotations" subtitle="Unanswered first">
          <DataTable
            table={annotationTable}
            focusItems={{ focus, holds: (a, r) => a.revision === r.n }}
          />
        </TablePanel>
      </div>
      {focus.live}
    </Page>
  )
}
