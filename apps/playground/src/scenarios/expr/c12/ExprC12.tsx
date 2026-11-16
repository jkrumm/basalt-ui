import { BarList, StatCell, StatGroup } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { CardGrid, PageBar } from 'basalt-ui/page'
import { VX, alpha } from 'basalt-ui/tokens'
import type { ComponentProps } from 'react'
import type { ScenarioProps } from '../../shot-state'
import { CURRENCY, MODELS, pickFixture } from './fixture'
import type { Day, ModelKey, SpendFixture } from './fixture'

type Frame = Pick<ComponentProps<typeof ChartCard>, 'phase' | 'empty'>

const INK_STEPS = [alpha(VX.ink, 0.7), alpha(VX.ink, 0.45), alpha(VX.ink, 0.25)]

function frameFor(shotState: ScenarioProps['shotState'], range: string): Frame {
  if (shotState === 'loading') return { phase: 'loading' }
  if (shotState === 'error') {
    return {
      phase: { tag: 'error', message: 'The billing export did not answer.', retry: () => {} },
    }
  }
  if (shotState === 'empty') {
    return {
      phase: 'ready',
      empty: {
        cause: `No model calls were billed for ${range}. Check that the billing export is connected.`,
      },
    }
  }
  return {}
}

const dayDriver = (d: Day) =>
  d.total > 0
    ? MODELS.map((m) => ({ label: m.label, value: d[m.key] })).toSorted(
        (a, b) => b.value - a.value,
      )[0]
    : undefined

function summarize(f: SpendFixture) {
  const week = f.days.slice(f.weekStart)
  const spent = week.reduce((sum, d) => sum + d.total, 0)
  const byModel = MODELS.map((m) => ({
    key: m.key,
    label: m.label,
    value: week.reduce((sum, d) => sum + d[m.key], 0),
  })).toSorted((a, b) => b.value - a.value)
  const elapsed = f.days.length - 1 - f.weekStart + f.dayShare
  const left = f.weeklyBudget - spent
  const daysLeft = f.daysAfterToday + (1 - f.dayShare)
  return { spent, byModel, left, daysLeft, elapsed, projected: (spent / elapsed) * 7 }
}

