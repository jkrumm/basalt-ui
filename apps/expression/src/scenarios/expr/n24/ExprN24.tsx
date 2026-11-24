import { useFormat } from 'basalt-ui'
import { text } from '@tanstack/charts/text'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import type { Phase } from 'basalt-ui/cards'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'

import { SPEND_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { fixtureRows } from './fixture'
import type { Workflow } from './fixture'

const workflow = col<Workflow>()

const PURPOSES = ['production', 'eval', 'verify', 'other', 'unset'] as const
const LABELS = {
  production: 'Production',
  eval: 'Eval',
  verify: 'Verify',
  other: 'Other',
  unset: 'No purpose set',
} as const

const ERROR: Phase = {
  tag: 'error',
  message: 'The gateway spend report did not load.',
  retry: () => undefined,
}

const sum = (rows: readonly Workflow[], pick: (w: Workflow) => number): number =>
  rows.reduce((total, w) => total + pick(w), 0)

export function ExprN24Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const rows = shotState === 'empty' ? [] : fixtureRows(fixture)
  const phase: Phase = shotState === 'loading' ? 'loading' : shotState === 'error' ? ERROR : 'ready'
  return (
    <Page area="gateway-spend">
      <PageBar title="AI gateway spend" />
      <Spend rows={rows} phase={phase} />
    </Page>
  )
}

// cycle-expression-7: a band axis has no rotated or wrapped labels, so each workflow is named by the first word of its id
const shortName = (name: string): string => {
  const word = name.split('-')[0] ?? name
  return word.length > 8 ? `${word.slice(0, 7)}…` : word
}

function Spend({ rows, phase }: { rows: readonly Workflow[]; phase: Phase }): ReactElement {
  const f = useFormat()
  const usd = (n: number): string =>
    f.money(n, 'USD', { currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 })
  const usdCompact = (n: number): string =>
    f.money(n, 'USD', {
      currencyDisplay: 'narrowSymbol',
      notation: 'compact',
      maximumFractionDigits: 1,
    })
  const total = sum(rows, (w) => w.total)
  const production = sum(rows, (w) => w.production)
  const restShare = total === 0 ? 0 : production / total
  const focus = useChartFocus(rows, {
    announce: (w) =>
      `${w.name}: ${usd(w.total)}, ${f.percent(w.share / 100, { maximumFractionDigits: 0 })} production, billed to ${w.payer}`,
  })
  const named = rows.map((w) => w.name)
  const showing = phase === 'ready' && rows.length > 0
  const empty = {
    cause:
      'No spend was billed through the gateway in the last 30 days. Check that the gateway is reporting, then reload.',
  }

  const table = useDataTable({
    id: 'gateway-workflows',
    label: 'Workflows by spend',
    columns: [
      workflow.entity('name', { header: 'Workflow' }),
      workflow.money('total', { currency: 'USD', header: 'Spend' }),
      workflow.text('payer', { header: 'Payer', priority: 2 }),
      workflow.number('share', { header: 'Production', unit: '%', digits: 0, priority: 3 }),
    ],
    data: phase === 'ready' ? rows : undefined,
    getRowId: (w) => w.id,
    mode: { kind: 'client' },
    phase,
    empty,
  })

  return (
    <div className="grid min-w-0 gap-4 @wide:grid-cols-2">
      <ChartCard
        title="Spend by workflow"
        subtitle="Last 30 days"
        phase={phase}
        empty={rows.length === 0 ? empty : null}
        figure={
          showing
            ? {
                // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n24, kept as its builder left it: its figure follows focus, built before figure-readout
                value: focus.readout(f.percent(restShare, { maximumFractionDigits: 0 }), (w) =>
                  f.percent(w.share / 100, { maximumFractionDigits: 0 }),
                ),
                period: focus.readout(
                  `of ${usd(total)} is production`,
                  (w) => `of ${w.name}, ${usd(w.total)}, billed to ${w.payer}`,
                ),
              }
            : undefined
        }
        footer={
          showing
            ? [
                {
                  label: 'Platform',
                  value: usd(
                    sum(
                      rows.filter((w) => w.payer === 'Platform'),
                      (w) => w.total,
                    ),
                  ),
                },
                {
                  label: 'Product',
                  value: usd(
                    sum(
                      rows.filter((w) => w.payer === 'Product'),
                      (w) => w.total,
                    ),
                  ),
                },
              ]
            : undefined
        }
        chart={() => (
          <CartesianChart
            label="Dollars spent per workflow over 30 days, stacked by purpose"
            summary="Spend per workflow, stacked by purpose, largest first; production is the bottom segment."
            data={rows}
            x={{ value: (w) => w.name, format: (v) => shortName(String(v)), ticks: named }}
            y={{
              format: usdCompact, // cycle-expression-7: no label headroom option, so the y domain is stretched by hand
              domain: ([, hi]) => [0, hi * 1.15],
            }}
            tooltip={false}
            focus={focus}
            series={PURPOSES.map((key) => ({
              mark: 'bar' as const,
              key,
              label: LABELS[key],
              color: SPEND_SERIES[key],
              y: (w: Workflow) => w[key],
              format: (v: number) => usd(v),
            }))}
            marks={CartesianChart.custom<Workflow>((plot) => {
              const byName = new Map(rows.map((w) => [w.name, w]))
              // cycle-expression-7: Bars and the stack take no per-bar value label, so the totals are text marks placed by chartLabels
              const labelled = rows.filter(
                (w, i) => i < (plot.plotWidth < 500 ? 1 : 3) || w.total === 0,
              )
              const { placed } = chartLabels.place(
                labelled.map((w) => ({
                  key: w.name,
                  text: usdCompact(w.total),
                  x: plot.x(w.name) ?? 0,
                  y: plot.y(w.total),
                })),
                { width: plot.plotWidth, height: plot.plotHeight },
                { gap: 4 },
              )
              return [
                text(placed, {
                  x: (l) => l.key,
                  y: (l) => byName.get(l.key)?.total ?? 0,
                  text: (l) => l.text,
                  dx: (l) => l.dx,
                  dy: (l) => l.dy,
                  anchor: (l) => l.textAnchor,
                }),
              ]
            })}
          />
        )}
      />
      {phase === 'ready' && rows.length === 0 ? null : (
        <Section title="Workflows">
          <DataTable table={table} focus={focus} />
        </Section>
      )}
    </div>
  )
}
