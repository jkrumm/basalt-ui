/**
 * Shell cycle 4 (docs/v3/cycles/shell-4.md), page 1 of the fleet app: the overview, copied from
 * cycle 3. A PageBar with a title, two actions and one filter, a stat row and a chart card. Every
 * workaround carries a `cycle-shell-4:` comment naming its finding.
 */
import { useNavigate } from '@tanstack/react-router'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import { Bars, ChartCard } from 'basalt-ui/charts'
import { filterSlot, spec } from 'basalt-ui/controls'
import { Page, PageBar, Section } from 'basalt-ui/page'
import type { ReactElement } from 'react'
import { DEMO_SERIES } from '../../demo/series'
import { SERVICES, fleetApi, isoDay } from './fleet-api'
import type { Deploy } from './fleet-api'
import { RANGE_DAYS, overview } from './fleet-store'

type Day = { day: Date; success: number; failed: number }

function deploysIn(days: number): Deploy[] {
  const from = isoDay(days - 1)
  return SERVICES.flatMap((service) => service.deploys.filter((d) => d.date >= from))
}

function byDay(deploys: readonly Deploy[], days: number): Day[] {
  const out = new Map<string, Day>()
  for (let ago = days - 1; ago >= 0; ago -= 1) {
    const date = isoDay(ago)
    out.set(date, { day: new Date(`${date}T00:00:00Z`), success: 0, failed: 0 })
  }
  for (const deploy of deploys) {
    const day = out.get(deploy.date)
    if (day === undefined) continue
    if (deploy.outcome === 'success') day.success += 1
    else day.failed += 1
  }
  return [...out.values()]
}

const percent = (part: number, whole: number): string =>
  whole === 0 ? '0' : ((part / whole) * 100).toFixed(1)

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

export function OverviewPage(): ReactElement {
  const navigate = useNavigate()
  const [period] = overview.field.period.use()
  const periodLabel = overview.field.period.label(period)
  const days = RANGE_DAYS[period]
  const deploys = deploysIn(days)
  const failed = deploys.filter((d) => d.outcome !== 'success').length
  const down = SERVICES.filter((s) => s.health !== 'healthy').length
  const series = byDay(deploys, days)

  return (
    <Page area="cycle-shell-4-overview">
      <PageBar
        title="Fleet overview"
        controls={filterSlot([spec(overview.field.period, 'Range')])}
        actions={[
          {
            id: 'services',
            label: 'Open services',
            primary: true,
            onClick: () => void navigate({ to: '/cycle/shell-4/services' }),
          },
          {
            id: 'outage',
            label: 'Simulate outage',
            onClick: () => {
              fleetApi.breakNextLoad()
              void navigate({ to: '/cycle/shell-4/services' })
            },
          },
        ]}
      />
      <StatGroup variant="strip" label="Fleet health">
        <StatCell title="Services" value={SERVICES.length} sub={`${down} not healthy`} />
        <StatCell title="Deploys" value={deploys.length} sub={periodLabel} />
        <StatCell
          title="Failure rate"
          value={percent(failed, deploys.length)}
          unit="%"
          sub="failed or rolled back"
        />
        <StatCell
          title="Median duration"
          value={median(deploys.map((d) => d.durationS))}
          unit="s"
        />
      </StatGroup>
      <Section title="Deploys">
        <ChartCard
          title="Deploys per day"
          figure={{ value: deploys.length, unit: 'deploys', period: periodLabel }}
          chart={() => (
            <Bars
              label={`Deploys per day, ${periodLabel}`}
              data={series}
              x={{ value: (d) => d.day }}
              series={[
                {
                  mark: 'bar',
                  key: 'success',
                  label: 'Succeeded',
                  color: DEMO_SERIES.signups,
                  y: (d) => d.success,
                },
                {
                  mark: 'bar',
                  key: 'failed',
                  label: 'Failed',
                  color: DEMO_SERIES.churn,
                  y: (d) => d.failed,
                },
              ]}
            />
          )}
        />
      </Section>
    </Page>
  )
}
