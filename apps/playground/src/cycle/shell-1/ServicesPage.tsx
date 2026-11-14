/**
 * Shell cycle 1 (docs/v3/cycles/shell-1.md), page 2 of the fleet app: the services list. A
 * SplitPage master-detail (the services, then the chosen one with its deploys) and a PageAside
 * inspector that opens from a deploy row. Every workaround carries a `cycle-shell-1:` comment.
 */
import { filterSlot, spec } from 'basalt-ui/controls'
import { EmptyState, InnerNav, Page, PageAside, PageBar, Section, SplitPage } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'
import { useV3Tokens } from '../../demo/v3-tokens'
import { TEAMS, TEAM_LABELS } from './fleet-api'
import type { Deploy, Outcome, Service } from './fleet-api'
import { services } from './fleet-store'
import { asideStateOf, useInnerNavState } from './handle-adapters'

const OUTCOME_LABELS: Record<Outcome, string> = {
  success: 'Succeeded',
  failed: 'Failed',
  'rolled-back': 'Rolled back',
}
const OUTCOME_TONE: Record<Outcome, 'good' | 'bad' | 'warn'> = {
  success: 'good',
  failed: 'bad',
  'rolled-back': 'warn',
}

const c = col<Deploy>()
const columns = [
  c.entity('version', { header: 'Version', priority: 1 }),
  c.status('outcome', {
    header: 'Outcome',
    options: ['success', 'failed', 'rolled-back'],
    // cycle-shell-1: state-1.16 (filed by the state cycle) — the tone callback takes a `string`.
    tone: (value) => OUTCOME_TONE[value as Outcome],
    priority: 1,
  }),
  c.text('author', { header: 'Author', priority: 2 }),
  c.number('durationS', { header: 'Duration (s)', priority: 2 }),
  c.date('date', { header: 'Date', priority: 1 }),
]

function groupsOf(list: readonly Service[], team: string) {
  return TEAMS.filter((t) => team === 'all' || t === team).map((t) => ({
    id: t,
    label: TEAM_LABELS[t],
    items: list
      .filter((s) => s.team === t)
      .map((s) => ({
        id: s.id,
        label: s.name,
        ...(s.health === 'healthy'
          ? {}
          : { badge: { dot: true as const, attention: s.health === 'down' } }),
      })),
  }))
}

function Deploys({ service }: { service: Service }): ReactElement {
  const [, setDeploy] = services.field.deploy.use()
  const table = useDataTable<Deploy>({
    id: 'cycle-shell-deploys',
    label: `${service.name} deploys`,
    columns,
    data: service.deploys,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    resetOn: [service.id],
    // cycle-shell-1: shell-1.1 — `detail` shows into a `DetailHost` that only `<DataTable detail>`
    // receives, and no published subpath hands the app the one `Page` provides for its `PageAside`,
    // so the row writes a URL field and the page mounts the aside from it.
    onRowActivate: (row) => setDeploy(row.id),
  })
  return <DataTable table={table} height="auto" />
}

function ServiceDetail({ service }: { service: Service }): ReactElement {
  return (
    <Section
      title={service.name}
      summary={`${TEAM_LABELS[service.team]} · ${service.region} · owned by ${service.owner}`}
    >
      <Deploys service={service} />
    </Section>
  )
}

function DeployFacts({ deploy }: { deploy: Deploy }): ReactElement {
  const rows: readonly (readonly [string, string])[] = [
    ['Version', deploy.version],
    ['Outcome', OUTCOME_LABELS[deploy.outcome]],
    ['Author', deploy.author],
    ['Duration', `${deploy.durationS} s`],
    ['Date', deploy.date],
  ]
  return (
    // cycle-shell-1: shell-1.4 — the kit has no key-value list for an inspector body, so the page
    // writes a `dl` grid of its own.
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="m-0">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function ServicesPage({ list }: { list: readonly Service[] }): ReactElement {
  useV3Tokens()
  const [team] = services.field.team.use()
  const [id] = services.field.service.use()
  const [deployId] = services.field.deploy.use()
  const serviceNav = useInnerNavState(services.field.service)
  const asideState = asideStateOf(services.field.deploy)
  const current = list.find((s) => s.id === id)
  const deploy = current?.deploys.find((d) => d.id === deployId)

  return (
    <Page area="cycle-shell-services">
      <PageBar title="Services" controls={filterSlot([spec(services.field.team, 'Team')])} />
      <SplitPage
        // cycle-shell-1: shell-1.5 — the documented `selected={field.isSet}` does not exist on a
        // field handle; an empty string is this field's "nothing chosen".
        selected={id !== ''}
        list={() => <InnerNav label="Services" state={serviceNav} groups={groupsOf(list, team)} />}
        detail={() =>
          current === undefined ? (
            <EmptyState why="Pick a service to see its deploys." tier="section" />
          ) : (
            <ServiceDetail service={current} />
          )
        }
      />
      {/* cycle-shell-1: shell-1.2 — the open record is a string field and `state` wants a
          boolean handle, so `asideStateOf` derives one (handle-adapters.ts). */}
      <PageAside
        title={deploy === undefined ? 'Deploy' : `Deploy ${deploy.version}`}
        state={asideState}
      >
        {deploy === undefined ? null : <DeployFacts deploy={deploy} />}
      </PageAside>
    </Page>
  )
}
