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
import { ExprC14Scenario } from './expr/c14/ExprC14'
import { ExprC15Scenario } from './expr/c15/ExprC15'
import { ExprN02Scenario } from './expr/n02/ExprN02'
import { ExprN04Scenario } from './expr/n04/ExprN04'
import { ExprN09Scenario } from './expr/n09/ExprN09'
import { ExprN12Scenario } from './expr/n12/ExprN12'
import { ExprN13Scenario } from './expr/n13/ExprN13'
import { ExprN16Scenario } from './expr/n16/ExprN16'
import { ExprN03Scenario } from './expr/n03/ExprN03'
import { ExprN07Scenario } from './expr/n07/ExprN07'
import { ExprN10Scenario } from './expr/n10/ExprN10'
import { ExprN14Scenario } from './expr/n14/ExprN14'
import { ExprN17Scenario } from './expr/n17/ExprN17'
import { ExprN18Scenario } from './expr/n18/ExprN18'
import { ExprC16Scenario } from './expr/c16/ExprC16'
import { ExprN08Scenario } from './expr/n08/ExprN08'
import { ExprN15Scenario } from './expr/n15/ExprN15'
import { ExprN19Scenario } from './expr/n19/ExprN19'
import { ExprN20Scenario } from './expr/n20/ExprN20'
import { ExprN21Scenario } from './expr/n21/ExprN21'
import { ExprN11Scenario } from './expr/n11/ExprN11'
import { ExprN22Scenario } from './expr/n22/ExprN22'
import { ExprN23Scenario } from './expr/n23/ExprN23'
import { ExprN24Scenario } from './expr/n24/ExprN24'
import { ExprN25Scenario } from './expr/n25/ExprN25'
import { ExprN26Scenario } from './expr/n26/ExprN26'
import { MdxScenario } from './mdx-scenario'
import type { ScenarioProps } from './shot-state'

const RENDERERS = {
  'expr-c10': (p) => <ExprC10Scenario {...p} />,
  'expr-c11': (p) => <ExprC11Scenario {...p} />,
  'expr-c12': (p) => <ExprC12Scenario {...p} />,
  'expr-c13': (p) => <ExprC13Scenario {...p} />,
  'expr-n02': (p) => <ExprN02Scenario {...p} />,
  'expr-n12': (p) => <ExprN12Scenario {...p} />,
  'expr-c14': (p) => <ExprC14Scenario {...p} />,
  'expr-c15': (p) => <ExprC15Scenario {...p} />,
  'expr-n04': (p) => <ExprN04Scenario {...p} />,
  'expr-n09': (p) => <ExprN09Scenario {...p} />,
  'expr-n13': (p) => <ExprN13Scenario {...p} />,
  'expr-n16': (p) => <ExprN16Scenario {...p} />,
  'expr-n03': (p) => <ExprN03Scenario {...p} />,
  'expr-n07': (p) => <ExprN07Scenario {...p} />,
  'expr-n10': (p) => <ExprN10Scenario {...p} />,
  'expr-n14': (p) => <ExprN14Scenario {...p} />,
  'expr-n17': (p) => <ExprN17Scenario {...p} />,
  'expr-n18': (p) => <ExprN18Scenario {...p} />,
  'expr-c16': (p) => <ExprC16Scenario {...p} />,
  'expr-n08': (p) => <ExprN08Scenario {...p} />,
  'expr-n15': (p) => <ExprN15Scenario {...p} />,
  'expr-n19': (p) => <ExprN19Scenario {...p} />,
  'expr-n20': (p) => <ExprN20Scenario {...p} />,
  'expr-n21': (p) => <ExprN21Scenario {...p} />,
  'expr-n11': (p) => <ExprN11Scenario {...p} />,
  'expr-n22': (p) => <ExprN22Scenario {...p} />,
  'expr-n23': (p) => <ExprN23Scenario {...p} />,
  'expr-n24': (p) => <ExprN24Scenario {...p} />,
  'expr-n25': (p) => <ExprN25Scenario {...p} />,
  'expr-n26': (p) => <ExprN26Scenario {...p} />,
  mdx: () => <MdxScenario />,
} satisfies Record<string, (props: ScenarioProps) => ReactElement>

/** Every registered id; `scenario-info.ts` types its entries against this. */
export type ScenarioKey = keyof typeof RENDERERS

const SCENARIOS = new Map<string, (props: ScenarioProps) => ReactElement>(Object.entries(RENDERERS))

export const SCENARIO_NAMES: readonly string[] = [...SCENARIOS.keys()]

/** The render function for `name`, or undefined when no scenario is registered under it. */
export const findScenario = (name: string): ((props: ScenarioProps) => ReactElement) | undefined =>
  SCENARIOS.get(name)
