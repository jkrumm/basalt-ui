import { dot } from '@tanstack/charts/dot'
import { text } from '@tanstack/charts/text'
import { createFormat } from 'basalt-ui'
import type { Empty, Phase } from 'basalt-ui/cards'
import { DataPanel } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar, QueryState } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import { MODEL_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  REASONS,
  canTake,
  chatCost,
  chatTokens,
  fitOf,
  scenarioFor,
  type Fit,
  type Model,
} from './fixture'

type Row = Model & { cost: number; fit: Fit }

const FITS = [
  'recommended',
  'current',
  'no-vision',
  'too-small',
  'ok',
] as const satisfies readonly Fit[]
const FIT_LABELS: Record<Fit, string> = {
  recommended: 'Recommended',
  current: 'Current',
  'no-vision': 'No vision',
  'too-small': 'Too small',
  ok: 'Fits',
}

/** The y axis stops here, so one very dear model reads as a caret and not as a flat plot. */
const COST_CAP = 3

const c = col<Row>()
const fmt = createFormat()
const COLUMNS = [
  c.entity('name', { header: 'Model', sub: (r) => r.provider, priority: 1 }),
  c.money('cost', { header: 'Chat cost', currency: 'USD', priority: 2 }),
  c.number('speed', { header: 'Speed', unit: 'tok/s', priority: 2 }),
  c.status('fit', {
    header: 'This chat',
    options: FITS,
    labels: FIT_LABELS,
    tone: (f) => (f === 'recommended' ? 'accent' : 'neutral'),
    priority: 1,
  }),
  c.number('contextK', { header: 'Context', unit: 'K', priority: 2 }),
  // cycle-expression-6: a row of two prices and a row of three capability flags each need one column; the kit has no pair-of-values or flag-set column kind, so both are custom.
  c.custom('price', {
    header: 'Price per M, in / out',
    render: (r) => (
      <span className="tabular-nums">
        {fmt.money(r.inPrice, 'USD')} / {fmt.money(r.outPrice, 'USD')}
      </span>
    ),
    sortValue: (r) => r.outPrice,
    align: 'end',
    card: 'meta',
    width: 26,
    priority: 2,
  }),
  c.custom('capabilities', {
    header: 'Capabilities',
    render: (r) =>
      [r.vision ? 'Vision' : null, r.tools ? 'Tools' : null, r.reasoning ? 'Reasoning' : null]
        .filter((x) => x !== null)
        .join(', ') || 'None',
    sortValue: (r) => Number(r.vision) * 4 + Number(r.tools) * 2 + Number(r.reasoning),
    card: 'detail',
    width: 28,
    priority: 2,
  }),
]

const usd = (n: number): string => fmt.money(n, 'USD')
const k = (n: number): string => `${fmt.number(n / 1000, { maximumFractionDigits: 1 })}K`

const ERROR_PHASE: Phase = {
  tag: 'error',
  message: 'Model service not answering. Retry, or check that it is running.',
  retry: () => undefined,
}

