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
  {
    id: 'expr-n03',
    title: 'Expression n03: training load',
    blurb: "Is this week's training load inside the target band, against the last eight weeks?",
  },
  {
    id: 'expr-n07',
    title: 'Expression n07: observing nights',
    blurb: 'Which of the next ten nights is best, and why is each other night ruled out?',
  },
  {
    id: 'expr-n10',
    title: 'Expression n10: wind models',
    blurb:
      'Do the forecast models agree on the wind for the next 72 hours, and where do they part?',
  },
  {
    id: 'expr-n14',
    title: 'Expression n14: net worth',
    blurb: 'Are we getting wealthier, and which accounts hold it?',
  },
  {
    id: 'expr-n17',
    title: 'Expression n17: host memory',
    blurb: 'Is memory the limit right now, and which kind of process holds it?',
  },
  {
    id: 'expr-n18',
    title: 'Expression n18: queue waits',
    blurb: 'What did queued Issues wait for this week, and which reason cost the most hours?',
  },
  {
    id: 'expr-c16',
    title: 'Expression c16: model choice',
    blurb:
      'Which model suits this chat, how do the models compare, and what would this chat have cost on each?',
  },
  {
    id: 'expr-n08',
    title: 'Expression n08: train today',
    blurb:
      'Given recovery and the planned load, should I train, and how often has this pairing come up?',
  },
  {
    id: 'expr-n15',
    title: 'Expression n15: walking pad',
    blurb: 'Did I walk enough this week, and is my pace getting better?',
  },
  {
    id: 'expr-n19',
    title: 'Expression n19: backup radio path',
    blurb: 'Would Wi-Fi carry a failover today, and when this week was its signal too weak to?',
  },
  {
    id: 'expr-n20',
    title: 'Expression n20: weekly volume',
    blurb: 'Is each lift inside its productive range, and which one is drifting out of it?',
  },
  {
    id: 'expr-n21',
    title: 'Expression n21: line interventions',
    blurb: 'Does a router reboot fix a drop, or would the line have come back on its own?',
  },
  {
    id: 'expr-n11',
    title: 'Expression n11: course catalogue',
    blurb: 'How hard is each course, and how far along am I in the ones I started?',
  },
  {
    id: 'expr-n22',
    title: 'Expression n22: fitness direction',
    blurb: 'Is my fitness improving, stable or declining, and which body signal says so?',
  },
  {
    id: 'expr-n23',
    title: 'Expression n23: homelab monitors',
    blurb: 'What is down or slow right now, and which services were flaky in the last day?',
  },
  {
    id: 'expr-n24',
    title: 'Expression n24: gateway spend',
    blurb: 'Which workflows draw the AI gateway spend, and how much of it is production?',
  },
  {
    id: 'expr-n25',
    title: 'Expression n25: reading shelf',
    blurb: 'Am I on pace for the reading goal, and which started books have stalled?',
  },
  {
    id: 'expr-n26',
    title: 'Expression n26: line path probes',
    blurb: 'Is the delay and loss in the home network, at the provider, or at the far end?',
  },
]
