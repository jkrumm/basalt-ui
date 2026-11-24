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
