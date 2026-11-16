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

// `mdx` stays first: the quality matrix shoots the first entry as `/scenarios/$name`, and its waivers name it.
export const SCENARIO_INFO: readonly ScenarioInfo[] = [
  {
    id: 'mdx',
    title: 'Authored MDX',
    blurb: 'An authored page compiled at build time and rendered through one component map.',
  },
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
    id: 'expr-c14',
    title: 'Expression c14: live eval race',
    blurb: 'Who leads the live eval, by how much, and how far along is everyone?',
  },
  {
    id: 'expr-c15',
    title: 'Expression c15: mailbox clean-up',
    blurb: 'Which senders mail often and are rarely opened, and what would leaving them save?',
  },
  {
    id: 'expr-n04',
    title: 'Expression n04: ride windows',
    blurb: 'Which windows in the next 48 hours are dry and calm enough to ride?',
  },
  {
    id: 'expr-n09',
    title: 'Expression n09: job schedule',
    blurb: 'What runs next, when, and what is already beyond the next 24 hours?',
  },
  {
    id: 'expr-n13',
    title: 'Expression n13: recurring charges',
    blurb: 'What do we commit to each month, and which charges grew this year?',
  },
  {
    id: 'expr-n16',
    title: 'Expression n16: cut progress',
    blurb: 'Is weight falling at the planned rate, and is it fat rather than lean mass?',
  },
]
