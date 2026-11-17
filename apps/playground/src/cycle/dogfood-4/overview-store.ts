/**
 * Dogfood cycle 4 (docs/v3/cycles/dogfood-4.md): the Overview's one store. The console keeps
 * `project`, `origin` and `state` in the URL (`/?project=argo&state=running`) and the open Issue as
 * the peek's search key; so does this page. `screen` is the cycle's switch for the shots of each
 * phase. The chart card's Count and Window are the card's own choice (`useState` in the console's
 * `components/flow/trend-chart.tsx`): here a widget that owns its fields, on this one store.
 */
import { defineControls, field } from 'basalt-ui/router'
import {
  COUNT_LABELS,
  ORIGINS,
  ORIGIN_LABELS,
  TREND_COUNTS,
  TREND_WINDOWS,
  WINDOW_LABELS,
  WORK_LABELS,
  WORK_STATES,
} from './overview-fixtures'

export const SCREENS = ['ready', 'loading', 'empty', 'error', 'stale'] as const
export type Screen = (typeof SCREENS)[number]

export const overview = defineControls({
  id: 'cycle-dogfood-4-overview',
  scope: 'page',
  fields: {
    project: field
      .enum(['all', 'argo', 'orion', 'pearl'], 'all')
      .labels({ all: 'All projects', argo: 'argo', orion: 'orion', pearl: 'pearl' }),
    origin: field.enum(['all', ...ORIGINS], 'all').labels({ all: 'All origins', ...ORIGIN_LABELS }),
    state: field.enum(['all', ...WORK_STATES], 'all').labels({ all: 'All states', ...WORK_LABELS }),
    issue: field.string('', { history: 'push' }),
    screen: field.enum(SCREENS, 'ready'),
  },
  widgets: {
    // cycle-dogfood-4: dogfood-4.1 — `trend` is taken: widget ids are app-unique, and cycle 3's
    // page already holds it, so the same name here threw at load and blanked every route.
    issuesOverTime: {
      count: field.enum(TREND_COUNTS, 'running').labels(COUNT_LABELS),
      window: field.enum(TREND_WINDOWS, '7d').labels(WINDOW_LABELS),
    },
  },
})
