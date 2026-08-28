/**
 * The CBBI page's whole interactive state — ONE `createSearchStore` over seventeen typed fields
 * (`docs/CONTROLS-SPEC.md` §4). `validateSearch` goes on `routes/cbbi.tsx`, so the page and every
 * link into it resolve every URL field the same way: URL ⊳ localStorage (`basalt:cbbi`) ⊳ fallback
 * (C4).
 *
 * Two lanes, deliberately split:
 *
 * - **URL + mirror** for everything a reader would share — the window, the axis, the bucket, the
 *   view, the layout, the metric selection and the zone overlay. A link to this page is a link to
 *   a reading of it.
 * - **Mirror only** (`{ url: false }`) for the nine weights. Nine numeric params would triple the
 *   length of every URL for a knob nobody deep-links, and the reweighted index is a private
 *   experiment, not a claim worth sharing. They still resolve, persist and reset through the same
 *   `FieldHandle` every URL field has, which is the point of the lane pair.
 *
 * No control below reads or writes a param by hand: each is handed a `FieldHandle` (C2), so there
 * is no `useState`, no `navigate` and no `onChange` plumbing on the page (C3).
 */
import { createSearchStore, field } from 'basalt-ui/router-tanstack'
import { useMemo } from 'react'
import { CBBI_METRIC_KEYS, CBBI_METRICS } from './cbbi-data'
import type { CbbiMetricKey } from './cbbi-data'

/**
 * The weight field's bounds and grain. `field.number` republishes `min`/`max` on the handle so a
 * control can bound itself — it carries no STEP, so the 0.25 grain has to be restated at the
 * `Slider`; it lives here rather than in the panel so the two cannot drift.
 */
export const CBBI_WEIGHT_MIN = 0
export const CBBI_WEIGHT_MAX = 2
export const CBBI_WEIGHT_STEP = 0.25

const weight = () =>
  field.number({ fallback: 1, min: CBBI_WEIGHT_MIN, max: CBBI_WEIGHT_MAX }, { url: false })

export const cbbiFilters = createSearchStore({
  key: 'cbbi',
  fields: {
    // The series is daily and runs from 2011, so `all` is the full 5,541 points rather than a
    // synthetic ceiling. `4y` is the fallback because one halving cycle is the window the index is
    // designed to be read over — `1y` hides the shape it exists to show.
    range: field.range({ presets: ['1y', '2y', '4y', 'all'], fallback: '4y' }),
    // Price over four orders of magnitude: log is the honest default, and linear is the one click
    // that shows why.
    scale: field.enum(['log', 'linear'], 'log'),
    // `week` at rest — `day` over `all` is 5,541 points through one plot, which is a deliberate
    // thing a reader can ask for and not a thing to hand them.
    granularity: field.enum(['day', 'week', 'month'], 'week'),
    view: field.enum(['overview', 'metrics', 'history'], 'overview'),
    layout: field.enum(['split', 'combined'], 'split'),
    metrics: field.multi(CBBI_METRIC_KEYS, CBBI_METRIC_KEYS),
    zones: field.boolean(true),
    w_PiCycle: weight(),
    w_RUPL: weight(),
    w_RHODL: weight(),
    w_Puell: weight(),
    w_2YMA: weight(),
    w_Trolololo: weight(),
    w_MVRV: weight(),
    w_ReserveRisk: weight(),
    w_Woobull: weight(),
  },
}).labels({
  range: { '1y': 'Last year', '2y': 'Last 2 years', '4y': 'Last 4 years', all: 'All time' },
  scale: { log: 'Logarithmic', linear: 'Linear' },
  granularity: { day: 'Daily', week: 'Weekly', month: 'Monthly' },
  view: { overview: 'Overview', metrics: 'Metrics', history: 'History' },
  layout: { split: 'Separate charts', combined: 'One chart' },
  metrics: Object.fromEntries(CBBI_METRICS.map((m) => [m.key, m.label])),
})

/**
 * The nine weight handles, keyed by metric — so a row renders from `CBBI_METRICS` alone and the
 * page never spells `w_<key>` again. Written out rather than derived: the store's `field` map is
 * exact-keyed, and a computed lookup would erase that.
 */
export const cbbiWeightField = {
  PiCycle: cbbiFilters.field.w_PiCycle,
  RUPL: cbbiFilters.field.w_RUPL,
  RHODL: cbbiFilters.field.w_RHODL,
  Puell: cbbiFilters.field.w_Puell,
  '2YMA': cbbiFilters.field.w_2YMA,
  Trolololo: cbbiFilters.field.w_Trolololo,
  MVRV: cbbiFilters.field.w_MVRV,
  ReserveRisk: cbbiFilters.field.w_ReserveRisk,
  Woobull: cbbiFilters.field.w_Woobull,
} as const satisfies Record<CbbiMetricKey, unknown>

export type CbbiWeightHandle = (typeof cbbiWeightField)[CbbiMetricKey]

/**
 * Every weight at once — nine explicit `use()` calls, never a loop: a hook inside an iteration is
 * an ordering bet, and the field set is closed anyway. The page needs the whole vector to compute
 * one reweighted number, which is the one place a per-field read is not enough.
 */
export function useCbbiWeights(): Record<CbbiMetricKey, number> {
  const [piCycle] = cbbiWeightField.PiCycle.use()
  const [rupl] = cbbiWeightField.RUPL.use()
  const [rhodl] = cbbiWeightField.RHODL.use()
  const [puell] = cbbiWeightField.Puell.use()
  const [twoYma] = cbbiWeightField['2YMA'].use()
  const [trolololo] = cbbiWeightField.Trolololo.use()
  const [mvrv] = cbbiWeightField.MVRV.use()
  const [reserveRisk] = cbbiWeightField.ReserveRisk.use()
  const [woobull] = cbbiWeightField.Woobull.use()

  // Memoized over the nine scalars: the object is a `useMemo` dependency on the page, and a fresh
  // literal per render would recompute every derived series on every commit.
  return useMemo(
    () => ({
      PiCycle: piCycle,
      RUPL: rupl,
      RHODL: rhodl,
      Puell: puell,
      '2YMA': twoYma,
      Trolololo: trolololo,
      MVRV: mvrv,
      ReserveRisk: reserveRisk,
      Woobull: woobull,
    }),
    [piCycle, rupl, rhodl, puell, twoYma, trolololo, mvrv, reserveRisk, woobull],
  )
}

/**
 * Unset all nine weights. `clear()` rather than `set(1)` — a reset UNSETS (§4), so the persisted
 * keys go away instead of being pinned to a value nobody chose.
 */
export function resetCbbiWeights(): void {
  for (const handle of Object.values(cbbiWeightField)) handle.clear()
}
