import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Delta, Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { STUCK_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { STAGES, STUCK_AFTER, issuesFor } from './fixture'
import type { Issue } from './fixture'

const c = col<Issue>()

const ERROR: Phase = {
  tag: 'error',
  message: 'The Issue board did not answer.',
  // owner-review-1: a fixture has no query to refetch, so Retry does nothing here
  retry: () => undefined,
}

export function ExprN02Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const ready = shotState === undefined
  const phase: Phase = shotState === 'loading' ? 'loading' : shotState === 'error' ? ERROR : 'ready'
  const all = shotState === 'empty' ? [] : issuesFor(fixture)

  // The chart reads in pipeline order, the longest over typical first inside a stage; the table the same Issues, longest first.
  const byStage = [...all].sort(
    (a, b) =>
      STAGES.findIndex((s) => s.key === a.stage) - STAGES.findIndex((s) => s.key === b.stage) ||
      a.ratio - b.ratio,
  )
  const byRatio = [...all].sort((a, b) => b.ratio - a.ratio)
  const stuck = byRatio.filter((d) => d.stuck)
  const longest = byRatio[0]
  const topStage = STAGES.map((s) => ({
    label: s.label,
    n: stuck.filter((d) => d.stage === s.key).length,
  })).sort((a, b) => b.n - a.n)[0]

  const hours = (h: number) => `${f.number(h, { maximumFractionDigits: 1 })} h`
  const signed = (h: number) => `${h < 0 ? '\u2212' : '+'}${hours(Math.abs(h))}`

  const focus = useChartFocus(byStage, {
    announce: (d) =>
      `${d.id}, ${d.title}, ${d.stageLabel}: ${hours(d.hours)} in stage, ${f.number(d.ratio, { maximumFractionDigits: 1 })}\u00d7 typical (${hours(d.typical)})`,
  })

  const table = useDataTable({
    id: 'stuck-issues',
    label: 'Open Issues',
    columns: [
      c.entity('id', {
        header: 'Issue',
        mono: true,
        sub: (d) => `${d.verdict} in ${d.stageLabel}, typical ${hours(d.typical)}`,
        priority: 1,
      }),
      c.number('hours', { header: 'In stage', unit: 'h', digits: 1, priority: 1 }),
      c.meter('ratio', {
        header: '\u00d7 typical',
        max: Math.max(1, byRatio[0]?.ratio ?? 1),
        priority: 2,
      }),
    ],
    // owner-review-1: the meter column has no number format and prints the raw ratio (2.733), so the rows carry it rounded
    data: byRatio.map((d) => ({ ...d, ratio: Math.round(d.ratio * 10) / 10 })),
    getRowId: (d) => d.id,
    mode: { kind: 'client' },
    bodyRows: 12,
  })

  const zones = STAGES.flatMap((s, i) => {
    const rows = byStage.filter((d) => d.stage === s.key)
    const first = rows[0]
    const last = rows.at(-1)
    if (first === undefined || last === undefined) return []
    return [
      {
        axis: 'x' as const,
        from: first.id,
        to: last.id,
        fill: alpha(BASALT.ink, i % 2 === 0 ? 0.05 : 0.02),
        label: s.label,
      },
    ]
  })

  return (
    <Page area="expr-n02">
      <PageBar title="Open Issues by pipeline stage" />
      <div className="grid gap-3 @wide:grid-cols-2">
        <ChartCard
          title="Time in stage"
          subtitle={`Stuck is more than ${STUCK_AFTER}\u00d7 the stage's typical time`}
          height="tall"
          phase={phase}
          empty={all.length === 0 ? { cause: 'No Issues are open, so none can be stuck.' } : null}
          figure={{
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n02, kept as its builder left it: its figure follows focus, built before figure-readout
            value: ready
              ? focus.readout(String(stuck.length), (d) =>
                  f.number(d.hours, { maximumFractionDigits: 1 }),
                )
              : null,
            unit: ready ? focus.readout('stuck', () => 'h in stage') : undefined,
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n02, kept as its builder left it: its figure follows focus, built before figure-readout
            delta: ready
              ? focus.readout<Delta>(
                  { value: `of ${all.length} open`, polarity: 'neutral' as const },
                  (d) => ({
                    value: signed(d.hours - d.typical),
                    polarity: d.stuck ? ('up-bad' as const) : ('neutral' as const),
                    label: 'vs typical',
                  }),
                )
              : undefined,
            period: ready
              ? focus.readout(
                  stuck.length === 0 ? 'none past typical' : `most in ${topStage?.label ?? ''}`,
                  (d) => `${d.stageLabel}, typical ${hours(d.typical)}`,
                )
              : undefined,
          }}
          footer={
            ready
              ? [
                  longest === undefined
                    ? null
                    : { label: 'Longest', value: longest.id, mono: true },
                  longest === undefined ? null : { label: 'Held for', value: hours(longest.hours) },
                ]
              : [
                  { label: 'Longest', value: '' },
                  { label: 'Held for', value: '' },
                ]
          }
          legend={[
            { key: 'stuck', label: 'Stuck', color: STUCK_SERIES.stuck, swatch: 'bar' },
            { key: 'ok', label: 'On pace', color: STUCK_SERIES.ok, swatch: 'bar' },
          ]}
          chart={() => (
            <CartesianChart
              label="Time in stage as a multiple of its typical, one bar per open Issue"
              data={byStage}
              focus={focus}
              tooltip={false}
              x={{ value: (d) => d.id, ticks: stuck.map((d) => d.id) }}
              y={{
                title: 'Multiple of typical',
                domain: ([, hi]) => [0, Math.min(Math.max(hi * 1.5, 2.5), 8)],
                format: (v) => `${v}\u00d7`,
              }}
              zones={zones}
              refLines={[
                { value: 1, color: STUCK_SERIES.typical, dashed: true },
                { value: STUCK_AFTER, color: STUCK_SERIES.rule, dashed: true },
              ]}
              series={[
                {
                  mark: 'bar',
                  key: 'ok',
                  label: 'On pace',
                  color: STUCK_SERIES.ok,
                  y: (d) => d.ratio,
                  highlight: (d) => d.stuck,
                  values: (_, d) => (d.stuck ? hours(d.hours) : ''),
                },
              ]}
            />
          )}
        />
        <DataPanel
          title="Open Issues"
          subtitle="Longest over typical first"
          phase={phase}
          empty={all.length === 0 ? { cause: 'Open Issues are listed here as they arrive.' } : null}
          bodySize={{ height: 480 }}
          body={() => <DataTable table={table} focus={focus} height="fill" />}
        />
      </div>
    </Page>
  )
}
