import { useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar, PageSummary, QueryState } from 'basalt-ui/page'
import type { ScenarioProps } from '../../shot-state'
import { DaysPanel } from './DaysPanel'
import { DirectionCard } from './DirectionCard'
import { CONTRACT, buildMonth, daysUnder, type Day, type Month } from './fixture'

const days = (n: number): string => `${n} ${n === 1 ? 'day' : 'days'}`

function sentenceOf(month: Month): string {
  const down = daysUnder(month.days, 'down', CONTRACT.down.min)
  const up = daysUnder(month.days, 'up', CONTRACT.up.min)
  if (down === 0 && up === 0)
    return 'Download and upload stayed above the minimum on every tested day'
  const upPart = up === 0 ? 'upload never did' : `upload on ${days(up)}`
  return down === 0
    ? `Download stayed above the minimum, ${upPart}`
    : `Download fell below the minimum on ${days(down)}, ${upPart}`
}

const announce = (d: Day): string =>
  d.down === null || d.up === null
    ? `${d.label}: no tests`
    : `${d.label}: download ${d.down} Mbit/s, upload ${d.up} Mbit/s`

function Body({ month, loading }: { month: Month; loading: boolean }) {
  const focus = useChartFocus(month.days, { announce })
  const missing = month.days.filter((d) => d.tests === 0).length
  return (
    <>
      <PageSummary
        {...(loading
          ? { phase: 'loading' as const, facts: [] }
          : {
              sentence: sentenceOf(month),
              facts: [`${days(missing)} without tests are left out`],
            })}
      />
      <div className="grid gap-3 @wide:grid-cols-2">
        <DirectionCard direction="down" month={month} focus={focus} loading={loading} />
        <DirectionCard direction="up" month={month} focus={focus} loading={loading} />
        <div className="@wide:col-span-2">
          <DaysPanel month={month} focus={focus} loading={loading} />
        </div>
      </div>
    </>
  )
}

export function ExprN46Scenario({ shotState, fixture }: ScenarioProps) {
  const full = buildMonth(fixture)
  const month: Month = shotState === 'empty' ? { ...full, days: [], tests: 0 } : full
  const phase =
    shotState === 'error'
      ? ({
          tag: 'error',
          message: 'The speed-test service did not answer. Try again in a minute.',
          retry: () => undefined,
        } as const)
      : 'ready'
  return (
    <Page>
      <PageBar title="Line speed against the contract, April" />
      <QueryState
        phase={phase}
        empty={
          month.days.length === 0
            ? {
                cause:
                  'No speed tests ran in April. Start the test agent on the router, then reload.',
              }
            : null
        }
      >
        <Body month={month} loading={shotState === 'loading'} />
      </QueryState>
    </Page>
  )
}
