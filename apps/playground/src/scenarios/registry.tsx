/**
 * The scenario registry: `$name` → fixture. The route stays thin; a new scenario is one entry here.
 * S1–S6 are SPEC § 2; `calibrate-*` are the reviewer's seeded boards (SPEC § 8.5), each with
 * exactly one defect named in its file header.
 */
import type { ComponentType } from 'react'
import { CalibrateAccentTab } from './calibrate-accent-tab'
import { CalibrateBannedSubtitle } from './calibrate-banned-subtitle'
import { CalibrateDeltaFill } from './calibrate-delta-fill'
import { CalibrateEmptyHalf } from './calibrate-empty-half'
import { CalibrateGood } from './calibrate-good'
import { CalibrateRepeatedAxis } from './calibrate-repeated-axis'
import { SpendScenario } from './s4-spend'
import type { ScenarioProps } from './shot-state'

export const SCENARIOS: Record<string, ComponentType<ScenarioProps>> = {
  's4-spend': SpendScenario,
  'calibrate-good': CalibrateGood,
  'calibrate-delta-fill': CalibrateDeltaFill,
  'calibrate-empty-half': CalibrateEmptyHalf,
  'calibrate-repeated-axis': CalibrateRepeatedAxis,
  'calibrate-accent-tab': CalibrateAccentTab,
  'calibrate-banned-subtitle': CalibrateBannedSubtitle,
}

export const SCENARIO_NAMES: readonly string[] = Object.keys(SCENARIOS)
