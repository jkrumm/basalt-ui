/**
 * The scenario registry: `$name` → fixture. The route stays thin; a new scenario is one entry here.
 * `mdx` is the compiled MDX page and `agent-stream` the replayed chat reply. A Map, so `/scenarios/constructor` is
 * unknown rather than an inherited `Object` member.
 */
import type { ReactElement } from 'react'
import { AgentStreamDemo } from '../demo/AgentStreamDemo'
import { MdxScenario } from './mdx-scenario'
import type { ScenarioProps } from './shot-state'

const RENDERERS = {
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
