/** State cycle 2: the tickets page's one store. Every filter, the view and the open ticket live in the URL. */
import { defineControls, field } from 'basalt-ui/router'
import { PRIORITIES, PRIORITY_LABELS, daysAgo, isoToday } from './tickets-api'

const last = (days: number) => (now: Date) => ({ from: daysAgo(days, now), to: isoToday(now) })

export const tickets = defineControls({
  id: 'cycle-state-2-tickets',
  scope: 'page',
  fields: {
    opened: field
      .range({
        presets: ['7d', '30d', '90d'],
        fallback: '30d',
        custom: true,
        window: { '7d': last(7), '30d': last(30), '90d': last(90) },
      })
      .labels({
        '7d': 'Last 7 days',
        '30d': 'Last 30 days',
        '90d': 'Last 90 days',
        custom: 'Custom range',
      }),
    priority: field.multi(PRIORITIES, []).labels(PRIORITY_LABELS),
    q: field.string('', { max: 80 }),
    unassigned: field.boolean(false),
    view: field
      .enum(['table', 'chart'], 'table', { history: 'push' })
      .labels({ table: 'Table', chart: 'Chart' }),
    ticket: field.string('', { history: 'push' }),
  },
})
