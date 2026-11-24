import { useChartFocus } from 'basalt-ui/charts'
import type { Phase } from 'basalt-ui/cards'
import { Page, PageBar } from 'basalt-ui/page'
import type { ScenarioProps } from '../../shot-state'
import { AgreementCard } from './AgreementCard'
import { FlaggedPanel } from './FlaggedPanel'
import { fixtureRows, flaggedRows, judgedRows, statsOf } from './fixture'

// One source feeds both parts, so they share one retry.
const retry = () => undefined

export function ExprN72Scenario({ shotState, fixture }: ScenarioProps) {
  const shown = shotState === undefined ? fixtureRows(fixture) : []
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The submission log did not answer.', retry }
        : 'ready'
  const focus = useChartFocus(judgedRows(shown), {
    announce: (d) => `${d.form}, ${d.id}: ${d.pair}, ${d.outcome.toLowerCase()}`,
  })
  return (
    <Page area="expr-n72">
      <PageBar title="Spam filter on four forms, 14 days" />
      <div className="grid items-stretch gap-4 @wide:min-h-160 @wide:grid-cols-2">
        <div className="flex flex-col">
          <AgreementCard
            phase={phase}
            empty={shotState === 'empty'}
            focus={focus}
            stats={statsOf(shown)}
          />
        </div>
        <div className="flex flex-col">
          <FlaggedPanel
            phase={phase}
            rows={flaggedRows(shown)}
            focus={focus}
            failed={shotState === 'error'}
          />
        </div>
      </div>
    </Page>
  )
}
