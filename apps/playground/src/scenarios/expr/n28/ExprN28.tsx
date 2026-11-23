import { text } from '@tanstack/charts/text'
import { useFormat } from 'basalt-ui'
import { BarList } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { HOUSEHOLD_SERIES as SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { LAST_COMPLETE, MONTHS, PARTIAL, buildCategories } from './fixture'
import type { Category, Variant } from './fixture'

type MonthRow = { key: string; full: string; value: number; kind: 'earlier' | 'last' | 'partial' }

const EMPTY_CAUSE = 'No spending is booked for this household yet; link an account to start.'
const EMPTY_QUIET = 'Nothing to show until spending is booked.'

export function ExprN28Scenario({ shotState, fixture }: ScenarioProps) {
  const fmt = useFormat()
  const eur = (n: number) => fmt.money(n, 'EUR', { maximumFractionDigits: 0 })
  // cycle-expression-8: the kit has no signed money format, so the true minus is written here
  const signed = (n: number) => (n === 0 ? eur(0) : `${n < 0 ? '−' : '+'}${eur(Math.abs(n))}`)

  const variant: Variant = fixture === 'extreme' ? 'extreme' : 'default'
  const rows = shotState === 'empty' ? [] : buildCategories(variant)
  const phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? ({
            tag: 'error',
            message: 'The spending feed did not respond.',
            retry: () => location.reload(),
          } as const)
        : 'ready'
  const empty = shotState === 'empty' ? { cause: EMPTY_QUIET } : null
  const emptyWithAction =
    shotState === 'empty'
      ? { cause: EMPTY_CAUSE, action: { label: 'Link an account', href: '/' } }
      : null

  const focus = useChartFocus(rows, {
    announce: (c) =>
      `${c.name}: ${signed(c.delta)} in October vs September, ${eur(c.total)} in 12 months`,
  })

  const mover = rows.reduce<Category | undefined>(
    (best, c) => (best === undefined || Math.abs(c.delta) > Math.abs(best.delta) ? c : best),
    undefined,
  )
  const shown = focus.datum ?? mover
  const grandTotal = rows.reduce((sum, c) => sum + c.total, 0)
  const octTotal = rows.reduce((sum, c) => sum + (c.months[LAST_COMPLETE] ?? 0), 0)
  const sepTotal = rows.reduce((sum, c) => sum + c.prior, 0)

  // A mover far past the rest is capped so the other nine stay readable; the kit draws the caret.
  const others = rows
    .filter((c) => c !== mover)
    .map((c) => Math.abs(c.delta))
    .reduce((a, b) => Math.max(a, b), 0)
  const cap =
    mover !== undefined && Math.abs(mover.delta) > others * 2.5
      ? Math.ceil((others * 1.8) / 100) * 100
      : undefined

  // cycle-expression-8: a stack of two bar series never clamps, so the cap is applied to the value drawn and the true one is printed on the label
  // cycle-expression-8: a zero bar draws nothing, so a zero delta is drawn as a hairline of 2 euro to give a focus a mark
  const at = (delta: number) =>
    delta === 0 ? 2 : cap === undefined ? delta : Math.max(-cap, Math.min(cap, delta))

  const pct = (c: Category) =>
    c.prior === 0
      ? undefined
      : `${c.delta < 0 ? '−' : '+'}${Math.round((Math.abs(c.delta) / c.prior) * 100)}%`
  const deltaOf = (c: Category) =>
    pct(c) === undefined ? undefined : ({ value: pct(c) ?? '', polarity: 'up-bad' } as const)

  const monthRows: MonthRow[] = (shown?.months ?? []).map((value, i) => ({
    key: MONTHS[i]?.key ?? '',
    full: MONTHS[i]?.full ?? '',
    value,
    kind: i === PARTIAL ? 'partial' : i === LAST_COMPLETE ? 'last' : 'earlier',
  }))

  return (
    <Page area="household-spending">
      <PageBar title="Household spending, Dec 2025 to 17 Nov 2026" />
      <div className="grid grid-cols-1 gap-4 @wide:grid-cols-2">
        <ChartCard
          title="Change by category"
          subtitle="October vs September, by category"
          phase={phase}
          empty={emptyWithAction}
          footer={
            rows.length === 0
              ? undefined
              : [
                  { label: 'October total', value: eur(octTotal) },
                  { label: 'vs September', value: signed(octTotal - sepTotal) },
                ]
          }
          figure={{
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n28, kept as its builder left it: its figure follows focus, built before figure-readout
            value: focus.readout(mover === undefined ? null : signed(mover.delta), (c) =>
              signed(c.delta),
            ),
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n28, kept as its builder left it: its figure follows focus, built before figure-readout
            delta: focus.readout(mover === undefined ? undefined : deltaOf(mover), deltaOf),
            period: focus.readout(
              mover === undefined ? undefined : `${mover.name} moved most`,
              (c) => c.name,
            ),
          }}
          chart={() => (
            <CartesianChart
              label="Change in spending by category, October against September"
              data={rows}
              focus={focus}
              tooltip={false}
              // cycle-expression-8: a band axis thins its names at 390 and drops the answer, so the names are direct labels and the axis draws none
              x={{ value: (c) => c.name, ticks: [] }}
              y={{
                format: (v) => signed(v),
                // cycle-expression-8: the domain stops at the tallest bar, so headroom above and below for the bar labels is added by hand
                domain: ([lo, hi]) => {
                  const [from, to] =
                    cap === undefined ? [lo, hi] : [Math.max(lo, -cap), Math.min(hi, cap)]
                  const pad = (to - from) * 0.2
                  return [from < 0 ? from - pad : from, to + pad]
                },
              }}
              series={[
                {
                  mark: 'bar',
                  key: 'rest',
                  label: 'Other categories',
                  color: SERIES.rest,
                  // cycle-expression-8: the kit does not dim a bar series on focus, so the rest fade by opacity
                  opacity: () => (focus.datum === null ? 1 : 0.4),
                  y: (c) => (c === shown ? null : at(c.delta)),
                },
                {
                  mark: 'bar',
                  key: 'mover',
                  label: 'In focus',
                  color: SERIES.mover,
                  y: (c) => (c === shown ? at(c.delta) : null),
                },
              ]}
              marks={CartesianChart.custom<Category>((plot) => {
                // cycle-expression-8: a band bar has no value or name label and a zero bar draws nothing, so each is placed by hand
                const labelOf = (c: Category) =>
                  c === shown || c === mover
                    ? `${plot.plotWidth < 500 ? '' : `${c.name} `}${signed(c.delta)}${at(c.delta) === c.delta ? '' : ' \u2191'}`
                    : c.name
                const half = (plot.plotWidth / Math.max(plot.data.length, 1)) * 0.4
                const bars = plot.data.map((c) => {
                  const cx = plot.x(c.name) ?? 0
                  const y0 = plot.y(0)
                  const y1 = plot.y(at(c.delta))
                  return {
                    left: cx - half,
                    top: Math.min(y0, y1),
                    width: half * 2,
                    height: Math.abs(y1 - y0),
                  }
                })
                // cycle-expression-8: ten names do not fit a 390 plot, so a narrow plot labels the focus, the mover and the largest others only
                const narrow = plot.plotWidth < 500
                const ranked = [...plot.data].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
                const kept = new Set(
                  narrow
                    ? [
                        shown,
                        mover,
                        ...ranked.filter((c) => c !== shown && c !== mover).slice(0, 2),
                      ]
                    : plot.data,
                )
                const { placed } = chartLabels.place(
                  plot.data
                    .filter((c) => kept.has(c))
                    .map((c) => ({
                      key: c.name,
                      text: labelOf(c),
                      x: plot.x(c.name) ?? 0,
                      y: plot.y(at(c.delta)),
                      priority: c === shown ? 3 : c === mover ? 2 : 1,
                    })),
                  { width: plot.plotWidth, height: plot.plotHeight },
                  { obstacles: bars },
                )
                return [
                  text(placed, {
                    x: (l) => l.key,
                    y: (l) => at(plot.data.find((c) => c.name === l.key)?.delta ?? 0),
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
        <BarList
          title="Where the money goes"
          subtitle={rows.length === 0 ? '12 months' : `${eur(grandTotal)} in 12 months, to 17 Nov`}
          phase={phase}
          empty={empty}
          bodyRows={10}
          focus={focus}
          max={grandTotal}
          format={eur}
          items={rows.map((c) =>
            c.firstMonth > 0
              ? {
                  label: c.name,
                  value: c.total,
                  secondary: `new in ${MONTHS[c.firstMonth]?.key ?? ''}`,
                }
              : { label: c.name, value: c.total },
          )}
        />
        <ChartCard
          title={
            phase === 'ready' && shown !== undefined
              ? `${shown.name} per month`
              : 'Spending per month'
          }
          subtitle={
            phase === 'ready' && shown !== undefined && shown.firstMonth > 0
              ? `No spending before ${MONTHS[shown.firstMonth]?.full.split(' ')[0] ?? ''}`
              : undefined
          }
          figure={{
            value: shown === undefined ? null : eur(shown.months[LAST_COMPLETE] ?? 0),
            delta: shown === undefined ? undefined : deltaOf(shown),
            period: shown === undefined ? undefined : `October, ${eur(shown.prior)} in September`,
          }}
          height="short"
          phase={phase}
          empty={empty}
          chart={() => (
            <CartesianChart
              label={`${shown?.name ?? 'Category'} spending per month, Dec 2025 to Nov 2026`}
              data={monthRows}
              x={{
                value: (m) => m.key,
                ticks: monthRows.filter((_, i) => i % 2 === 1 || i === 11).map((m) => m.key),
              }}
              y={{ format: (v) => eur(v), gutter: 56 }}
              tooltip={{ formatHeader: (m) => m.full }}
              series={[
                {
                  mark: 'bar',
                  key: 'earlier',
                  label: 'Earlier months',
                  color: SERIES.rest,
                  y: (m) => (m.kind === 'earlier' ? m.value : null),
                },
                {
                  mark: 'bar',
                  key: 'last',
                  label: 'October, last complete month',
                  color: SERIES.october,
                  y: (m) => (m.kind === 'last' ? m.value : null),
                },
                {
                  mark: 'bar',
                  key: 'partial',
                  label: 'November to date',
                  color: SERIES.partial,
                  y: (m) => (m.kind === 'partial' ? m.value : null),
                },
              ]}
            />
          )}
        />
        <BarList
          title={
            phase === 'ready' && shown !== undefined ? `Merchants, ${shown.name}` : 'Merchants'
          }
          subtitle="By merchant, 12 months"
          phase={phase}
          empty={empty}
          bodyRows={4}
          max={shown?.total ?? 1}
          format={eur}
          items={(shown?.merchants ?? []).map((m) => ({ label: m.name, value: m.total }))}
        />
      </div>
      {focus.live}
    </Page>
  )
}
