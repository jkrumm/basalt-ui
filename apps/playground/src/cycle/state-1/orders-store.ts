/** State cycle 1: the orders page's one store. Every filter, the view and the open record live in the URL. */
import { defineControls, field } from 'basalt-ui/router'
import { STATUSES, STATUS_LABELS } from './orders-api'

export const orders = defineControls({
  id: 'cycle-state-orders',
  scope: 'page',
  fields: {
    window: field.range({ presets: ['7d', '30d', '90d'], fallback: '30d', custom: true }).labels({
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
    edit: field.string('', { history: 'push' }),
  },
})
