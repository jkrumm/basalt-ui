import { useMemo } from 'react'
import type { ReactElement } from 'react'
import { useFormat } from 'basalt-ui'
import { BarList } from 'basalt-ui/cards'
import type { Delta, Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, Lines, useChartFocus } from 'basalt-ui/charts'
import type { ChartFigure, ChartZone } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { WEALTH_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { buildMonths, total } from './fixture'
import type { Month } from './fixture'

// cycle-expression-5: the optional figure fields reject an explicit undefined, so a readout of an absent delta is dropped by hand.
function figureOf(
  value: string | null,
  delta: Delta | undefined,
  period: string | undefined,
): ChartFigure {
  return { value, ...(delta ? { delta } : {}), ...(period ? { period } : {}) }
}

const EMPTY = {
  cause: 'No statements imported yet. Import a bank or depot statement to see month-ends.',
}

/** The band keys worth a tick label: a start, then every half year. */
const TICK_INDEXES = [0, 5, 11, 17, 23]

export function ExprN14Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const f = useFormat()
  const months = useMemo(
    () => (shotState === 'empty' ? [] : buildMonths(fixture)),
    [shotState, fixture],
  )
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: () => undefined }
        : 'ready'

  const money = (n: number): string => f.money(n, 'EUR', { maximumFractionDigits: 0 })
  const signedMoney = (n: number): string =>
    f.money(n, 'EUR', { maximumFractionDigits: 0, signDisplay: 'exceptZero' })
  const compactMoney = (n: number): string =>
    f.money(n, 'EUR', { notation: 'compact', maximumFractionDigits: 1 })
  const signedPercent = (fraction: number): string =>
    f.percent(fraction, { maximumFractionDigits: 1, signDisplay: 'exceptZero' })
  const monthLabel = (m: Month): string =>
    f.date(m.at, 'month', { month: 'short', year: '2-digit' })
  const labels = new Map(months.map((m) => [m.key, monthLabel(m)]))
  const keyLabel = (key: number | Date | string): string => labels.get(String(key)) ?? ''
  const monthOf = (m: Month): string => monthLabel(m) + (m.estimated ? ', estimated' : '')

  const ticks = TICK_INDEXES.flatMap((i) => months[i]?.key ?? [])
  const x = { value: (m: Month) => m.key, format: keyLabel, ticks }

  // Runs of estimated months, as bands; the last run names them.
  const runs: { from: string; to: string }[] = []
  for (const m of months) {
    if (!m.estimated) continue
    const last = runs.at(-1)
    const prev = months[months.indexOf(m) - 1]
    if (last && prev?.estimated) last.to = m.key
    else runs.push({ from: m.key, to: m.key })
  }
  const zones: ChartZone[] = runs.map((run, i) => ({
    axis: 'x',
    from: run.from,
    to: run.to,
    fill: alpha(BASALT.inkMuted, 0.14),
    ...(i === runs.length - 1 ? { label: 'Estimated' } : {}),
  }))

  const latest = months.at(-1)
  const yearAgo = (m: Month): Month | undefined => months[months.indexOf(m) - 12]
  const netDelta = (m: Month | undefined): Delta | undefined => {
    const base = m ? yearAgo(m) : undefined
    if (!m || !base || total(base) <= 0) return undefined
    return {
      value: signedPercent(total(m) / total(base) - 1),
      polarity: 'up-good',
      label: `vs ${monthLabel(base)}`,
    }
  }
  const depotMonths = months.filter((m) => m.hasDepot)
  const depotDelta = (m: Month): Delta | undefined =>
    m.hasDepot && m.paidIn > 0
      ? { value: signedPercent(m.depot / m.paidIn - 1), polarity: 'up-good', label: 'vs paid in' }
      : undefined
  const lowest = depotMonths.reduce<Month | undefined>(
    (low, m) => (!low || m.depot / m.paidIn < low.depot / low.paidIn ? m : low),
    undefined,
  )

  const netFocus = useChartFocus(months, {
    announce: (m) =>
      `${monthOf(m)}: net worth ${money(total(m))}; cash ${money(m.cash)}, depot ${money(m.depot)}, other ${money(m.rest)}`,
  })
  const depotFocus = useChartFocus(months, {
    announce: (m) =>
      m.hasDepot
        ? `${monthOf(m)}: depot ${money(m.depot)}, paid in ${money(m.paidIn)}`
        : `${monthOf(m)}: no depot yet`,
  })

  const shown = netFocus.datum ?? latest
  const accounts = shown
    ? [
        { label: 'Cash', value: shown.cash },
        { label: 'Depot', value: shown.depot },
        { label: 'Other accounts', value: shown.rest },
      ]
        .toSorted((a, b) => b.value - a.value)
        .map((a) => ({
          ...a,
          secondary:
            total(shown) > 0 ? f.percent(a.value / total(shown), { maximumFractionDigits: 0 }) : '',
        }))
    : []
  const placeholder = '—'
  // A loading card keeps every declaration with a dash in place of its value.
  const pending = shotState === 'loading'

  return (
    <Page area="expr-n14">
      <PageBar title="Household net worth" />
      <ChartCard
        title="Net worth"
        subtitle="Month-end balances of all accounts"
        phase={phase}
        empty={months.length === 0 ? EMPTY : null}
        figure={figureOf(
          netFocus.readout(latest ? money(total(latest)) : null, (m) => money(total(m))),
          netFocus.readout(netDelta(latest), (m) => netDelta(m)),
          netFocus.readout(latest ? monthOf(latest) : undefined, monthOf),
        )}
        footer={[
          {
            label: '12-month change',
            value:
              latest && !pending && yearAgo(latest)
                ? signedMoney(total(latest) - total(yearAgo(latest)!))
                : placeholder,
          },
          {
            label: 'Estimated',
            value:
              latest && !pending
                ? `${months.filter((m) => m.estimated).length} of ${months.length}`
                : placeholder,
          },
        ]}
        chart={() => (
          <Bars
            ariaLabel="Net worth at 24 month-ends, stacked by cash, depot and other accounts"
            data={months}
            x={x}
            y={{ format: compactMoney }}
            focus={netFocus}
            zones={zones}
            tooltip={{ formatHeader: monthOf }}
            series={[
              {
                mark: 'bar',
                key: 'cash',
                label: 'Cash',
                color: WEALTH_SERIES.cash,
                y: (m) => m.cash,
                format: money,
                opacity: (m) => (m.estimated ? 0.6 : 1),
              },
              {
                mark: 'bar',
                key: 'depot',
                label: 'Depot',
                color: WEALTH_SERIES.depot,
                y: (m) => m.depot,
                format: money,
                opacity: (m) => (m.estimated ? 0.6 : 1),
              },
              {
                mark: 'bar',
                key: 'rest',
                label: 'Other accounts',
                color: WEALTH_SERIES.rest,
                y: (m) => m.rest,
                format: money,
                opacity: (m) => (m.estimated ? 0.6 : 1),
              },
            ]}
          />
        )}
      />
      <div className="@container">
        <div className="grid gap-4 @wide:grid-cols-3">
          <div className="@wide:col-span-2">
            <ChartCard
              title="Depot against money paid in"
              subtitle="The gap is what the market added"
              phase={phase}
              empty={months.length === 0 ? EMPTY : null}
              figure={figureOf(
                depotFocus.readout(latest?.hasDepot ? money(latest.depot) : null, (m) =>
                  m.hasDepot ? money(m.depot) : null,
                ),
                depotFocus.readout(latest ? depotDelta(latest) : undefined, (m) => depotDelta(m)),
                depotFocus.readout(latest ? monthOf(latest) : undefined, monthOf),
              )}
              footer={[
                {
                  label: 'Paid in',
                  value: latest?.hasDepot && !pending ? money(latest.paidIn) : placeholder,
                },
                {
                  label: 'Lowest vs paid in',
                  value:
                    lowest && !pending
                      ? `${signedPercent(lowest.depot / lowest.paidIn - 1)}, ${monthLabel(lowest)}`
                      : placeholder,
                },
              ]}
              chart={() => (
                <Lines
                  ariaLabel="Depot value against money paid in, 24 month-ends"
                  data={months}
                  x={x}
                  y={{ format: compactMoney }}
                  focus={depotFocus}
                  zones={zones}
                  tooltip={{ formatHeader: monthOf }}
                  series={[
                    {
                      mark: 'line',
                      key: 'depot',
                      label: 'Depot value',
                      color: WEALTH_SERIES.depot,
                      weight: 'strong',
                      y: (m) => (m.hasDepot ? m.depot : null),
                      format: money,
                    },
                    {
                      mark: 'line',
                      key: 'paidIn',
                      label: 'Paid in',
                      color: WEALTH_SERIES.paidIn,
                      dash: true,
                      y: (m) => (m.hasDepot ? m.paidIn : null),
                      format: money,
                    },
                  ]}
                />
              )}
            />
          </div>
          <BarList
            title="Where it sits"
            subtitle={shown && !pending ? monthLabel(shown) : 'Month-end'}
            phase={phase}
            empty={months.length === 0 ? EMPTY : null}
            items={accounts}
            rows={3}
            max={Math.max(shown ? total(shown) : 1, 1)}
            format={money}
          />
        </div>
      </div>
    </Page>
  )
}
