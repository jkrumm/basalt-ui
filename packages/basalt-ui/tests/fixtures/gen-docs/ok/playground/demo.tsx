// fallow-ignore-file unused-file
import { createCounter, StatCard } from '../src/index'

export function Demo() {
  // #region example:StatCard
  const card = StatCard({ label: 'Visits', value: 3 })
  const label = card.text
  // #endregion
  // #region example:create-counter
  const next = createCounter({ step: 2 })
  // #endregion
  return `${label}${next()}`
}
