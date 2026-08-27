import { createSearchStore, field } from 'basalt-ui/router-tanstack'
import { CHANNEL_KEYS } from './analytics-data'

/**
 * SIX filters on the URL lane, so `ControlsMobilePage`'s `Filters (n)` fold has something to fold
 * and `store.useActiveCount()` has something to count.
 *
 * Its own module rather than the page's, so `demo/nav-model.tsx` can pass `linkSearch` by reference
 * without importing a component module into the nav definition (docs/CONTROLS-SPEC.md §4).
 */
export const mobileFilters = createSearchStore({
  key: 'controls-mobile',
  fields: {
    range: field.range({ presets: ['7d', '30d', '90d'], fallback: '30d', custom: true }),
    compare: field.enum(['none', 'previous', 'year'], 'none'),
    currency: field.enum(['USD', 'EUR', 'GBP'], 'USD'),
    channels: field.multi(CHANNEL_KEYS, []),
    query: field.string({ max: 60 }),
    verified: field.boolean(false),
  },
}).labels({
  range: { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' },
  compare: { none: 'No comparison', previous: 'Previous period', year: 'Same period last year' },
  currency: { USD: 'US dollar', EUR: 'Euro', GBP: 'Pound sterling' },
  channels: {
    direct: 'Direct',
    organic: 'Organic search',
    referral: 'Referral',
    social: 'Social',
    paid: 'Paid',
  },
})
