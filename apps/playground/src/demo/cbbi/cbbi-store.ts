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
import { useCallback, useMemo } from 'react'
import { CBBI_METRIC_KEYS, CBBI_METRICS } from './cbbi-data'
import type { CbbiMetricKey } from './cbbi-data'
import { CBBI_PRESETS } from './cbbi-diagnostics'
import type { CbbiPresetKey } from './cbbi-diagnostics'

/**
 * The weight field's bounds and grain — all three on the FIELD now (G7 closed in wave 2), so
 * `SliderControl` bounds and steps itself off the handle and no control restates the 0.25 grain.
 */
export const CBBI_WEIGHT_MIN = 0
export const CBBI_WEIGHT_MAX = 2
export const CBBI_WEIGHT_STEP = 0.25

const weight = () =>
  field.number(
    {
      fallback: 1,
      min: CBBI_WEIGHT_MIN,
      max: CBBI_WEIGHT_MAX,
      step: CBBI_WEIGHT_STEP,
    },
    { url: false },
  )

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

/**
 * Apply one of `CBBI_PRESETS` — nine weights and the selection, in one press.
 *
 * A HOOK rather than a plain function, unlike {@link resetCbbiWeights}: `FieldHandle` publishes
 * `clear()` outside render but its SETTER only through `use()`, so a preset that writes values has
 * to be assembled from the nine `use()` pairs the way {@link useCbbiWeights} reads them. Nine
 * explicit calls again — never a loop.
 *
 * A weight of `1` is written with `clear()`, not `set(1)`: `1` is the field's fallback, and a reset
 * UNSETS (see {@link resetCbbiWeights}). A weight of `0` means the metric leaves `metrics`
 * entirely, so the composite renormalises over the rest rather than averaging in a zero.
 */
export function useApplyCbbiPreset(): (key: CbbiPresetKey) => void {
  const [, setPiCycle] = cbbiWeightField.PiCycle.use()
  const [, setRupl] = cbbiWeightField.RUPL.use()
  const [, setRhodl] = cbbiWeightField.RHODL.use()
  const [, setPuell] = cbbiWeightField.Puell.use()
  const [, setTwoYma] = cbbiWeightField['2YMA'].use()
  const [, setTrolololo] = cbbiWeightField.Trolololo.use()
  const [, setMvrv] = cbbiWeightField.MVRV.use()
  const [, setReserveRisk] = cbbiWeightField.ReserveRisk.use()
  const [, setWoobull] = cbbiWeightField.Woobull.use()
  const [, setMetrics] = cbbiFilters.field.metrics.use()

  return useCallback(
    (key: CbbiPresetKey) => {
      const preset = CBBI_PRESETS.find((candidate) => candidate.key === key)
      if (!preset) return
      const setters: Record<CbbiMetricKey, (next: number) => void> = {
        PiCycle: setPiCycle,
        RUPL: setRupl,
        RHODL: setRhodl,
        Puell: setPuell,
        '2YMA': setTwoYma,
        Trolololo: setTrolololo,
        MVRV: setMvrv,
        ReserveRisk: setReserveRisk,
        Woobull: setWoobull,
      }
      for (const metric of CBBI_METRIC_KEYS) {
        const weight = preset.weights[metric]
        if (weight === 1) cbbiWeightField[metric].clear()
        else setters[metric](weight)
      }
      setMetrics(CBBI_METRIC_KEYS.filter((metric) => preset.weights[metric] > 0))
    },
    [
      setPiCycle,
      setRupl,
      setRhodl,
      setPuell,
      setTwoYma,
      setTrolololo,
      setMvrv,
      setReserveRisk,
      setWoobull,
      setMetrics,
    ],
  )
}

/**
 * Drop one metric from the selection. The WEIGHT is untouched on purpose — switching a metric back
 * on restores the weight the reader had given it, rather than silently resetting it to 1.
 */
export function useDisableCbbiMetric(): (key: CbbiMetricKey) => void {
  const [enabled, setMetrics] = cbbiFilters.field.metrics.use()
  return useCallback(
    (key: CbbiMetricKey) => {
      setMetrics(enabled.filter((metric) => metric !== key))
    },
    [enabled, setMetrics],
  )
}
