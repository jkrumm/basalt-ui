import { Link } from '@tanstack/react-router'
import { EmptyState } from 'basalt-ui'
import { List } from '@mantine/core'
import { SCENARIOS, SCENARIO_NAMES } from './registry'
import type { ShotState } from './shot-state'

/** Renders the fixture registered under `name`, or an empty state listing the known names. */
export function ScenarioView({
  name,
  shotState,
}: {
  name: string
  shotState: ShotState | undefined
}) {
  const Scenario = SCENARIOS[name]
  if (Scenario === undefined) {
    return (
      <EmptyState
        title={`No scenario named "${name}"`}
        description="Pick one of the registered scenarios below."
        action={
          <List listStyleType="none">
            {SCENARIO_NAMES.map((known) => (
              <List.Item key={known}>
                <Link to="/scenarios/$name" params={{ name: known }}>
                  {known}
                </Link>
              </List.Item>
            ))}
          </List>
        }
      />
    )
  }
  return <Scenario shotState={shotState} />
}
