import { useFormat } from 'basalt-ui'
import { filterSlot, spec } from 'basalt-ui/controls'
import {
  EmptyState,
  Facts,
  InnerNav,
  Page,
  PageAside,
  PageBar,
  Section,
  SplitPage,
} from 'basalt-ui/page'
import { defineControls, field, navTarget } from 'basalt-ui/router'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { Skeleton } from 'basalt-ui/ui/skeleton'
import { Status } from 'basalt-ui/ui/status'
import type { ReactElement } from 'react'
import type { Deploy, Outcome, ServiceSummary } from './server'

const OUTCOMES = ['all', 'succeeded', 'failed', 'rolled-back'] as const

/**
 * The page's URL state: the open service (a push field, so Back walks the services), the open deploy
 * in the aside, and the outcome filter, which `retain` keeps when the crumb parent clears the selection.
 */
export const services = defineControls({
  id: 'fleet6-services',
  scope: 'page',
  retain: ['outcome'],
  resets: ['deploy'],
  fields: {
    service: field.string('', { history: 'push' }),
    deploy: field.string(''),
    outcome: field.enum(OUTCOMES, 'all').labels({
      all: 'All',
      succeeded: 'Succeeded',
      failed: 'Failed',
      'rolled-back': 'Rolled back',
    }),
  },
})

const OUTCOME_LABEL: Record<Outcome, string> = {
  succeeded: 'Succeeded',
  failed: 'Failed',
  'rolled-back': 'Rolled back',
}
const OUTCOME_TONE = { succeeded: 'neutral', failed: 'bad', 'rolled-back': 'warn' } as const
const OPTIONS: readonly Outcome[] = ['succeeded', 'failed', 'rolled-back']

const c = col<Deploy>()

type Loaded = { services: readonly ServiceSummary[]; deploys: readonly Deploy[] }

/** The services page: `data` is absent while the route is pending, and the table and the list hold their places. */
export function ServicesPage({ data }: { data: Loaded | undefined }): ReactElement {
  const f = useFormat()
  const [serviceId] = services.field.service.use()
  const [outcome] = services.field.outcome.use()
  const selected = services.field.service.useIsSet()
  const slot = filterSlot([spec(services.field.outcome, 'Outcome')])
  const reset = services.useReset({ only: slot })
  const ready = data !== undefined
  const service = data?.services.find((s) => s.id === serviceId)
  const all = data?.deploys ?? []
  const rows = outcome === 'all' ? all : all.filter((d) => d.outcome === outcome)
  const slowest = Math.max(1, ...all.map((d) => d.durationS))
  const scope = service?.name ?? 'All services'

  const table = useDataTable({
    id: 'fleet6-deploys',
    label: 'Deploys',
    columns: [
      c.entity('version', { header: 'Deploy', mono: true, sub: (d) => d.author }),
      ...(selected ? [] : [c.text('serviceName', { header: 'Service', priority: 2 })]),
      c.status('outcome', {
        header: 'Outcome',
        options: OPTIONS,
        labels: OUTCOME_LABEL,
        tone: (o) => OUTCOME_TONE[o],
      }),
      c.date('startedAt', { header: 'Started', priority: 2, style: 'short' }),
      c.meter('durationS', { header: 'Duration, s', priority: 3, max: slowest }),
    ],
    data: ready ? rows : undefined,
    phase: ready ? 'ready' : 'loading',
    bodyRows: 8,
    getRowId: (d) => d.id,
    mode: { kind: 'client' },
    // owner-review-2: the table's pager reads "No rows on this page" while it loads or is empty, so it is drawn only with rows
    pager: ready && rows.length > 0 ? 'pages' : 'none',
    empty:
      outcome === 'all'
        ? { cause: `${scope} shipped nothing in 90 days. A first deploy appears here.` }
        : {
            cause: `${scope} has no ${OUTCOME_LABEL[outcome].toLowerCase()} deploys. Clear the filter to see the rest.`,
            filtered: { reset },
          },
    detail: (d) => (
      <Facts
        rows={[
          { label: 'Service', value: d.serviceName },
          {
            label: 'Outcome',
            value: <Status tone={OUTCOME_TONE[d.outcome]}>{OUTCOME_LABEL[d.outcome]}</Status>,
          },
          { label: 'Started', value: f.dateTime(d.startedAt, 'short') },
          { label: 'Duration', value: `${d.durationS} s` },
          { label: 'Author', value: d.author },
        ]}
      />
    ),
    detailTitle: (d) => d.version,
    detailState: services.field.deploy,
  })

  const groups = [
    {
      id: 'team',
      label: 'Platform team',
      items: (data?.services ?? []).map((s) => ({
        id: s.id,
        label: s.name,
        ...(s.lastOutcome !== 'succeeded' && {
          badge: { dot: true as const, attention: true as const },
        }),
      })),
    },
  ]

  return (
    <Page area="fleet6-services">
      <PageBar
        title={service?.name ?? 'Services'}
        {...(service !== undefined && {
          parent: {
            label: 'Services',
            href: navTarget({ to: '/cycle/shell-6/services', ...services.field.service.link('') }),
          },
        })}
        controls={slot}
      />
      <SplitPage
        selected={selected}
        onBack={services.field.service.clear}
        backLabel="Services"
        list={() =>
          !ready ? (
            // owner-review-2: InnerNav has no loading phase, so the pending list is skeleton lines in a hand-built column
            <div className="flex flex-col gap-4 text-sm" aria-busy="true">
              {['a', 'b', 'c', 'd', 'e', 'f'].map((k) => (
                <Skeleton key={k} className="w-full" />
              ))}
            </div>
          ) : data.services.length === 0 ? (
            <EmptyState
              tier="section"
              cause="This team has no services yet. Register one to see its deploys."
            />
          ) : (
            <InnerNav label="Services" state={services.field.service} groups={groups} />
          )
        }
        detail={() => (
          <Section title="History" summary={ready ? `${scope}, 90 days, newest first` : ''}>
            <DataTable table={table} />
          </Section>
        )}
      />
      <PageAside title="Deploy" width={360} state={services.field.deploy} mobile="sheet" />
    </Page>
  )
}
