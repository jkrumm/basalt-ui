import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { useChartFocus } from 'basalt-ui/charts'
import type { Phase } from 'basalt-ui/cards'
import type { ScenarioProps } from '../../shot-state'
import { HoursPanel } from './HoursPanel'
import { WaveCard } from './WaveCard'
import { forecastOf, type FixtureName, type Hour } from './fixture'

const NO_HOURS: readonly Hour[] = []

/** `?fixture=calm` is a day under the limit with a zero wind, `?fixture=storm` a swell over the limit all 48 hours. */
function fixtureOf(name: string | undefined): FixtureName {
  return name === 'calm' || name === 'storm' ? name : 'rest'
}

function phaseOf(shotState: ScenarioProps['shotState']): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') {
    return { tag: 'error', message: 'The wave model did not answer.', retry: () => undefined }
  }
  return 'ready'
}

export function ExprN56Scenario({ shotState, fixture }: ScenarioProps) {
  const forecast = forecastOf(fixtureOf(fixture))
  const phase = phaseOf(shotState)
  const rows = shotState === 'empty' ? NO_HOURS : forecast.rows
  const focus = useChartFocus(rows, {
    announce: (d) =>
      `${d.stamp}: ${d.hs} m, ${d.tp} s, wind ${d.windText}, offshore up to ${d.offshoreMax} m`,
  })
  const ready = phase === 'ready' && rows.length > 0
  return (
    <Page area="expr-n56">
      <PageBar title="Harbour waves, 48 hours" />
      <CardGrid min="regular">
        <WaveCard forecast={ready ? forecast : null} phase={phase} focus={focus} rows={rows} />
        <HoursPanel rows={rows} phase={phase} focus={focus} />
      </CardGrid>
    </Page>
  )
}
