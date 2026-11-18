import { DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Empty, Phase } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { useEffect, useRef } from 'react'
import type { ScenarioProps } from '../../shot-state'
import { hygieneFor, NOW } from './fixture'
import type { Finding, Probe, ProbeState, Severity } from './fixture'

const probeCol = col<Probe>()
const findingCol = col<Finding>()

const STATE_LABELS: Record<ProbeState, string> = {
  fail: 'Failing',
  stale: 'Stale',
  never: 'Never run',
  pass: 'Passing',
}
const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const noop = (): void => {}

export function ExprN33Scenario({ shotState, fixture }: ScenarioProps) {
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The probe service did not answer.' }
        : 'ready'
  // The strip repeats no Retry: the two panels below own the recovery.
  const stripPhase: Phase =
    shotState === 'error' ? { tag: 'error', message: 'The probe service did not answer.' } : phase
  const ready = phase === 'ready'
  const measured = shotState !== 'empty'
  const { probes, findings } = hygieneFor(fixture)
  const rows = {
    probes: shotState === 'empty' ? [] : probes,
    findings: shotState === 'empty' ? [] : findings,
  }

  const failed = rows.probes.filter((p) => p.state === 'fail')
  const stale = rows.probes.filter((p) => p.state === 'stale').length
  const never = rows.probes.filter((p) => p.state === 'never').length
  const urgent = rows.findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high',
  ).length
  const oldest = rows.findings[0]
  const aged = rows.findings.filter((f) => f.ageDays > 30).length
  const second = rows.findings[1]?.ageDays ?? 1
  // cycle-expression-9: the meter column has no outlier cap, so the scale ends at the runner-up when one finding is three times older.
  const maxAge = Math.max(1, (oldest?.ageDays ?? 1) > second * 3 ? second : (oldest?.ageDays ?? 1))

  const noProbes: Empty | null =
    rows.probes.length === 0
      ? {
          cause: 'No probes are registered yet.',
          action: { label: 'Register a probe', onClick: noop },
        }
      : null
  const noFindings: Empty | null =
    rows.findings.length > 0
      ? null
      : rows.probes.length === 0
        ? { cause: 'Findings appear once a probe has run.' }
        : { cause: 'No findings are open. A failing probe opens one here.' }

  // cycle-expression-9: two tables of different grain (a probe, its findings) cannot share one focus, so the effect below joins a probe to its first finding by hand.
  const probeFocus = useChartFocus(rows.probes, {
    announce: (p) => `${p.name}: ${STATE_LABELS[p.state]}, ${p.findings} open findings`,
  })
  const findingFocus = useChartFocus(rows.findings, {
    announce: (f) => `${f.id} on ${f.probe}: open ${f.ageDays} days`,
  })
  const seen = useRef<{ probe: number | null; finding: number | null }>({
    probe: null,
    finding: null,
  })
  useEffect(() => {
    const probe = probeFocus.index
    const finding = findingFocus.index
    const prev = seen.current
    seen.current = { probe, finding }
    if (finding !== prev.finding) {
      const name = finding === null ? null : (rows.findings[finding]?.probe ?? null)
      const target = name === null ? null : rows.probes.findIndex((p) => p.name === name)
      if (target !== probe) probeFocus.set(target === -1 ? null : target)
      return
    }
    if (probe === prev.probe) return
    const name = probe === null ? null : (rows.probes[probe]?.name ?? null)
    const current = finding === null ? null : (rows.findings[finding]?.probe ?? null)
    if (name === current) return
    const target = name === null ? -1 : rows.findings.findIndex((f) => f.probe === name)
    findingFocus.set(target === -1 ? null : target)
  }, [probeFocus, findingFocus, rows.probes, rows.findings])

  const probeTable = useDataTable({
    id: 'n33-probes',
    label: 'Probes',
    columns: [
      probeCol.entity('name', {
        header: 'Probe',
        sub: (p) => (p.findings > 0 ? `${p.findings} open` : null),
        priority: 1,
      }),
      probeCol.status('state', {
        header: 'State',
        options: ['fail', 'stale', 'never', 'pass'],
        labels: STATE_LABELS,
        tone: (s) =>
          s === 'fail' ? 'bad' : s === 'stale' ? 'warn' : s === 'never' ? 'info' : 'neutral',
        priority: 1,
      }),
      probeCol.relativeTime('lastRun', { header: 'Last run', priority: 2 }),
    ],
    data: rows.probes,
    getRowId: (p) => p.id,
    mode: { kind: 'client' },
    now: NOW,
  })

  const findingTable = useDataTable({
    id: 'n33-findings',
    label: 'Open findings',
    columns: [
      findingCol.entity('title', {
        header: 'Finding',
        sub: (f) => `${f.id} on ${f.probe}`,
        subMono: true,
        priority: 1,
      }),
      findingCol.status('severity', {
        header: 'Severity',
        options: ['critical', 'high', 'medium', 'low'],
        labels: SEVERITY_LABELS,
        tone: (s) => (s === 'critical' ? 'bad' : s === 'high' ? 'warn' : 'neutral'),
        priority: 2,
      }),
      findingCol.meter('ageDays', { header: 'Open for (days)', max: maxAge, priority: 1 }),
    ],
    data: rows.findings,
    getRowId: (f) => f.id,
    mode: { kind: 'client' },
  })

  return (
    <Page area="expr-n33">
      <PageBar title="Project hygiene" />
      <StatGroup variant="strip" label="Hygiene">
        <StatCell
          label="Failing probes"
          value={measured ? (ready ? failed.length : 0) : null}
          unit={measured ? `of ${rows.probes.length}` : undefined}
          sub={
            measured
              ? ready
                ? `${stale} stale, ${never} never run`
                : 'stale, never run'
              : 'Not measured yet'
          }
          phase={stripPhase}
        />
        <StatCell
          label="Open findings"
          value={measured ? (ready ? rows.findings.length : 0) : null}
          sub={measured ? (ready ? `${urgent} critical or high` : 'critical or high') : undefined}
          phase={stripPhase}
        />
        <StatCell
          label="Longest open"
          value={measured ? (ready ? (oldest?.ageDays ?? null) : 0) : null}
          unit="days"
          sub={
            measured
              ? ready
                ? oldest
                  ? `${aged} over 30 days`
                  : 'None open'
                : 'over 30 days'
              : undefined
          }
          phase={stripPhase}
        />
      </StatGroup>
      <CardGrid min="regular">
        <DataPanel
          title="Probes"
          subtitle="Failing first"
          phase={phase}
          empty={noProbes}
          bodySize={{ rows: 10 }}
          body={() => <DataTable table={probeTable} focus={probeFocus} height="fill" />}
        />
        <DataPanel
          title="Findings"
          subtitle="Longest open first"
          phase={phase}
          empty={noFindings}
          bodySize={{ rows: 10 }}
          body={() => <DataTable table={findingTable} focus={findingFocus} height="fill" />}
        />
      </CardGrid>
      {probeFocus.live}
      {findingFocus.live}
    </Page>
  )
}
