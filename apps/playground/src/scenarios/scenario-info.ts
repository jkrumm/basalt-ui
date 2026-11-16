/**
 * The scenarios a human opens: nav entries and the index page. Component-free on purpose — the
 * shell chunk imports this, and must not pull every scenario with it. A scenario added to the
 * registry needs an entry here, which `scenarios.test.ts` enforces.
 */
import type { ScenarioKey } from './registry'

export type ScenarioInfo = {
  id: ScenarioKey
  title: string
  blurb: string
}

export const SCENARIO_INFO: readonly ScenarioInfo[] = [
  {
    id: 'expr-c10',
    title: 'Expression c10: leaked key reach',
    blurb: 'What can a leaked key reach, and how many steps away is each resource?',
  },
  {
    id: 'expr-c11',
    title: 'Expression c11: retrieval cut-off',
    blurb: 'How many chunks does the cut-off keep, and where does the mass of scores sit?',
  },
  {
    id: 'expr-c12',
    title: 'Expression c12: weekly AI spend',
    blurb: "Are we inside this week's budget, and which model drives the cost?",
  },
  {
    id: 'expr-c13',
    title: 'Expression c13: SOC triage',
    blurb: 'How much did automation close without a person, and when did escalations spike?',
  },
  {
    id: 'expr-n02',
    title: 'Expression n02: stuck Issues',
    blurb: 'Where are Issues stuck in the factory, and for how long?',
  },
  {
    id: 'expr-n12',
    title: 'Expression n12: last night’s sleep',
    blurb: 'Did I sleep enough, and which stage fell short of my usual?',
  },
  {
    id: 'mdx',
    title: 'Authored MDX',
    blurb: 'An authored page compiled at build time and rendered through one component map.',
  },
]