export function ExprC16Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const scenario = scenarioFor(fixture)
  const { chat } = scenario
  const isEmpty = shotState === 'empty'
  const models = shotState === 'loading' || shotState === 'error' || isEmpty ? [] : scenario.models
  const phase: Phase =
    shotState === 'loading' ? 'loading' : shotState === 'error' ? ERROR_PHASE : 'ready'
  const empty: Empty | null = isEmpty
    ? {
        cause: 'No models are enabled for this workspace. Enable one to compare costs.',
        action: { label: 'Open settings', href: '/settings' },
      }
    : null

  const rows: readonly Row[] = models.map((m) => ({
    ...m,
    cost: chatCost(m, chat),
    fit: fitOf(m, scenario),
  }))
  const current = models.find((m) => m.id === scenario.currentId)
  const picked = models.find((m) => m.id === scenario.recommendedId)
  const currentCost = current ? chatCost(current, chat) : null
  const pickedCost = picked ? chatCost(picked, chat) : null
  const byId = new Map(models.map((m) => [m.id, m]))

  const focus = useChartFocus(rows, {
    announce: (m) =>
      `${m.name}: ${m.speed} tokens per second, ${usd(chatCost(m, chat))} for this chat, ${
        canTake(m, chat) ? 'takes this chat' : 'cannot take this chat'
      }`,
  })

  const table = useDataTable({
    id: 'models',
    label: 'Models compared',
    columns: COLUMNS,
    data: rows,
    phase: 'ready',
    phone: 'scroll',
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })

  const saved = currentCost !== null && pickedCost !== null ? currentCost - pickedCost : null
  const overCap = currentCost !== null && currentCost > COST_CAP

  // The failure and the empty catalogue are said once, for the whole page, not in each card.
  if (shotState === 'error' || isEmpty) {
    return (
      <Page area="expr-c16">
        <PageBar title="Switch model" />
        <QueryState phase={phase} empty={empty} />
      </Page>
    )
  }

  return (
    <Page area="expr-c16">
      <PageBar title="Switch model" />
      <ChartCard
        title="Recommended for this chat"
        subtitle={`Needs vision and ${k(chatTokens(chat))} of context for ${chat.images} images`}
        phase={phase}
        figure={{
          // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle c16, kept as its builder left it: its figure follows focus, built before figure-readout
          value: focus.readout(picked?.name ?? '—', (m) => m.name),
          period: focus.readout(
            picked && saved !== null
              ? `${REASONS[picked.id] ?? ''}, saves ${usd(saved)} on this chat`
              : '—',
            (m) => `${usd(chatCost(m, chat))} on this chat, ${m.speed} tok/s`,
          ),
        }}
        footer={[
          { label: 'Input', value: `${k(chat.inputTokens)} tokens` },
          { label: 'Output', value: `${k(chat.outputTokens)} tokens` },
        ]}
        chart={() => (
          <CartesianChart
            label="Tokens per second against the cost of this chat, one dot per model"
            data={rows}
            focus={focus}
            x={{
              value: (m) => m.speed,
              title: 'Speed, tokens per second',
              domain: [0, Math.ceil(Math.max(...models.map((m) => m.speed)) * 1.08)],
            }}
            y={{
              title: 'Cost of this chat, USD',
              domain: ([lo, hi]) => [Math.min(lo, 0), Math.min(hi * 1.08, COST_CAP)],
              format: (v) => usd(v),
            }}
            series={[
              {
                mark: 'dot',
                key: 'pick',
                label: 'Recommended',
                color: MODEL_SERIES.pick,
                y: (m) => (m.id === scenario.recommendedId ? chatCost(m, chat) : null),
                format: (v) => usd(v),
              },
              {
                mark: 'dot',
                key: 'fits',
                label: 'Takes this chat',
                color: MODEL_SERIES.fits,
                y: (m) =>
                  m.id !== scenario.recommendedId && m.id !== scenario.currentId && canTake(m, chat)
                    ? chatCost(m, chat)
                    : null,
                format: (v) => usd(v),
              },
              {
                mark: 'dot',
                key: 'blocked',
                label: 'No vision or window too small',
                color: MODEL_SERIES.blocked,
                y: (m) =>
                  m.id !== scenario.currentId && !canTake(m, chat) ? chatCost(m, chat) : null,
                format: (v) => usd(v),
              },
              {
                mark: 'dot',
                key: 'now',
                label: 'Current model',
                color: MODEL_SERIES.current,
                r: () => BASALT.dotR + 2,
                y: (m) => (m.id === scenario.currentId ? chatCost(m, chat) : null),
                format: (v) => usd(v),
              },
            ]}
            refLines={
              current && currentCost !== null
                ? [
                    {
                      value: Math.min(currentCost, COST_CAP),
                      color: MODEL_SERIES.current,
                      dashed: true,
                      label: overCap
                        ? `Current, ${usd(currentCost)} off scale`
                        : `Current, ${usd(currentCost)}`,
                    },
                  ]
                : []
            }
            tooltip={{
              formatHeader: (m) => m.name,
              rows: (m) => [
                { label: 'Cost of this chat', value: usd(chatCost(m, chat)) },
                { label: 'Speed', value: `${m.speed} tok/s` },
                { label: 'Context', value: k(m.contextK * 1000) },
                { label: 'Reads images', value: m.vision ? 'Yes' : 'No' },
              ],
            }}
            // cycle-expression-6: the kit has no per-dot name label on a scatter, so each model is named by a placed text mark.
            marks={CartesianChart.custom<Row>((plot) => {
              const r = BASALT.dotR + 1
              const dots = plot.data.flatMap((m) => {
                const px = plot.x(m.speed)
                if (px === null) return []
                const py = Math.max(0, plot.y(chatCost(m, chat)))
                return [{ left: px - r, top: py - r, width: 2 * r, height: 2 * r }]
              })
              // cycle-expression-6: a ref line is not a label obstacle, so the current model's cost rule is passed in as a thin box.
              const rule =
                currentCost !== null && !overCap
                  ? [
                      {
                        left: 0,
                        top: plot.y(Math.min(currentCost, COST_CAP)) - 1,
                        width: plot.plotWidth,
                        height: 2,
                      },
                    ]
                  : []
              const { placed } = chartLabels.place(
                plot.data.flatMap((m) => {
                  const px = plot.x(m.speed)
                  if (px === null) return []
                  return [
                    {
                      key: m.id,
                      text: m.name,
                      x: px,
                      y: Math.max(0, plot.y(chatCost(m, chat))),
                      priority:
                        m.id === scenario.recommendedId || m.id === scenario.currentId ? 2 : 1,
                    },
                  ]
                }),
                { width: plot.plotWidth, height: plot.plotHeight },
                { obstacles: [...dots, ...rule], gap: BASALT.dotR + 3 },
              )
              // cycle-expression-6: the kit draws no ring on the current dot or the list-focused dot, so a hollow dot mark is drawn at each.
              const ringed = [
                ...plot.data.filter((m) => m.id === scenario.currentId),
                ...(plot.focused === null || plot.focused.id === scenario.currentId
                  ? []
                  : [plot.focused]),
              ]
              return [
                dot(ringed, {
                  x: (m) => m.speed,
                  y: (m) => Math.min(COST_CAP, chatCost(m, chat)),
                  r: BASALT.dotR + 4,
                  fill: 'none',
                  stroke: BASALT.ink,
                  strokeWidth: 1.5,
                }),
                text(placed, {
                  x: (l) => byId.get(l.key)?.speed ?? 0,
                  y: (l) => Math.min(COST_CAP, chatCost(byId.get(l.key) ?? plot.data[0]!, chat)),
                  text: (l) => l.text,
                  dx: (l) => l.dx,
                  dy: (l) => l.dy,
                  anchor: (l) => l.textAnchor,
                  fill: BASALT.ink,
                  fontSize: BASALT.text.micro,
                }),
              ]
            })}
          />
        )}
      />
      <DataPanel
        title="Compare models"
        subtitle={`Prices per million tokens; chat cost is for ${k(chatTokens(chat))} tokens so far`}
        phase={phase}
        bodySize={{ rows: 9 }}
        body={() => <DataTable table={table} focus={focus} />}
      />
    </Page>
  )
}
