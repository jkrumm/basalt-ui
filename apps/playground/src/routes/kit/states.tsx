/**
 * States and overlays: one list of deploys in each phase a query passes through, the connection and
 * the age of its data in the page bar, and the overlays a row opens by key. `?phase=` picks a phase;
 * `basalt-ui shot` forces the same ones through `shotState`.
 */
import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { DataPanel, EventList, StepRail } from 'basalt-ui/cards'
import type { CardMenu, FrameHead, Phase, QueryStateLike } from 'basalt-ui/cards'
import { shotState, useConnection, useFreshness } from 'basalt-ui/data'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { Rocket } from 'lucide-react'
import type { ReactElement } from 'react'
import { DEPLOY_STATES, DEPLOYS, DEPLOYS_NOW, stepsOf } from '../../demo/deploys'
import type { Deploy } from '../../demo/deploys'
import { useFixture } from '../../demo/fixture'
import { OVERLAYS } from '../../demo/overlays'

const store = defineControls({
  id: 'kit-states',
  scope: 'page',
  fields: {
    phase: field
      .enum(['live', 'loading', 'empty', 'error'], 'live', { history: 'push' })
      .labels({ live: 'Loaded', loading: 'Loading', empty: 'Empty', error: 'Failed' }),
  },
})

const deploysQuery = queryOptions({
  queryKey: ['kit-states', 'deploys'],
  queryFn: async (): Promise<readonly Deploy[]> => DEPLOYS,
})

/** The phase a tab stands for; `live` is the query's own. */
const FORCED: Record<'loading' | 'error', Phase> = {
  loading: 'loading',
  error: { tag: 'error', message: 'The deploy service answered 502 Bad Gateway.' },
}

/** The month's incidents, newest first: both closed. */
const INCIDENTS = [
  {
    id: 'inc-12',
    at: DEPLOYS_NOW - 3 * 86_400_000,
    actor: 'Lin',
    title: 'closed: search answered 503 after 2.8.1',
    chips: ['search'],
  },
  {
    id: 'inc-11',
    at: DEPLOYS_NOW - 9 * 86_400_000,
    actor: 'Ada',
    title: 'closed: billing webhooks retried for 40 minutes',
    chips: ['billing'],
  },
]

const TONES = { Live: 'good', Failed: 'bad', 'Rolled back': 'warn' } as const

const c = col<Deploy>()

/** The newest deploy: the fixture always has one. */
function newest(): Deploy {
  const deploy = DEPLOYS[0]
  if (deploy === undefined) throw new Error('kit/states: no deploy in the fixture')
  return deploy
}
const latest = newest()

/** The last deploy's panel: its head, and the two things a reader does with it. */
const LAST_DEPLOY: FrameHead = {
  title: 'Last deploy',
  subtitle: `${latest.service} ${latest.version}, by ${latest.author}`,
  icon: Rocket,
}
const LAST_DEPLOY_MENU: CardMenu = [
  {
    id: 'steps',
    label: 'Open in a sheet',
    onClick: () => OVERLAYS.open('deploy:steps', { deploy: latest }),
  },
  {
    id: 'rollback',
    label: 'Roll back',
    onClick: () => OVERLAYS.open('deploy:rollback', { deploy: latest }),
  },
]

function StatesRoute(): ReactElement {
  const result = shotState(useQuery(deploysQuery))
  const [phase] = store.field.phase.use()
  const incidents = useFixture(['kit-states', 'incidents'], INCIDENTS, [])
  const connection = useConnection()
  const freshness = useFreshness([deploysQuery.queryKey])
  const rows = phase === 'empty' ? [] : result.data
  const shown: Phase | QueryStateLike =
    phase === 'live' || phase === 'empty' ? result : FORCED[phase]
  const t = useDataTable({
    id: 'kit-states-deploys',
    label: 'Deploys',
    columns: [
      c.entity('service', { header: 'Service', sub: (d) => d.version, subMono: true }),
      c.status('state', {
        header: 'State',
        options: [...DEPLOY_STATES],
        tone: (value) => TONES[value as keyof typeof TONES],
      }),
      c.text('author', { header: 'By', priority: 2 }),
      c.relativeTime('at', { header: 'Deployed' }),
      c.actions([
        {
          id: 'steps',
          label: 'Show steps',
          onClick: (d) => OVERLAYS.open('deploy:steps', { deploy: d }),
        },
        {
          id: 'rollback',
          label: 'Roll back',
          disabled: (d) => d.state !== 'Live',
          onClick: (d) => OVERLAYS.open('deploy:rollback', { deploy: d }),
        },
      ]),
    ],
    data: rows,
    phase: shown,
    empty: { cause: 'Nothing deployed in the last 24 hours. A merge to main starts one.' },
    getRowId: (d) => d.id,
    mode: { kind: 'client' },
    now: DEPLOYS_NOW,
  })
  return (
    <Page area="kit-states">
      <PageBar
        tabs={{ state: store.field.phase, label: 'Phase' }}
        connection={connection}
        refresh={{ scope: 'page', ...freshness.button }}
      />
      <DataTable table={t} />
      <CardGrid min="regular">
        <DataPanel
          {...LAST_DEPLOY}
          menu={LAST_DEPLOY_MENU}
          phase={result}
          empty={
            result.data?.length === 0
              ? { cause: 'Nothing deployed yet: a merge to main starts one.' }
              : null
          }
          bodySize={{ height: 336 }}
          body={() => {
            const last = result.data?.[0]
            return last === undefined ? null : (
              <StepRail label="Steps of the last deploy" steps={stepsOf(last)} />
            )
          }}
        />
        <EventList
          title="Incidents"
          now={DEPLOYS_NOW}
          phase={incidents}
          empty={
            incidents.data?.length === 0
              ? { cause: 'No incident in 30 days: one opens when a probe fails twice.' }
              : null
          }
          items={incidents.data ?? []}
        />
      </CardGrid>
    </Page>
  )
}

export const Route = createFileRoute('/kit/states')({
  staticData: { title: 'States' },
  validateSearch: store.validateSearch,
  search: { middlewares: store.middlewares },
  component: StatesRoute,
})
