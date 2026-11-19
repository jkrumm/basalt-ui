/**
 * Dogfood cycle 2 (docs/v3/cycles/dogfood-2.md): the overview's page store. The console keeps
 * `project`, `origin` and `state` in the URL (`/flow?project=argo&state=working`) and the open Issue
 * as the peek's search key; so does this page. `screen` is the cycle's switch for the shots of each
 * phase, not a console control. The data is cycle 1's fixtures, the console's own shapes.
 */
import { defineControls, field } from 'basalt-ui/router'
import { FLOW_STATES, ORIGINS, ORIGIN_LABELS, STATE_LABELS } from '../dogfood-1/flow-fixtures'

const SCREENS = ['ready', 'loading', 'empty', 'error', 'stale'] as const
export type Screen = (typeof SCREENS)[number]

export const flow = defineControls({
  id: 'cycle-dogfood-2-flow',
  scope: 'page',
  fields: {
    project: field
      .enum(['all', 'argo', 'orion', 'pearl'], 'all')
      .labels({ all: 'All projects', argo: 'argo', orion: 'orion', pearl: 'pearl' }),
    origin: field.enum(['all', ...ORIGINS], 'all').labels({ all: 'All origins', ...ORIGIN_LABELS }),
    state: field
      .enum(['all', ...FLOW_STATES], 'all')
      .labels({ all: 'All states', ...STATE_LABELS }),
    issue: field.string('', { history: 'push' }),
    screen: field.enum(SCREENS, 'ready'),
  },
})
