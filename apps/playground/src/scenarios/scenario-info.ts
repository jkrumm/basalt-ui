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
  {
    id: 'expr-n27',
    title: 'Expression n27: factory health measures',
    blurb: 'Which health measures moved the right way this week, and which slid?',
  },
  {
    id: 'expr-n28',
    title: 'Expression n28: household spending',
    blurb: 'Where does the money go, and which category moved most last month?',
  },
  {
    id: 'expr-n29',
    title: 'Expression n29: tax-year tags',
    blurb: 'How much of the year is tagged for tax, and which merchants hold untagged bookings?',
  },
  {
    id: 'expr-n30',
    title: 'Expression n30: line throughput',
    blurb: 'When is the line busiest, and how close does it come to the contracted rate?',
  },
  {
    id: 'expr-n31',
    title: "Expression n31: a project's week",
    blurb: 'What shipped on each day, and what is in production now?',
  },
  {
    id: 'expr-n32',
    title: 'Expression n32: plan waits',
    blurb: 'Which open Issues wait on others, and which one would unblock the most?',
  },
  {
    id: 'expr-n33',
    title: 'Expression n33: project hygiene',
    blurb: 'Which probes fail now, and which findings have been open longest?',
  },
  {
    id: 'expr-n34',
    title: 'Expression n34: leaving a tidal harbour',
    blurb: 'When in the next 48 hours is there water over the bar, and is the swell low then?',
  },
  {
    id: 'expr-n35',
    title: 'Expression n35: the coming workweek',
    blurb: 'How much of each workday is booked, and where is the longest free block?',
  },
  {
    id: 'expr-n36',
    title: 'Expression n36: merge requests',
    blurb: 'Which merge requests wait on me, for how long, and which of mine are stuck?',
  },
  {
    id: 'expr-n37',
    title: 'Expression n37: sprint at risk',
    blurb: 'How much of the sprint is done, and which tickets are at risk of not finishing?',
  },
  {
    id: 'expr-n38',
    title: 'Expression n38: what waits on the owner',
    blurb: 'Which questions, reviews and chores wait, and which hold up the most work?',
  },
  {
    id: 'expr-n39',
    title: 'Expression n39: frost in the nights ahead',
    blurb: 'Will any of the next five nights freeze, for how long, and do the models agree?',
  },
  {
    id: 'expr-n40',
    title: 'Expression n40: what the task list asks of today',
    blurb: 'Which tasks are overdue, how much is due today, and which list keeps growing?',
  },
  {
    id: 'expr-n41',
    title: 'Expression n41: which model served each request',
    blurb: 'Which model served each kind of request, and how often did a request fall back?',
  },
  {
    id: 'expr-n42',
    title: 'Expression n42: whether the router is healthy',
    blurb: 'Is the router healthy now, and did its load rise before the last line drop?',
  },
  {
    id: 'expr-n43',
    title: 'Expression n43: which documents wait for a verdict',
    blurb: 'Which Specs and Reports came in per project, and which still wait for a verdict?',
  },
  {
    id: 'expr-n44',
    title: 'Expression n44: when rain reaches my spot',
    blurb: 'Is rain coming in the next two hours, when does it arrive, and how heavy will it be?',
  },
  {
    id: 'linked-windows',
    title: 'Linked windows: a table of runs beside an hourly chart',
    blurb: 'Each window row holds the hours it spans: point at it or step onto it to hold the run.',
  },
  {
    id: 'row-list',
    title: 'Row list: quiet rows beside a chart',
    blurb: 'Four row shapes, quiet by default: spacing and a surface, a hairline only on request.',
  },
]
