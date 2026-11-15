/** State cycle 3: the orders page's one store. Every filter, the view and the open order live in the URL. */
import { defineControls, field } from 'basalt-ui/router'
import { STATUSES, STATUS_LABELS, daysAgo, isoToday } from './orders-api'

const last = (days: number) => (now: Date) => ({ from: daysAgo(days, now), to: isoToday(now) })

export const orders = defineControls({
  id: 'cycle-state-3-orders',
  scope: 'page',
  fields: {
    placed: field
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
    status: field.multi(STATUSES, []).labels(STATUS_LABELS),
    q: field.string('', { max: 80 }),
    flagged: field.boolean(false),
    view: field
      .enum(['table', 'chart'], 'table', { history: 'push' })
      .labels({ table: 'Table', chart: 'Chart' }),
    order: field.string('', { history: 'push' }),
  },
})
