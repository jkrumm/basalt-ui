/**
 * Dogfood cycle 5 (docs/v3/cycles/dogfood-5.md): the Overview's one store. The console keeps
 * `project`, `origin` and `state` in the URL (`/?project=argo&state=running`) and the open Issue as
 * the peek's search key; so does this page. `screen` is the cycle's switch for the shots of each
 * phase. The chart card's Count and Window are the card's own widget on this one store. Its id,
 * `issuesOverTime`, is cycle 4's on purpose: since dogfood-4.1 sibling page stores may repeat one.
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

const SCREENS = ['ready', 'loading', 'empty', 'error', 'stale'] as const
export type Screen = (typeof SCREENS)[number]

export const overview = defineControls({
  id: 'cycle-dogfood-5-overview',
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
    issuesOverTime: {
      count: field.enum(TREND_COUNTS, 'running').labels(COUNT_LABELS),
      window: field.enum(TREND_WINDOWS, '7d').labels(WINDOW_LABELS),
    },
  },
})
