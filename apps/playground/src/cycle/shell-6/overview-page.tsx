import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useFormat } from 'basalt-ui'
import { StatCell, StatGroup } from 'basalt-ui/cards'
import { Bars, ChartCard } from 'basalt-ui/charts'
import { filterSlot, spec } from 'basalt-ui/controls'
import { Page, PageBar, ToastHost } from 'basalt-ui/page'
import { defineControls, field } from 'basalt-ui/router'
import { notify } from 'basalt-ui'
import type { ReactElement } from 'react'
import { FLEET6_SERIES } from '../../demo/series'
import { ROOT } from './queries'
import { server } from './server'
import type { Overview } from './server'

const WINDOWS = ['7d', '14d', '30d'] as const
export const DAYS: Record<(typeof WINDOWS)[number], number> = { '7d': 7, '14d': 14, '30d': 30 }

/** The page's one filter: how many days the figures and the bars cover. */
export const overview = defineControls({
  id: 'fleet6-overview',
  scope: 'page',
  fields: {
    window: field
      .enum(WINDOWS, '14d')
      .labels({ '7d': '7 days', '14d': '14 days', '30d': '30 days' }),
  },
})

const NONE = { deploys: 0, failed: 0, rolledBack: 0, medianS: 0 }

function signed(n: number, unit = ''): string {
  return `${n > 0 ? '+' : ''}${n.toFixed(unit === '%' ? 0 : 1)}${unit}`
}

/** The overview: `data` is absent while the route is pending, so every slot is drawn held. */
export function OverviewPage({ data }: { data: Overview | undefined }): ReactElement {
  const f = useFormat()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [window] = overview.field.window.use()
  const days = DAYS[window]
  const ready = data !== undefined
  const now = data?.now ?? NONE
  const prior = data?.prior ?? NONE
  const rate = (t: typeof NONE): number =>
    t.deploys === 0 ? 0 : (1 - (t.failed + t.rolledBack) / t.deploys) * 100
  const against = 'vs prior'
  const empty = ready && now.deploys === 0
  const peak = data?.days.reduce(
    (best, d) => {
      const total = d.succeeded + d.failed + d.rolledBack
      return total > best.total ? { total, day: d.day } : best
    },
    { total: 0, day: 0 },
  )

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: [ROOT] })
    await router.invalidate()
  }
  const arm = (): void => {
    server.failNext()
    notify('info', { message: 'The next call will fail. Refresh to see it.' })
  }

  return (
    <Page area="fleet6-overview">
      <PageBar
        title="Fleet overview"
        controls={filterSlot([spec(overview.field.window, 'Window')])}
        actions={[
          { id: 'refresh', label: 'Refresh', primary: true, onClick: () => void refresh() },
          { id: 'fail', label: 'Fail next call', onClick: arm },
        ]}
      />
      <StatGroup variant="strip" label="Health">
        <StatCell
          title="Deploys"
          phase={ready ? 'ready' : 'loading'}
          value={ready ? now.deploys : null}
          delta={{
            value:
              ready && prior.deploys > 0
                ? signed(((now.deploys - prior.deploys) / prior.deploys) * 100, '%')
                : '',
            polarity: 'up-good',
            label: against,
          }}
        />
        <StatCell
          title="Success rate"
          phase={ready ? 'ready' : 'loading'}
          value={ready && !empty ? rate(now).toFixed(1) : null}
          unit="%"
          delta={{
            value:
              ready && !empty && prior.deploys > 0 ? signed(rate(now) - rate(prior)) + ' pts' : '',
            polarity: 'up-good',
            label: against,
          }}
        />
        <StatCell
          title="Median duration"
          phase={ready ? 'ready' : 'loading'}
          value={ready && !empty ? now.medianS : null}
          unit="s"
          sub={ready && !empty ? `Prior ${days} days: ${prior.medianS} s` : ''}
        />
        <StatCell
          title="Failing services"
          phase={ready ? 'ready' : 'loading'}
          value={ready ? (data?.failing ?? 0) : null}
          unit={ready ? `of ${data?.services ?? 0}` : ''}
          status={{
            tone: ready && data?.failing === 0 ? 'good' : 'bad',
            label: ready ? (data?.failing === 0 ? 'All healthy' : 'Latest failed') : '',
          }}
        />
      </StatGroup>
      <ChartCard
        title="Deploys per day"
        subtitle="By outcome, UTC"
        phase={ready ? 'ready' : 'loading'}
        height="tall"
        empty={
          empty ? { cause: `Nothing shipped in ${days} days. A first deploy shows here.` } : null
        }
        figure={{
          value: ready && peak !== undefined && !empty ? peak.total : null,
          unit: 'deploys',
          period:
            ready && peak !== undefined && !empty
              ? `busiest day, ${f.date(peak.day, 'short')}`
              : '',
        }}
        chart={(box) =>
          data === undefined ? null : (
            <Bars
              label="Deploys per day, stacked by outcome"
              data={data.days}
              height={box.height}
              x={{ value: (d) => new Date(d.day), format: (x) => f.date(new Date(x), 'short') }}
              y={{ title: 'Deploys' }}
              series={[
                {
                  mark: 'bar',
                  key: 'succeeded',
                  label: 'Succeeded',
                  color: FLEET6_SERIES.succeeded,
                  y: (d) => d.succeeded,
                },
                {
                  mark: 'bar',
                  key: 'rolledBack',
                  label: 'Rolled back',
                  color: FLEET6_SERIES.rolledBack,
                  y: (d) => d.rolledBack,
                },
                {
                  mark: 'bar',
                  key: 'failed',
                  label: 'Failed',
                  color: FLEET6_SERIES.failed,
                  y: (d) => d.failed,
                },
              ]}
            />
          )
        }
      />
      {/* owner-review-2: the playground root mounts no ToastHost, so the page mounts the one its notify needs */}
      <ToastHost />
    </Page>
  )
}
