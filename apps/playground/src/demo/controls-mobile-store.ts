import { createSearchStore, field } from 'basalt-ui/router-tanstack'
import { CHANNEL_KEYS } from './analytics-data'

/**
 * SEVEN filters on the URL lane, so `ControlsMobilePage`'s `Filters (n)` fold has something to fold
 * and `store.useActiveCount()` has something to count. `minDuration` is the numeric one — the lane
 * `NumberFilter` exists for, and the shape linewatch kept a raw SegmentedControl over.
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
    // `min`/`max` live HERE and nowhere else: the field is what validates the URL, so the stepper
    // clamps on write rather than pre-empting it at the call site.
    minDuration: field.number({ fallback: 0, min: 0, max: 600 }),
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
