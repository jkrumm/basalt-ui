/**
 * The scenario registry: `$name` → fixture. The route stays thin; a new scenario is one entry here.
 * `mdx` is the compiled MDX page. A Map, so `/scenarios/constructor` is
 * unknown rather than an inherited `Object` member.
 */
import type { ReactElement } from 'react'
import { ExprC10Scenario } from './expr/c10/ExprC10'
import { ExprC11Scenario } from './expr/c11/ExprC11'
import { ExprC12Scenario } from './expr/c12/ExprC12'
import { ExprC13Scenario } from './expr/c13/ExprC13'
import { ExprN02Scenario } from './expr/n02/ExprN02'
import { ExprN12Scenario } from './expr/n12/ExprN12'
import { MdxScenario } from './mdx-scenario'
import type { ScenarioProps } from './shot-state'

const RENDERERS = {
  'expr-c10': (p) => <ExprC10Scenario {...p} />,
  'expr-c11': (p) => <ExprC11Scenario {...p} />,
  'expr-c12': (p) => <ExprC12Scenario {...p} />,
  'expr-c13': (p) => <ExprC13Scenario {...p} />,
  'expr-n02': (p) => <ExprN02Scenario {...p} />,
  'expr-n12': (p) => <ExprN12Scenario {...p} />,
  mdx: () => <MdxScenario />,
} satisfies Record<string, (props: ScenarioProps) => ReactElement>

/** Every registered id; `scenario-info.ts` types its entries against this. */
export type ScenarioKey = keyof typeof RENDERERS

const SCENARIOS = new Map<string, (props: ScenarioProps) => ReactElement>(Object.entries(RENDERERS))

export const SCENARIO_NAMES: readonly string[] = [...SCENARIOS.keys()]

/** The render function for `name`, or undefined when no scenario is registered under it. */
export const findScenario = (name: string): ((props: ScenarioProps) => ReactElement) | undefined =>
  SCENARIOS.get(name)
