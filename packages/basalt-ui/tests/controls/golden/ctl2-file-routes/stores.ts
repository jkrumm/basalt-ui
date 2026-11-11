/**
 * Synthetic stores in argo's shapes (spike S1): a global on the root route, a finance page store on
 * a layout route whose children inherit it, and a gym page with a full-default `multi`. No real data.
 */
import { defineControls, field } from '../../../../src/router'

export const globals = defineControls({
  id: 'files-globals',
  scope: 'global',
  fields: {
    period: field.enum(['1h', '24h', '7d', '30d'], '24h', { aliases: { day: '24h' } }),
    dense: field.boolean(false),
  },
})

export const fin = defineControls({
  id: 'files-finance',
  scope: 'page',
  resets: ['page'],
  fields: {
    month: field.enum(['', '2025-01', '2025-02'], ''),
    merchant: field.string('', { max: 120 }),
    uncategorized: field.boolean(false),
    sort: field.enum(['booked_on', 'amount'], 'booked_on'),
    page: field.number({ fallback: 0, min: 0, int: true }),
  },
})

const EXERCISES = ['squat', 'bench', 'row'] as const

export const gym = defineControls({
  id: 'files-gym',
  scope: 'page',
  fields: {
    exercises: field.multi(EXERCISES, EXERCISES),
    window: field.range({ presets: ['7d', '30d'], fallback: '30d', custom: true }),
    section: field.enum(['log', 'plan'], 'log', { history: 'push' }),
  },
})
