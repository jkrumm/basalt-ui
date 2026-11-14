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
    id: 's1-ops',
    title: 'Ops monitor',
    blurb:
      'Is the line healthy now, and when did it last break? Uptime, latency and incident stats.',
  },
  {
    id: 's2-training',
    title: 'Training log',
    blurb: "Am I on track for this month's goal? Session pace, training load and readiness.",
  },
  {
    id: 's3-agents',
    title: 'Agent work',
    blurb: 'What needs me, and what is stuck? Decision queue, wait times and dispatch budget.',
  },
  {
    id: 's4-spend',
    title: 'Spend and usage',
    blurb: 'Am I within budget, and what drives it? Budget burn and spend breakdown by project.',
  },
  {
    id: 's5-learning',
    title: 'Learning record',
    blurb:
      'Where am I with this topic? Review it now or later: sessions, ratings and the practice journal.',
  },
  {
    id: 's6-settings',
    title: 'Settings and entry',
    blurb:
      'Change one thing without breaking another. An account page and a set-logging form: save or cancel.',
  },
  {
    id: 's7-body',
    title: 'Body and strength',
    blurb: 'Am I trending toward my weight goal, and is my training load productive?',
  },
  {
    id: 's8-map',
    title: 'Sky map',
    blurb: 'Where is the sky clear tonight? A forecast raster on a map with its key.',
  },
  {
    id: 'mdx',
    title: 'Authored MDX',
    blurb: 'An authored page compiled at build time and rendered through one component map.',
  },
  {
    id: 'agent-stream',
    title: 'Agent stream',
    blurb: 'A replayed chat reply: reasoning, markdown, code, a diagram and a tool call.',
  },
  {
    id: 'expr-c01',
    title: 'Trial c01: pipeline pace',
    blurb: 'Is this run on pace against the best run, and which stage is costing or saving time?',
  },
  {
    id: 'expr-c02',
    title: 'Trial c02: webhook deliveries',
    blurb:
      'Which endpoint is failing, since when, and is it a volume problem or a failure problem?',
  },
  {
    id: 'expr-c03',
    title: 'Trial c03: tool SLO',
    blurb: 'Are we inside the SLO for the last 24 hours, and by how much?',
  },
  {
    id: 'expr-c04',
    title: 'Trial c04: run durations',
    blurb: 'What is typical, how bad is the tail, and how many runs hit the timeout?',
  },
  {
    id: 'expr-c05',
    title: 'Trial c05: contract renewals',
    blurb: 'Which contracts need a notice soon, and which renew on their own?',
  },
  {
    id: 'expr-c06',
    title: 'Trial c06: context window',
    blurb: 'How full is the context window, what fills it, and when should I compact?',
  },
  {
    id: 'expr-c07',
    title: 'Trial c07: eval run vs baseline',
    blurb: 'Did this run beat the baseline, and which cases changed sides?',
  },
  {
    id: 'expr-c08',
    title: 'Trial c08: slow agent run',
    blurb: 'Where did the 8 seconds go, and which step failed?',
  },
  {
    id: 'expr-c09',
    title: 'Trial c09: deployed versions',
    blurb: 'Which version hurt quality, and what is live now?',
  },
  {
    id: 'expr-n01',
    title: 'Trial n01: internet line',
    blurb:
      'How often did the line drop in the last 30 days, for how long, and does speed hold the contracted rate?',
  },
  {
    id: 'expr-n05',
    title: 'Trial n05: model price and quality',
    blurb:
      'Which models give the most quality for their price, and which is beaten by a cheaper one?',
  },
  {
    id: 'expr-n06',
    title: 'Trial n06: usage window',
    blurb: 'Will the quota run out before the window resets, and when?',
  },
]
