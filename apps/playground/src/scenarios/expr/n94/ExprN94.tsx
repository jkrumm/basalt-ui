import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import { text } from '@tanstack/charts/text'
import { N94_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { TODAY, detectorsFor } from './fixture'
import type { Detector } from './fixture'

/** The mute rule: noise strictly above half of at least three decided Issues. */
const MUTE_SHARE = 0.5
const FLOOR = 3

type Verdict = 'ask-again' | 'muted' | 'on-line' | 'under' | 'few' | 'none'

type Row = Detector & {
  /** Noise over decided as a fraction; null when nothing was decided. */
  share: number | null
  sharePct: number | null
  judged: boolean
  past: boolean
  /** Points past (or under) the mute line; null below the floor. */
  pts: number | null
  ratio: string
  verdict: Verdict
}

function analyse(d: Detector): Row {
  const share = d.decided === 0 ? null : d.noise / d.decided
  const judged = d.decided >= FLOOR
  const past = judged && share !== null && share > MUTE_SHARE
  const pts = judged && share !== null ? Math.round((share - MUTE_SHARE) * 100) : null
  const verdict = ((): Verdict => {
    if (d.muteUntil !== null && d.muteUntil < TODAY) return 'ask-again'
    if (d.muteUntil !== null) return 'muted'
    if (d.decided === 0) return 'none'
    if (!judged) return 'few'
    return past ? 'muted' : share === MUTE_SHARE ? 'on-line' : 'under'
  })()
  return {
    ...d,
    share,
    sharePct: share === null ? null : share * 100,
    judged,
    past,
    pts,
    ratio:
      d.decided > 0 ? `${d.noise} of ${d.decided}` : d.open > 0 ? `none, ${d.open} open` : 'none',
    verdict,
  }
}

/** Most noise first, then the detectors under the floor, then the ones with nothing decided. */
const rank = (r: Row): number => (r.share === null ? -2 : r.judged ? r.share : r.share - 2)
const byNoise = (a: Row, b: Row): number => rank(b) - rank(a)

const VERDICT_WORD: Record<Verdict, string> = {
  'ask-again': 'Ask again',
  muted: 'Muted',
  'on-line': 'On the line',
  under: 'Under the line',
  few: 'Too few decided',
  none: 'Nothing decided',
}

const VERDICTS = ['ask-again', 'muted', 'on-line', 'under', 'few', 'none'] as const

const c = col<Row>()

const COLUMNS = [
  c.entity('name', { header: 'Detector', priority: 1, card: 'title' }),
  c.text('ratio', { header: 'Noise count', sortable: false, priority: 1, card: 'value' }),
  c.status('verdict', {
    header: 'Verdict',
    options: VERDICTS,
    labels: VERDICT_WORD,
    tone: (v) => (v === 'ask-again' ? 'warn' : v === 'muted' ? 'accent' : 'neutral'),
    priority: 2,
    card: 'meta',
  }),
  c.date('muteUntil', { header: 'Mute until', mono: true, priority: 2 }),
  c.delta('pts', { header: 'Past the line', polarity: 'neutral', unit: ' pts', priority: 3 }),
  // cycle-expression-19: c.meter prints its raw number with no unit, so the share is a number column.
  c.number('open', { header: 'Open Issues', priority: 3 }),
  c.number('sharePct', { header: 'Noise share', unit: '%', digits: 0, priority: 3 }),
  c.text('loop', { header: 'Loop', priority: 3 }),
]

/** The two empty slots a loading or empty frame holds. */
const HELD_FACTS = [
  { label: 'Ask again', value: '' },
  { label: 'Too few decided', value: '' },
] as const

const RETRY = (): void => undefined

export function ExprN94Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const empty = shotState === 'empty'
  const rows = (empty ? [] : detectorsFor(fixture).map(analyse)).sort(byNoise)
  const rowCount = detectorsFor(fixture).length
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? {
            tag: 'error',
            retry: RETRY,
            message: 'The factory did not answer, so no detector can be judged.',
          }
        : 'ready'
  const ready = phase === 'ready'

  const read = (d: Row): string => {
    if (d.decided === 0) return `${d.name}: none decided, ${d.open} open`
    if (!d.judged) return `${d.name}: ${d.ratio} noise, too few decided`
    const line =
      d.pts === null || d.pts === 0
        ? 'on the line'
        : `${d.pts > 0 ? '+' : '\u2212'}${Math.abs(d.pts)} pts`
    return `${d.name}: ${d.ratio} noise, ${line}`
  }
  const focus = useChartFocus(rows, { announce: read })

  const table = useDataTable({
    id: 'n94-detectors',
    label: 'Detectors',
    columns: COLUMNS,
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: rowCount,
    phone: 'columns',
  })

  const judged = rows.filter((r) => r.judged)
  const past = judged.filter((r) => r.past)
  const due = rows.filter((r) => r.verdict === 'ask-again')
  const few = rows.filter((r) => r.decided < FLOOR)
  const dueName = due[0]?.name
  const byId = new Map(rows.map((r) => [r.id, r]))
  const unjudged = rows.filter((r) => !r.judged)
  const brand = { light: BASALT.brand, dark: BASALT.brand }

  const footer = ready
    ? ([
        {
          label: HELD_FACTS[0].label,
          value:
            dueName === undefined
              ? 'None'
              : `${dueName}${due.length > 1 ? ` +${due.length - 1}` : ''}`,
        },
        { label: HELD_FACTS[1].label, value: `${few.length} of ${rows.length}` },
      ] as const)
    : HELD_FACTS

  return (
    <Page area="n94">
      <PageBar title="Detector noise, last 30 days" />
      <div className="grid gap-3 @wide:grid-cols-2">
        <ChartCard
          title="Detectors past the mute line"
          subtitle="Share of decided Issues dropped as noise"
          phase={phase}
          empty={
            empty
              ? {
                  cause: 'No detector filed an Issue in 30 days. Switch one on to start the count.',
                }
              : null
          }
          height="tall"
          figure={{
            value: ready && judged.length > 0 ? past.length : null,
            unit: ready && judged.length > 0 ? `of ${judged.length} judged` : '',
            period: ready
              ? focus.readout(
                  judged.length > 0
                    ? `${rows.length} detectors, most noise first`
                    : `Nothing judged yet, every detector has under ${FLOOR} decided`,
                  read,
                )
              : '',
          }}
          legend={[
            { key: 'past', label: 'Past it', color: brand, swatch: 'bar' },
            { key: 'rest', label: 'On or under it', color: N94_SERIES.noise, swatch: 'bar' },
          ]}
          footer={footer}
          chart={() => (
            <CartesianChart<Row>
              label="Share of decided Issues dropped for each detector, with the mute line"
              summary={`${past.length} of ${judged.length} judged detectors are past the mute line at ${f.percent(MUTE_SHARE)}.`}
              data={rows}
              focus={focus}
              tooltip={false}
              x={{ value: (d) => d.name }}
              y={{
                domain: [0, 100],
                format: (v) => f.percent(v / 100),
              }}
              refLines={[
                {
                  value: MUTE_SHARE * 100,
                  color: N94_SERIES.line,
                  dashed: true,
                  label: 'Mute line',
                },
              ]}
              series={[
                {
                  mark: 'bar',
                  key: 'share',
                  label: 'Share dropped',
                  color: N94_SERIES.noise,
                  legend: false,
                  y: (d) => (d.judged ? d.sharePct : null),
                  format: (v) => f.percent(v / 100),
                  highlight: (d) => d.past,
                  values: (v, d) =>
                    d.past && d.pts !== null ? `+${d.pts} pts` : f.percent(v / 100),
                },
              ]}
              marks={CartesianChart.custom<Row>((plot) => {
                // cycle-expression-19: a bar series cannot word a band with no value, so a text mark names the detectors under the floor and with nothing decided.
                const { placed } = chartLabels.place(
                  unjudged.map((r) => ({
                    key: r.id,
                    text: r.decided === 0 ? 'none' : r.ratio,
                    x: plot.x(r.name) ?? 0,
                    y: plot.y(0),
                  })),
                  { width: plot.plotWidth, height: plot.plotHeight },
                  { gap: 4 },
                )
                return [
                  text(placed, {
                    x: (l) => byId.get(l.key)?.name ?? '',
                    y: () => 0,
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
          title="Mute status per detector"
          subtitle={`Muted when noise passes ${f.percent(MUTE_SHARE)} of ${FLOOR}+ decided`}
          phase={phase}
          empty={empty ? { cause: 'Nothing to list.' } : null}
          bodySize={{ rows: rowCount + 1, cardHeight: 33 }}
          body={() => <DataTable table={table} focus={focus} height="fill" />}
        />
      </div>
    </Page>
  )
}
