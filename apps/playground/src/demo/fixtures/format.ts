/**
 * The one number-formatting module the playground shares (audit E §3/§7): `money`/`pct`/`ratio`/
 * `fmtMonthTick`/`deltaPct` used to be defined once inside `demo/cbbi/cbbi-data.ts` and copied by
 * hand wherever another page needed the same shape (`dashboard/revenue.tsx`'s local `fmtMoney`,
 * `dashboard/sessions.tsx`'s local `fmtInt`, before both were retired). basalt ships no `./format`
 * subpath yet (a later consolidation wave), so this stays local until it does —
 * `cbbi-data.ts` re-exports these so its own nine consumers see no import change.
 */

/** `0.4077` → `41%`. The index is read as a percentage everywhere it is stated. */
export function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** `0.4077` → `0.408`. The mono reading in a panel or a table, where the third digit matters. */
export function ratio(value: number): string {
  return value.toFixed(3)
}

const USD = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function money(value: number): string {
  return `$${USD.format(Math.round(value))}`
}

/** An integer count, thousands-grouped — the `dashboard/sessions.tsx`-shaped reading. */
export function integer(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/** `2026-08-28` → `Aug 26` — an axis tick that stays legible across a four-year window. */
export function fmtMonthTick(key: string): string {
  const date = new Date(`${key}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return key
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

/** Percent change from `before` to `after`, the sign `DeltaBadge` wants. */
export function deltaPct(after: number, before: number): number | undefined {
  if (before === 0 || !Number.isFinite(before)) return undefined
  return ((after - before) / Math.abs(before)) * 100
}
