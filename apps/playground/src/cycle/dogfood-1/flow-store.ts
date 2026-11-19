/**
 * Dogfood cycle 1: the overview's page store. The console keeps `project`, `origin` and `state` in
 * the URL (`/flow?project=argo&state=working`) and the open Issue as the peek's search key; so does
 * this page. `screen` is the cycle's own switch for the shots of each phase, not a console control.
 */
import { defineControls, field } from 'basalt-ui/router'
import { FLOW_STATES, ORIGINS, ORIGIN_LABELS, PROJECTS, STATE_LABELS } from './flow-fixtures'

const SCREENS = ['ready', 'loading', 'empty', 'error', 'stale'] as const
export type Screen = (typeof SCREENS)[number]

const projectLabels = Object.fromEntries(PROJECTS.map((p) => [p, p])) as Record<
  (typeof PROJECTS)[number],
  string
>

export const flow = defineControls({
  id: 'cycle-dogfood-flow',
  scope: 'page',
  fields: {
    project: field
      .enum(['all', ...PROJECTS], 'all')
      .labels({ all: 'All projects', ...projectLabels }),
    origin: field.enum(['all', ...ORIGINS], 'all').labels({ all: 'All origins', ...ORIGIN_LABELS }),
    state: field
      .enum(['all', ...FLOW_STATES], 'all')
      .labels({ all: 'All states', ...STATE_LABELS }),
    issue: field.string('', { history: 'push' }),
    screen: field.enum(SCREENS, 'ready'),
  },
})
