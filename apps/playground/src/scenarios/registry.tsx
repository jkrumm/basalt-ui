/**
 * The scenario registry: `$name` → fixture. The route stays thin; a new scenario is one entry here.
 * S1–S6 are SPEC § 2; `calibrate-*` are the reviewer's seeded boards (SPEC § 8.5), each with
 * exactly one defect named in its file header. A Map, so `/scenarios/constructor` is unknown
 * rather than an inherited `Object` member.
 */
import type { ReactElement } from 'react'
import { CalibrateAccentTab } from './CalibrateAccentTab'
import { CalibrateBannedSubtitle } from './CalibrateBannedSubtitle'
import { CalibrateDeltaFill } from './CalibrateDeltaFill'
import { CalibrateEmptyHalf } from './CalibrateEmptyHalf'
import { CalibrateGood } from './CalibrateGood'
import { CalibrateRepeatedAxis } from './CalibrateRepeatedAxis'
import { SpendScenario } from './S4Spend'
import type { ScenarioProps } from './shot-state'

const SCENARIOS = new Map<string, (props: ScenarioProps) => ReactElement>([
  ['s4-spend', (p) => <SpendScenario {...p} />],
  ['calibrate-good', () => <CalibrateGood />],
  ['calibrate-delta-fill', () => <CalibrateDeltaFill />],
  ['calibrate-empty-half', () => <CalibrateEmptyHalf />],
  ['calibrate-repeated-axis', () => <CalibrateRepeatedAxis />],
  ['calibrate-accent-tab', () => <CalibrateAccentTab />],
  ['calibrate-banned-subtitle', () => <CalibrateBannedSubtitle />],
])

export const SCENARIO_NAMES: readonly string[] = [...SCENARIOS.keys()]

/** The render function for `name`, or undefined when no scenario is registered under it. */
export const findScenario = (name: string): ((props: ScenarioProps) => ReactElement) | undefined =>
  SCENARIOS.get(name)
