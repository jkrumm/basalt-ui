/**
 * The scenario registry: `$name` → fixture. The route stays thin; a new scenario is one entry here.
 * S1–S6 are SPEC § 2 (S6 settings and entry is the forms pattern); S7 and S8 are Wave 43's argo upstream rows. `agent-stream` is the replayed chat reply. A Map, so `/scenarios/constructor` is
 * unknown rather than an inherited `Object` member.
 */
import type { ReactElement } from 'react'
import { AgentStreamDemo } from '../demo/AgentStreamDemo'
import { OpsScenario } from './S1Ops'
import { TrainingScenario } from './S2Training'
import { AgentsScenario } from './S3Agents'
import { SpendScenario } from './S4Spend'
import { LearningScenario } from './S5Learning'
import { SettingsScenario } from './S6Settings'
import { BodyScenario } from './S7Body'
import { MapScenario } from './S8Map'
import { MdxScenario } from './mdx-scenario'
import type { ScenarioProps } from './shot-state'

const RENDERERS = {
  's1-ops': (p) => <OpsScenario {...p} />,
  's2-training': (p) => <TrainingScenario {...p} />,
  's3-agents': (p) => <AgentsScenario {...p} />,
  's4-spend': (p) => <SpendScenario {...p} />,
  's5-learning': (p) => <LearningScenario {...p} />,
  's6-settings': (p) => <SettingsScenario {...p} />,
  's7-body': (p) => <BodyScenario {...p} />,
  's8-map': (p) => <MapScenario {...p} />,
  mdx: () => <MdxScenario />,
  'agent-stream': () => <AgentStreamDemo />,
} satisfies Record<string, (props: ScenarioProps) => ReactElement>

/** Every registered id; `scenario-info.ts` types its entries against this. */
export type ScenarioKey = keyof typeof RENDERERS

const SCENARIOS = new Map<string, (props: ScenarioProps) => ReactElement>(Object.entries(RENDERERS))

export const SCENARIO_NAMES: readonly string[] = [...SCENARIOS.keys()]

/** The render function for `name`, or undefined when no scenario is registered under it. */
export const findScenario = (name: string): ((props: ScenarioProps) => ReactElement) | undefined =>
  SCENARIOS.get(name)
