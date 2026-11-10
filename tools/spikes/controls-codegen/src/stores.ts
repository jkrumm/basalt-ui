/**
 * Synthetic stores shaped after the argo shapes named in controls-url-state.md: a global store,
 * the finance page store (one store, a layout route and 6 children), a range page with a push
 * field, and a page with a full-default `multi`. No real data.
 */
import { defineControls, field } from './controls'

const MONTHS = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06'] as const

export const globals = defineControls({
  id: 'globals',
  scope: 'global',
  fields: {
    range: field.enum(['1h', '24h', '7d', '30d'], '24h', { aliases: { day: '24h' } }),
    regions: field.multi(['eu', 'us', 'ap'], []),
    density: field.number(0, { min: -3, max: 3, int: true }),
    compact: field.boolean(false),
  },
})

/** The 17-field finance store, reduced to every kind it uses. */
export const fin = defineControls({
  id: 'finance',
  scope: 'page',
  retain: ['month', 'from', 'to', 'year'],
  fields: {
    month: field.enum(['', ...MONTHS], ''),
    from: field.enum(['', ...MONTHS], ''),
    to: field.enum(['', ...MONTHS], ''),
    year: field.enum(['', '2024', '2025'], ''),
    category: field.string('', { max: 120 }),
    merchant: field.string('', { max: 120 }),
    search: field.string('', { max: 120 }),
    amount: field.enum(['', 'out-100', 'out-20', 'in'], ''),
    uncategorized: field.boolean(false),
    sort: field.enum(['booked_on', 'amount', 'merchant'], 'booked_on'),
    dir: field.enum(['desc', 'asc'], 'desc'),
    page: field.number(0, { min: 0, int: true }),
    size: field.enum(['25', '50', '100'], '50'),
  },
})

/** A range (3 params `window`/`from`/`to`, shared names with `fin` on another route) and a push field. */
export const garmin = defineControls({
  id: 'garmin',
  scope: 'page',
  fields: {
    window: field.range(['7d', '30d', '90d'], '30d'),
    tab: field.enum(['overview', 'sleep', 'hrv'], 'overview', { history: 'push' }),
    q: field.string(''),
  },
})

const EXERCISES = ['squat', 'bench', 'deadlift', 'row', 'press'] as const

/** `exercises` is argo's full-default `multi`, `muscles` the empty-default contrast, `done` a true-default boolean, `levels` a multi of numeric-looking members. */
export const gym = defineControls({
  id: 'gym',
  scope: 'page',
  fields: {
    exercises: field.multi(EXERCISES, EXERCISES),
    muscles: field.multi(['legs', 'back', 'chest'], []),
    done: field.boolean(true),
    // numeric-looking members: shutterflow's `?rating=1,2` shape
    levels: field.multi(['1', '2', '3'], []),
  },
})
