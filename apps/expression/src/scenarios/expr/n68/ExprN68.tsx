import { Page, PageBar } from 'basalt-ui/page'
import type { ScenarioProps } from '../../shot-state'
import { siteFor } from './fixture'
import { MonthsCard } from './MonthsCard'
import { RidgeCard } from './RidgeCard'

const EMPTY = {
  cause: 'No horizon profile is set for this site. Add one to continue.',
}

export function ExprN68Scenario({ shotState, fixture }: ScenarioProps) {
  const site = siteFor(fixture)
  const phase =
    shotState === 'loading'
      ? ('loading' as const)
      : shotState === 'error'
        ? {
            tag: 'error' as const,
            message: 'The site service did not answer. Try again in a moment.',
            retry: () => undefined,
          }
        : ('ready' as const)
  const empty = shotState === 'empty' ? EMPTY : null
  return (
    <Page area="core-months">
      <PageBar title="Galactic core planning" />
      <div className="grid items-stretch gap-3 @wide:grid-cols-2">
        <MonthsCard months={site.months} bortle={site.bortle} phase={phase} empty={empty} />
        <RidgeCard ridge={site.ridge} phase={phase} empty={empty} />
      </div>
    </Page>
  )
}
