import type { ReactElement } from 'react'
import { useChartFocus } from 'basalt-ui/charts'
import { StatCard } from 'basalt-ui/cards'
import type { Empty, Phase } from 'basalt-ui/cards'
import { Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { Progress } from 'basalt-ui/ui/progress'

import type { ScenarioProps } from '../../shot-state'
import { coursesFor } from './fixture'
import type { Course } from './fixture'

const c = col<Course>()

const LEVEL_WORDS = ['Intro', 'Easy', 'Medium', 'Hard', 'Expert'] as const
const PIPS = [1, 2, 3, 4, 5] as const

// cycle-expression-7: the kit has no five-step ordinal (rating) mark or column kind, so difficulty is five pips in a custom column
function Pips({ level }: { level: Course['difficulty'] }): ReactElement {
  return (
    <span className="flex items-center gap-1">
      <span className="sr-only">{`Difficulty ${level} of 5, ${LEVEL_WORDS[level - 1]}`}</span>
      {PIPS.map((pip) => (
        <span
          key={pip}
          aria-hidden
          className={
            pip <= level ? 'size-2 rounded-full bg-foreground' : 'size-2 rounded-full bg-border'
          }
        />
      ))}
    </span>
  )
}

const NOTHING: Empty = {
  cause: 'The catalogue has no courses yet. They appear here once one is published.',
}

function phaseFor(shotState: ScenarioProps['shotState']): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') return { tag: 'error', retry: () => undefined }
  return 'ready'
}

export function ExprN11Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const phase = phaseFor(shotState)
  const rows = shotState === 'empty' ? [] : coursesFor(fixture)
  const started = rows.filter((r) => r.lessonsDone > 0)
  const finished = rows.filter((r) => r.lessonsDone === r.lessonsTotal).length

  const focus = useChartFocus(rows, {
    announce: (r) =>
      `${r.title}, difficulty ${r.difficulty} of 5, ${r.lessonsDone} of ${r.lessonsTotal} lessons done`,
  })

  const table = useDataTable({
    id: 'courses',
    label: 'Courses',
    columns: [
      c.entity('title', { header: 'Course', priority: 1, filter: 'text', width: 'content' }),
      // cycle-expression-7: the kit has no rating kind, so a custom column draws the pips and sorts by level
      c.custom('difficulty', {
        header: 'Difficulty',
        priority: 1,
        card: 'badge',
        sortValue: (r) => r.difficulty,
        render: (r) => <Pips level={r.difficulty} />,
      }),
      // cycle-expression-7: c.meter draws a bare share with no unit and the kit forbids sizing a track by lessons; a custom column draws the bar beside "done / total"
      c.custom('progress', {
        header: 'Lessons done',
        priority: 1,
        card: 'value',
        sortValue: (r) => r.progress,
        width: 34,
        render: (r) => (
          <span className="flex items-center gap-2">
            <span className="w-20 shrink-0">
              <Progress
                value={r.progress}
                tone={r.lessonsDone > 0 ? 'accent' : 'neutral'}
                aria-label={`${r.title}: ${r.lessonsDone} of ${r.lessonsTotal} lessons`}
              />
            </span>
            <span className="tabular-nums">
              {r.lessonsDone} / {r.lessonsTotal}
            </span>
          </span>
        ),
      }),
    ],
    data: rows,
    phase,
    empty: rows.length === 0 ? NOTHING : null,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
  })

  return (
    <Page area="courses" landmark>
      <PageBar title="Courses" />
      <div className="flex min-w-0 flex-col gap-4">
        <StatCard
          title="Courses started"
          subtitle={focus.readout('whole catalogue', (r) => r.title)}
          value={
            rows.length === 0
              ? null
              : focus.readout(
                  `${started.length} of ${rows.length}`,
                  (r) => `${r.lessonsDone} of ${r.lessonsTotal}`,
                )
          }
          unit={focus.readout('courses', () => 'lessons')}
          delta={
            rows.length === 0
              ? undefined
              : focus.readout(
                  {
                    value: `${Math.round((started.length / rows.length) * 100)}% of the catalogue`,
                    polarity: 'neutral' as const,
                  },
                  (r) => ({ value: `${r.progress}% done`, polarity: 'neutral' as const }),
                )
          }
          phase={phase}
          footer={[
            { label: 'Not started', value: rows.length - started.length },
            { label: 'Finished', value: finished },
          ]}
        />
        <DataTable table={table} focus={focus} />
        {focus.live}
      </div>
    </Page>
  )
}
