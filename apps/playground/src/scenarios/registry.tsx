/**
 * The scenario registry: `$name` → fixture. The route stays thin; a new scenario is one entry here.
 * S1–S6 are SPEC § 2. `probe-1`…`probe-6` are the reviewer's calibration boards (SPEC § 8.5): five
 * seeded with exactly one defect each and one known-good; the ids are neutral so the defect is not
 * readable from the route (the map lives in calibration.md). A Map, so `/scenarios/constructor` is
 * unknown rather than an inherited `Object` member.
 */
import type { ReactElement } from 'react'
import { CalibrateAccentTab } from './CalibrateAccentTab'
import { CalibrateBannedSubtitle } from './CalibrateBannedSubtitle'
import { CalibrateDeltaFill } from './CalibrateDeltaFill'
import { CalibrateEmptyHalf } from './CalibrateEmptyHalf'
import { CalibrateGood } from './CalibrateGood'
import { CalibrateRepeatedAxis } from './CalibrateRepeatedAxis'
import { OpsScenario } from './S1Ops'
import { SpendScenario } from './S4Spend'
import type { ScenarioProps } from './shot-state'

const SCENARIOS = new Map<string, (props: ScenarioProps) => ReactElement>([
  ['s1-ops', (p) => <OpsScenario {...p} />],
  ['s4-spend', (p) => <SpendScenario {...p} />],
  ['probe-3', () => <CalibrateGood />],
  ['probe-5', () => <CalibrateDeltaFill />],
  ['probe-6', () => <CalibrateEmptyHalf />],
  ['probe-1', () => <CalibrateRepeatedAxis />],
  ['probe-4', () => <CalibrateAccentTab />],
  ['probe-2', () => <CalibrateBannedSubtitle />],
])

export const SCENARIO_NAMES: readonly string[] = [...SCENARIOS.keys()]

/** The render function for `name`, or undefined when no scenario is registered under it. */
export const findScenario = (name: string): ((props: ScenarioProps) => ReactElement) | undefined =>
  SCENARIOS.get(name)
