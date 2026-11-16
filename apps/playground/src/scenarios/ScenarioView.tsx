import { Link } from '@tanstack/react-router'
import { SCENARIO_NAMES, findScenario } from './registry'
import type { ShotState } from './shot-state'

/** Renders the fixture registered under `name`, or a list of the known names. */
export function ScenarioView({
  name,
  shotState,
  fixture,
}: {
  name: string
  shotState: ShotState | undefined
  fixture: string | undefined
}) {
  const render = findScenario(name)
  if (render === undefined) {
    return (
      <div className="flex flex-col gap-2 p-6 text-sm">
        <p className="font-medium">No scenario named "{name}"</p>
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {SCENARIO_NAMES.map((known) => (
            <li key={known}>
              <Link
                to="/scenarios/$name"
                params={{ name: known }}
                className="underline-offset-4 hover:underline"
              >
                {known}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return render({ shotState, fixture })
}
