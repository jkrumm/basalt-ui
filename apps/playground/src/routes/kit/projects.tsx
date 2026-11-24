import { createFileRoute } from '@tanstack/react-router'
import { Sparkline } from 'basalt-ui/charts'
import { filterSlot, spec } from 'basalt-ui/controls'
import { Page, PageBar } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'
import {
  LAMP_LABELS,
  LAMP_TONES,
  LAMPS,
  OPEN_SCALE,
  PROJECTS,
  PROJECTS_NOW,
  QUICK,
  QUICK_LABELS,
  SPACE_LABELS,
  matchesQuick,
} from '../../demo/kit-projects'
import type { Project, Quick } from '../../demo/kit-projects'

const store = defineControls({
  id: 'kit-projects',
  scope: 'page',
  fields: {
    view: field.enum(QUICK, 'all').labels(QUICK_LABELS),
    search: field.string(''),
    rows: field.enum(['groups', 'flat'], 'groups').labels({ groups: 'Groups', flat: 'Flat' }),
    height: field
      .enum(['dense', 'comfortable'], 'dense')
      .labels({ dense: 'Compact', comfortable: 'Comfortable' }),
  },
})

const c = col<Project>()

const AGAINST = 'the 7 days before'

const NAME = c.entity('name', {
  header: 'Project',
  ref: (p) => p.tag,
  priority: 1,
  headerIcon: false,
})

/** The space a project sits in: only there to group by, so it folds into the group rows. */
const SPACE = c.text('space', {
  header: 'Space',
  labels: SPACE_LABELS,
  priority: 3,
  card: 'subtitle',
})

/** The figures of a row: with the name, the ten columns of the console's table, no `custom`. */
const FIGURES = [
  c.meter('open', {
    header: 'Now',
    max: OPEN_SCALE,
    segments: [
      { label: 'Running', tone: 'accent', value: (p) => p.running },
      { label: 'Paused', tone: 'warn', value: (p) => p.paused },
      { label: 'Ready', tone: 'neutral', value: (p) => p.ready },
    ],
    help: 'Open Issues now, on one scale for every project: running in blue, paused in amber, ready in grey.',
    priority: 1,
    headerIcon: false,
    card: 'meta',
  }),
  c.spark('shipped', {
    header: 'Shipped 7 d',
    label: 'Shipped per 6 hours, last 7 days',
    value: (p) => p.shippedTotal,
    help: 'Issues closed done, per 6 hours over the last 7 days, and their count.',
    priority: 2,
    headerIcon: false,
    card: 'meta',
    render: (p, box) => (
      <Sparkline
        points={p.shipped}
        height={box.height}
        label={`${p.name}: shipped per 6 hours, last 7 days`}
      />
    ),
  }),
  c.relativeTime('lastShipAt', {
    header: 'Last ship',
    mono: true,
    priority: 3,
    headerIcon: false,
    card: 'subtitle',
  }),
  c.number('cycleMs', {
    header: 'Cycle',
    duration: 'ms',
    trend: { before: (p) => p.cycleBeforeMs, better: 'lower', against: AGAINST },
    card: 'meta',
    help: 'Median time from filed to closed over the last 7 days. The arrow compares it with the 7 days before; no arrow, nothing to compare.',
    priority: 2,
    headerIcon: false,
  }),
  c.number('waitMs', {
    header: 'Queue wait',
    duration: 'ms',
    trend: { before: (p) => p.waitBeforeMs, better: 'lower', against: AGAINST },
    help: 'Median time from filed to a lead started over the last 7 days. The arrow compares it with the 7 days before; no arrow, nothing to compare.',
    priority: 3,
    headerIcon: false,
  }),
  c.status('production', {
    header: 'Production',
    options: LAMPS,
    labels: LAMP_LABELS,
    tone: (lamp) => LAMP_TONES[lamp],
    lamp: true,
    age: { at: (p) => p.productionAt, label: 'since' },
    card: 'badge',
    help: 'Red: an incident is open. Amber: a regression in the last 7 days. Lit: shipped, its watch is on.',
    priority: 2,
    headerIcon: false,
  }),
  c.number('clean', {
    header: 'Hygiene',
    of: (p) => p.probes,
    warnBelow: 1,
    card: 'meta',
    age: { at: (p) => p.findingAt, label: 'oldest finding raised' },
    help: 'Probes clean of those run in the newest pass, and how long the oldest finding has stood.',
    priority: 2,
    headerIcon: false,
  }),
  c.meter('planDone', {
    header: 'Plan',
    max: (p) => p.planTotal,
    fraction: true,
    help: "Plan rows done, of all the rows in the project's plan.",
    priority: 3,
    headerIcon: false,
    card: 'meta',
  }),
  c.meter('leads', {
    header: 'Leads',
    max: (p) => p.seats,
    fraction: true,
    help: 'Leads running in the project, of the seats the host admits now.',
    priority: 3,
    headerIcon: false,
    card: 'meta',
  }),
]

/**
 * A monitoring table in the reading look, rebuilt from the factory console's Projects page with
 * shipped kinds only: a stacked meter, a spark with its total, durations with a trend, a lamp with
 * an age, a fraction with an age, two meter fractions, header help, and quiet group rows. The quick
 * filter is the view row's counted tabs; Groups or Flat and the row height sit beside the search.
 */
function ProjectsRoute(): ReactElement {
  const values = store.useValues()
  const phrase = values.search.trim().toLowerCase()
  const searched = PROJECTS.filter((p) => phrase === '' || p.name.includes(phrase))
  const rows = searched.filter((p) => matchesQuick(p, values.view))
  const countOf = (quick: Quick): number => searched.filter((p) => matchesQuick(p, quick)).length

  const t = useDataTable({
    id: 'kit-projects',
    label: 'Projects',
    // Flat, the rows need no space; grouped, the space folds into the group rows.
    columns: values.rows === 'groups' ? [NAME, SPACE, ...FIGURES] : [NAME, ...FIGURES],
    data: rows,
    getRowId: (p) => p.id,
    mode: { kind: 'client' },
    now: PROJECTS_NOW,
    rowHeight: values.height,
    bodyRows: PROJECTS.length,
    ...(values.rows === 'groups' && { group: { by: 'space', fold: true } }),
  })

  return (
    <Page area="kit-projects" fill>
      <PageBar
        tabs={{
          state: store.field.view,
          label: 'Quick filter',
          badges: {
            all: { count: countOf('all') },
            red: { count: countOf('red'), tone: 'bad' },
            hygiene: { count: countOf('hygiene'), tone: 'warn' },
            moving: { count: countOf('moving') },
            idle: { count: countOf('idle') },
          },
        }}
        search={{
          state: store.field.search,
          label: 'Search projects',
          placeholder: 'Project name',
        }}
        controls={filterSlot([
          spec(store.field.rows, 'Rows', { as: 'segmented' }),
          spec(store.field.height, 'Row height', { as: 'segmented' }),
        ])}
      />
      <div data-shot="projects" className="flex min-h-0 min-w-0 flex-1 flex-col">
        <DataTable table={t} />
      </div>
    </Page>
  )
}

export const Route = createFileRoute('/kit/projects')({
  staticData: { title: 'Projects' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: ProjectsRoute,
})
