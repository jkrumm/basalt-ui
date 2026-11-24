import type { ReactElement } from 'react'
import { text } from '@tanstack/charts/text'
import { MessageSquare, Mic, Newspaper } from 'lucide-react'
import { useFormat } from 'basalt-ui'
import { DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import type { LegendEntry } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N80_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  MODELS,
  PRESETS,
  candidatesOf,
  samplesFor,
  winnersOf,
  type Candidate,
  type Preset,
} from './fixture'

const noop = (): void => undefined

const PRESET_NAME: Record<Preset, string> = {
  chat: 'Chat',
  briefing: 'Briefing',
  podcast: 'Podcast',
}
const PRESET_ICON = { chat: MessageSquare, briefing: Newspaper, podcast: Mic } as const

/** One legend for the dots of every pane: the series take their labels from it. */
const LEGEND = [
  { key: 'win', label: 'Preferred', color: N80_SERIES.win, swatch: 'dot' },
  { key: 'rest', label: 'Other models', color: N80_SERIES.rest, swatch: 'dot' },
] as const satisfies readonly LegendEntry[]

/** The five prices a minute: the x axis names exactly these, so a model sits over its price. */
const RATES = MODELS.map((m) => m.rate)

type Row = Candidate & { presetName: string }
const c = col<Row>()

/** The mean rank of a model picked at random among five. */
const CHANCE_RANK = 3