export function ExprC12Scenario({ shotState, fixture }: ScenarioProps) {
  const fmt = useFormat()
  const usd = (v: number) => fmt.money(v, CURRENCY, { maximumFractionDigits: 0 })
  const usdExact = (v: number) => fmt.money(v, CURRENCY)
  const dayLabel = (at: Date) => fmt.date(at, 'short', { weekday: 'short', timeZone: 'UTC' })
  const f = pickFixture(fixture)
  const s = summarize(f)
  const [first, last] = [f.days[0], f.days.at(-1)]
  const range = first && last ? `${dayLabel(first.day)} to ${dayLabel(last.day)}` : ''
  const frame = frameFor(shotState, range)
  const settled = shotState === undefined
  const loading = shotState === 'loading'
  const driver = s.byModel[0]
  const over = s.spent > f.weeklyBudget
  const behind = !over && s.projected > f.weeklyBudget

  const listFrame: Frame =
    shotState === 'error'
      ? { phase: { tag: 'error', retry: () => {} } }
      : shotState === 'empty'
        ? { phase: 'ready', empty: { cause: 'Models appear here once a call is billed.' } }
        : frame
  const focus = useChartFocus(f.days, {
    announce: (d) => {
      const top = dayDriver(d)
      const split = top ? `, mostly ${top.label} ${usdExact(top.value)}` : ''
      return `${dayLabel(d.day)}${d.partial ? ' so far' : ''}: ${usdExact(d.total)}${split}`
    },
  })
  const today = f.days.at(-1)
  const dayNote = (d: Day) => {
    const top = dayDriver(d)
    return top ? `${top.label} ${usd(top.value)}` : 'nothing billed'
  }
  const todayNote = today && today.total > 0 ? `so far, ${dayNote(today)}` : 'nothing billed yet'
  const paceAllowance = (f.weeklyBudget * s.elapsed) / 7

  const colorOf = (key: ModelKey) => {
    const rank = s.byModel.findIndex((m) => m.key === key)
    const token = rank === 0 ? VX.brand : (INK_STEPS[rank - 1] ?? VX.inkFaint)
    return { light: token, dark: token }
  }

  const status = over
    ? { tone: 'bad' as const, label: 'Over budget' }
    : behind
      ? { tone: 'warn' as const, label: 'Pace is over budget' }
      : { tone: 'good' as const, label: 'Inside budget' }

  const share = (v: number) => fmt.percent(s.spent === 0 ? 0 : v / s.spent)

  const hasDriver = settled && driver !== undefined && driver.value > 0

  return (
    <div className="@container flex min-w-0 flex-col gap-4">
      <PageBar title="AI spend" />
      <StatGroup variant="strip" label="This week's AI spend against budget">
        <StatCell
          phase={frame.phase}
          label="Spent"
          qualifier="Mon to today"
          value={settled || loading ? usd(s.spent) : null}
          {...(settled || loading
            ? {
                status,
                sub: `${usd(s.projected)} projected by Sunday`,
                meter: {
                  label: 'Weekly budget used',
                  value: s.spent,
                  max: f.weeklyBudget,
                  format: (v: number) => `${usd(v)} of ${usd(f.weeklyBudget)}`,
                  zones: [
                    { to: paceAllowance, tone: 'good', label: 'Under pace' },
                    { to: f.weeklyBudget, tone: 'warn', label: 'Over pace' },
                  ],
                },
              }
            : {})}
        />
        <StatCell
          phase={loading ? 'loading' : 'ready'}
          label={over ? 'Over budget by' : 'Left'}
          qualifier={`${fmt.number(s.daysLeft, { maximumFractionDigits: 1 })} days to go`}
          value={settled || loading ? usd(Math.abs(s.left)) : null}
          {...(settled || loading
            ? {
                sub: over
                  ? 'every further call adds to it'
                  : `${usd(s.left / s.daysLeft)} a day to stay inside`,
              }
            : {})}
        />
        <StatCell
          phase={loading ? 'loading' : 'ready'}
          label="Biggest driver"
          value={hasDriver ? driver.label : null}
          {...(hasDriver || loading ? { sub: `${share(driver?.value ?? 0)} of the spend` } : {})}
        />
      </StatGroup>
      <CardGrid min="regular">
        <ChartCard
          {...frame}
          title="Daily cost by model"
          subtitle="USD per day"
          footer={[
            { label: 'Budget line', value: `${usd(f.weeklyBudget / 7)} a day` },
            today && today.total > 0 ? { label: 'Lighter bar', value: 'today, partial' } : null,
          ]}
          legend={MODELS.map((m) => ({
            key: m.key,
            label: m.label,
            color: colorOf(m.key),
            swatch: 'bar' as const,
          }))}
          figure={{
            value:
              settled || loading
                ? focus.readout(usdExact(today?.total ?? 0), (d) => usdExact(d.total))
                : null,
            ...(settled || loading
              ? {
                  period: focus.readout(todayNote, dayNote),
                }
              : {}),
          }}
          chart={() => (
            <Bars
              ariaLabel="Daily AI cost per model for 14 days; today is partial"
              data={f.days}
              focus={focus}
              x={{
                value: (d) => d.day,
                format: (v) => (v instanceof Date ? `${v.getUTCDate()}` : String(v)),
              }}
              refLines={[
                {
                  value: f.weeklyBudget / 7,
                  color: { light: VX.ink, dark: VX.ink },
                  dashed: true,
                },
              ]}
              series={MODELS.map((m) => ({
                mark: 'bar' as const,
                key: m.key,
                label: m.label,
                color: colorOf(m.key),
                y: (d: Day) => d[m.key],
                opacity: (d: Day) => (d.partial ? 0.35 : f.days.indexOf(d) < f.weekStart ? 0.6 : 1),
                format: (v: number) => usdExact(v),
                legend: false as const,
              }))}
            />
          )}
        />
        <BarList
          {...listFrame}
          title="Cost by model"
          items={s.byModel.map((m) => ({
            label: m.label,
            value: m.value,
            secondary: share(m.value),
          }))}
          format={usdExact}
          rows={4}
        />
      </CardGrid>
    </div>
  )
}
