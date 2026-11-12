import { defineControls, field } from 'basalt-ui/router'
import { EXERCISES } from './synthetic'

const iso = (d: Date): string => d.toISOString().slice(0, 10)
const monthsBack = (months: number) => (now: Date) => {
  const from = new Date(now)
  from.setUTCMonth(from.getUTCMonth() - months)
  return { from: iso(from), to: iso(now) }
}
const yearToDate = (now: Date) => ({ from: `${now.getUTCFullYear()}-01-01`, to: iso(now) })

/**
 * argo's `strengthStore`: tab, a seven-preset range with four presets the API refuses (resolved to
 * `from`/`to` by the field's own `window:` map), and a multi over the four lifts.
 */
export const strength = defineControls({
  id: 'strength-tracker',
  scope: 'page',
  fields: {
    tab: field.enum(['train', 'charts', 'history'], 'charts').labels({
      train: 'Train',
      charts: 'Charts',
      history: 'History',
    }),
    window: field.range({
      presets: ['7d', '30d', '3m', '6m', '1y', 'ytd', 'all'],
      fallback: '30d',
      custom: true,
      window: { '3m': monthsBack(3), '6m': monthsBack(6), '1y': monthsBack(12), ytd: yearToDate },
    }),
    exercises: field.multi(EXERCISES, []).labels({
      bench_press: 'Bench press',
      deadlift: 'Deadlift',
      squat: 'Squat',
      pull_ups: 'Pull-ups',
    }),
  },
})