export function ExprN80Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const f = useFormat()
  const samples = shotState === 'empty' ? [] : samplesFor(fixture)
  const candidates: Row[] = candidatesOf(samples).map((d) => ({
    ...d,
    presetName: PRESET_NAME[d.preset],
  }))
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The listening log did not answer.' }
        : 'ready'
  const ready = phase === 'ready'

  const picks = PRESETS.map((preset) => ({ preset, winners: winnersOf(candidates, preset) }))
  const winnerIds = new Set(picks.flatMap((p) => p.winners.map((w) => w.id)))

  /** A value in the ready phase, a dash where nothing was measured, and empty while loading. */
  const held = (v: string | undefined): string => (ready ? (v ?? '–') : '')
  const money = (v: number): string =>
    f.money(v, 'USD', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  const rank = (v: number): string => f.number(v, { maximumFractionDigits: 1 })

  /** The focused candidate in one line: the announcement and the card's period say it alike. */
  const reading = (d: Row): string =>
    d.model +
    ', ' +
    d.preset +
    ': ' +
    (d.meanRank === null ? 'unranked' : 'rank ' + rank(d.meanRank) + ', ' + money(d.costPerMin))
  const focus = useChartFocus(candidates, {
    announce: reading,
  })

  const maxTtfa = Math.max(1, ...candidates.map((d) => d.ttfaMs ?? 0))
  const table = useDataTable({
    id: 'speech-candidates',
    label: 'Speech candidates',
    columns: [
      c.entity('model', { header: 'Model', sub: (r) => r.voice, priority: 1 }),
      c.number('meanRank', { header: 'Rank', digits: 1, priority: 1 }),
      c.meter('ttfaMs', { header: 'First audio, ms', max: maxTtfa, priority: 2, card: 'meta' }),
      c.number('costPerMin', { header: 'US$/min', digits: 3, priority: 2 }),
      c.number('totalMs', { header: 'Total, ms', priority: 2 }),
      c.number('verbatimPct', { header: 'Verbatim, %', priority: 3 }),
      // cycle-expression-16: the table groups only by a column, so the preset is a column the group header repeats
      c.text('presetName', { header: 'Preset', priority: 3, card: 'hidden' }),
    ],
    data: candidates,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    group: { by: 'presetName' },
    phase,
    bodyRows: 18,
    empty: { cause: 'No rows yet. They appear with the next run.' },
  })

  const byModel = MODELS.map((m) => ({
    model: m.name,
    cost: candidates.filter((d) => d.model === m.name).reduce((a, d) => a + d.costPerMin, 0),
    n: candidates.filter((d) => d.model === m.name).length,
  })).filter((m) => m.n > 0)
  const dearest = byModel.toSorted((a, b) => b.cost / b.n - a.cost / a.n)[0]
  const cheapest = byModel.toSorted((a, b) => a.cost / a.n - b.cost / b.n)[0]
  const spread =
    dearest && cheapest ? dearest.cost / dearest.n / (cheapest.cost / cheapest.n) : null

  const ranked = samples.filter((s) => s.rank !== null).length
  const unlogged = samples.filter((s) => s.ttfaMs === null).length

  return (
    <Page area="expr-n80">
      <PageBar title="Speech for chat, briefing and podcast" />
      <StatGroup variant="cards" label="Pick for each use">
        {picks.map(({ preset, winners }) => {
          const win = winners[0]
          const tie = winners.slice(1).map((w) => w.model)
          return (
            <StatCell
              key={preset}
              icon={PRESET_ICON[preset]}
              title={PRESET_NAME[preset]}
              info="The one a blind listen prefers for this preset. Verbatim is the share of its samples a speech-to-text round trip read back word for word."
              phase={phase}
              empty={
                samples.length === 0
                  ? { cause: 'Not measured, no samples yet. Add some to pick.' }
                  : null
              }
              value={win?.model ?? null}
              sub={
                win === undefined
                  ? samples.length > 0
                    ? 'Not measured, no listen yet'
                    : undefined
                  : tie.length > 0
                    ? 'Tied for the lead with ' + tie.join(', ')
                    : undefined
              }
              delta={
                win?.meanRank != null
                  ? {
                      value:
                        (win.meanRank < CHANCE_RANK ? '−' : '+') +
                        rank(Math.abs(win.meanRank - CHANCE_RANK)),
                      polarity: 'neutral',
                      label: 'vs ' + rank(CHANCE_RANK) + ' average',
                    }
                  : undefined
              }
              rows={[
                { label: 'Voice', value: held(win?.voice) },
                {
                  label: 'First audio',
                  value: held(win?.ttfaMs != null ? f.number(win.ttfaMs) + ' ms' : undefined),
                },
                { label: 'Cost a minute', value: held(win ? money(win.costPerMin) : undefined) },
                {
                  label: 'Verbatim',
                  value: held(win ? f.percent(win.verbatimPct / 100) : undefined),
                },
              ]}
            />
          )
        })}
      </StatGroup>
      <div className="grid gap-4 @wide:grid-cols-5">
        <div className="grid @wide:col-span-2">
          <ChartCard
            title="Preference and cost"
            subtitle="Higher is preferred; cost rises to the right"
            phase={phase}
            empty={
              samples.length === 0
                ? { cause: 'Nothing to plot yet. A listen places each one.' }
                : null
            }
            height="tall"
            figure={{
              value:
                ready && spread !== null
                  ? f.number(spread, { maximumFractionDigits: 0 }) + '×'
                  : null,
              unit: 'dearest to cheapest',
              period: focus.readout(
                ready && dearest && cheapest ? dearest.model + ' against ' + cheapest.model : '',
                reading,
              ),
            }}
            legend={LEGEND}
            footer={[
              {
                label: 'Ranked',
                value: ready ? ranked + ' of ' + samples.length : '',
              },
              { label: 'No latency', value: ready ? String(unlogged) : '' },
            ]}
            panes={PRESETS.map((preset, i) => ({
              weight: i === PRESETS.length - 1 ? 1.5 : 1,
              chart: (box) => (
                <CartesianChart<Row>
                  label={'Where each model places for ' + preset}
                  data={candidates}
                  height={box.height}
                  focus={focus}
                  tooltip={false}
                  x={{
                    value: (d) => d.costPerMin,
                    scale: 'log',
                    domain: [0.011, 0.2],
                    ticks: i === PRESETS.length - 1 ? RATES : [],
                    tickFormat: (v) => money(Number(v)),
                    format: (v) => money(Number(v)),
                    ...(i === PRESETS.length - 1 ? { title: 'US$ a minute, log scale' } : {}),
                  }}
                  // cycle-expression-16: the kit has no reversed y domain, so the axis plots the negated rank and prints its absolute value
                  y={{
                    domain: [-5.6, -0.4],
                    title: PRESET_NAME[preset] + ': mean rank',
                    format: (v) => String(Math.abs(v)),
                  }}
                  series={[
                    {
                      mark: 'dot',
                      key: 'win',
                      label: LEGEND[0].label,
                      color: N80_SERIES.win,
                      legend: false,
                      y: (d) =>
                        d.preset === preset && winnerIds.has(d.id) && d.meanRank !== null
                          ? -d.meanRank
                          : null,
                      format: (v) => rank(Math.abs(v)),
                    },
                    {
                      mark: 'dot',
                      key: 'rest',
                      label: LEGEND[1].label,
                      color: N80_SERIES.rest,
                      legend: false,
                      y: (d) =>
                        d.preset === preset && !winnerIds.has(d.id) && d.meanRank !== null
                          ? -d.meanRank
                          : null,
                      format: (v) => rank(Math.abs(v)),
                    },
                  ]}
                  zones={
                    candidates.some((d) => d.preset === preset && d.meanRank !== null)
                      ? []
                      : [
                          {
                            axis: 'x',
                            from: RATES[0] ?? 0,
                            to: RATES.at(-1) ?? 0,
                            fill: alpha(BASALT.ink, 0.04),
                            label: 'Not ranked yet',
                          },
                        ]
                  }
                  // cycle-expression-16: a dot series has no direct label, so each model is named by a text mark placed by chartLabels
                  marks={CartesianChart.custom<Row>((plot) => {
                    const own = candidates.filter((d) => d.preset === preset && d.meanRank !== null)
                    const r = BASALT.dotR + 1
                    const dots = own.map((d) => ({
                      left: (plot.x(d.costPerMin) ?? 0) - r,
                      top: plot.y(-(d.meanRank ?? 0)) - r,
                      width: 2 * r,
                      height: 2 * r,
                    }))
                    const byId = new Map(own.map((d) => [d.id, d]))
                    const { placed } = chartLabels.place(
                      own.map((d) => ({
                        key: d.id,
                        text: winnerIds.has(d.id) ? d.model + ' ' + rank(d.meanRank ?? 0) : d.model,
                        x: plot.x(d.costPerMin) ?? 0,
                        y: plot.y(-(d.meanRank ?? 0)),
                        priority: winnerIds.has(d.id) ? 2 : 1,
                      })),
                      { width: plot.plotWidth, height: plot.plotHeight },
                      { obstacles: dots, gap: BASALT.dotR + 3 },
                    )
                    return [
                      text(placed, {
                        x: (l) => byId.get(l.key)?.costPerMin ?? 0,
                        y: (l) => -(byId.get(l.key)?.meanRank ?? 0),
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
              ),
            }))}
          />
        </div>
        <div className="grid @wide:col-span-3">
          <DataPanel
            title="Every model and voice"
            subtitle="Best first; latency is a median of four samples"
            phase={phase}
            bodySize={{ rows: 19 }}
            body={() => <DataTable table={table} height="fill" focus={focus} />}
          />
        </div>
      </div>
    </Page>
  )
}
