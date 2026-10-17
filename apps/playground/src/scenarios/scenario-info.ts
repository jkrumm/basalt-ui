/**
 * The scenarios a human opens: nav entries and the index page. Component-free on purpose — the
 * shell chunk imports this, and must not pull every scenario with it. Calibration probes are absent
 * (their ids are neutral so a defect is not readable from the route); a scenario added to the
 * registry needs an entry here, which `scenarios.test.ts` enforces.
 */
import type { ScenarioKey } from './registry'

export type ScenarioInfo = {
  id: Exclude<ScenarioKey, `probe-${number}`>
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
    id: 's4-spend',
    title: 'Spend and usage',
    blurb: 'Am I within budget, and what drives it? Budget burn and spend breakdown by project.',
  },
]
