import { Page, PageBar } from 'basalt-ui/page'
import type { Phase } from 'basalt-ui/cards'
import { useState } from 'react'
import type { ScenarioProps } from '../../shot-state'
import { morning } from './fixture'
import { RecoveryCard } from './RecoveryCard'
import { StressCard } from './StressCard'

export function ExprN63Scenario({ shotState, fixture }: ScenarioProps) {
  const [failed, setFailed] = useState(shotState === 'error')
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : failed
        ? {
            tag: 'error',
            message: 'The band has not synced with the service.',
            retry: () => setFailed(false),
          }
        : 'ready'
  const empty = shotState === 'empty'
  const data = morning(fixture)
  return (
    <Page area="expr-n63">
      <PageBar title="Training readiness this morning" />
      {/* cycle-expression-14: a card with stacked panes needs a fixed height (ChartCard height fill takes its parent's), and the kit's fixed boxes clip, so each wrapper is sized to its panes. */}
      <div className="grid gap-4 @wide:grid-cols-2">
        <div className="h-240 @wide:h-225">
          <RecoveryCard
            days={data.days}
            noSleepDays={data.noSleepDays}
            phase={phase}
            empty={
              empty
                ? {
                    cause:
                      'No score yet. Wear the band through one night and the first score appears by morning.',
                  }
                : null
            }
          />
        </div>
        <div className="h-240 @wide:h-225">
          <StressCard
            morning={data}
            phase={phase}
            empty={empty ? { cause: 'No reading yet. Sync the band and the day fills in.' } : null}
          />
        </div>
      </div>
    </Page>
  )
}
