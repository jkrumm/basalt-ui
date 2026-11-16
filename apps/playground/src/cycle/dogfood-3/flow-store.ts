/**
 * Dogfood cycle 3 (docs/v3/cycles/dogfood-3.md): the overview's stores. The console keeps
 * `project`, `origin` and `state` in the URL (`/flow?project=argo&state=working`) and the open Issue
 * as the peek's search key; so does this page. `screen` is the cycle's switch for the shots of each
 * phase, not a console control. The chart card's Count and Window are the card's own choice in the
 * console (`useState` in `components/flow/trend-chart.tsx`); here they are a widget.
 */
import { defineControls, field } from 'basalt-ui/router'
import { FLOW_STATES, ORIGINS, ORIGIN_LABELS, STATE_LABELS } from '../dogfood-1/flow-fixtures'
import { COUNT_LABELS, TREND_COUNTS, TREND_WINDOWS, WINDOW_LABELS } from './trend-fixtures'

export const SCREENS = ['ready', 'loading', 'empty', 'error', 'stale'] as const
export type Screen = (typeof SCREENS)[number]

/** The page store, mounted on the layout route `/cycle/dogfood-3`. */
export const flow = defineControls({
  id: 'cycle-dogfood-3-flow',
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
    // cycle-dogfood-3: dogfood-3.1 — a widget field only inherits a page or global field, so the
    // card's own Count and Window are declared here first, as page fields the page never shows.
    count: field.enum(TREND_COUNTS, 'working').labels(COUNT_LABELS),
    window: field.enum(TREND_WINDOWS, '7d').labels(WINDOW_LABELS),
  },
})

/**
 * cycle-dogfood-3: dogfood-3.1 — the chart card's widget store, a second page store on the child
 * route: `widgets` binds handles that exist before the call, so it cannot sit on `flow` itself.
 */
export const cards = defineControls({
  id: 'cycle-dogfood-3-cards',
  scope: 'page',
  fields: {},
  widgets: { trend: { count: flow.field.count, window: flow.field.window } },
})
