/**
 * Shell cycle 2 (docs/v3/cycles/shell-2.md), page 2 of the fleet app, copied from cycle 1: the
 * services list. A SplitPage master-detail (the services, then the chosen one with its deploys) and
 * a PageAside inspector that opens from a deploy row. Every workaround carries a `cycle-shell-2:`
 * comment.
 *
 * Gone since cycle 1: the `InnerNav` adapter (shell-1.3), the boolean aside handle (shell-1.2), the
 * row's hand-written `onRowActivate` (shell-1.1), the hand-built `dl` (shell-1.4), the
 * `selected={id !== ''}` guess (shell-1.5) and the per-page palette mount (shell-1.9).
 */
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
import { filterSlot, spec } from 'basalt-ui/controls'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'
import { TEAMS, TEAM_LABELS } from './fleet-api'
import type { Deploy, Outcome, Service } from './fleet-api'
import { services } from './fleet-store'

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
    labels: OUTCOME_LABELS,
    tone: (value) => OUTCOME_TONE[value],
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

function DeployFacts({ deploy }: { deploy: Deploy }): ReactElement {
  return (
    <Facts
      rows={[
        { label: 'Version', value: deploy.version },
        { label: 'Outcome', value: OUTCOME_LABELS[deploy.outcome] },
        { label: 'Author', value: deploy.author },
        { label: 'Duration', value: `${deploy.durationS} s` },
        { label: 'Date', value: deploy.date },
      ]}
    />
  )
}

function Deploys({ service }: { service: Service }): ReactElement {
  const table = useDataTable<Deploy>({
    id: 'cycle-shell-2-deploys',
    label: `${service.name} deploys`,
    columns,
    data: service.deploys,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    resetOn: [service.id],
    detail: (row) => <DeployFacts deploy={row} />,
    detailTitle: (row) => `Deploy ${row.version}`,
    detailState: services.field.deploy,
  })
  return <DataTable table={table} height="auto" />
}

export function ServicesPage({ list }: { list: readonly Service[] }): ReactElement {
  const [team] = services.field.team.use()
  const [id] = services.field.service.use()
  const selected = services.field.service.useIsSet()
  const current = list.find((s) => s.id === id)

  return (
    <Page area="cycle-shell-2-services">
      <PageBar
        title={current?.name ?? 'Services'}
        {...(current !== undefined && {
          parent: {
            label: 'Services',
            // cycle-shell-2: shell-2.1 — the shell crumb draws a path string as a bare anchor (a document
            // reload that drops `team`) and a NavTarget as unlinked text; the string at least links.
            href: '/cycle/shell-2/services',
          },
        })}
        controls={filterSlot([spec(services.field.team, 'Team')])}
      />
      <SplitPage
        selected={selected}
        onBack={services.field.service.clear}
        backLabel="Services"
        list={() => (
          <InnerNav label="Services" state={services.field.service} groups={groupsOf(list, team)} />
        )}
        detail={() =>
          current === undefined ? (
            <EmptyState cause="Pick a service to see its deploys." tier="section" />
          ) : (
            <Section
              title="Deploys"
              summary={`${TEAM_LABELS[current.team]} · ${current.region} · owned by ${current.owner}`}
            >
              <Deploys service={current} />
            </Section>
          )
        }
      />
      <PageAside title="Deploy" state={services.field.deploy} />
    </Page>
  )
}
