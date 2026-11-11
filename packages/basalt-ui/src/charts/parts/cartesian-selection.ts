/**
 * `selection` on the engine's keyed selection: a click and Enter propose the datum under the pointer
 * or focus, a blank-surface click proposes `null`. The key is the datum's index in `data`, so the app
 * keeps holding datums, not engine keys. The controller lives on the definition; the server render
 * never runs it.
 */
import { controlledSignal } from '@tanstack/charts/interaction/signal'
import { keyedSelection } from '@tanstack/charts/selection'
import type { KeyedSelection } from '@tanstack/charts/selection'
import type { ChartSelection } from '../contract'
import type { ChartX } from '../types'

/** What the engine hands a selection: the plotted row, which carries its datum. */
export type SelectableRow<D> = { datum: D }

export type ChartSelectionController<D> = KeyedSelection<SelectableRow<D>, number, ChartX, number>

/** The datum's index in `data`, or `undefined` for one the chart does not hold. */
export const indexMap = <D>(data: readonly D[]): ReadonlyMap<D, number> =>
  new Map(data.map((d, i) => [d, i]))

export function chartSelection<D>(
  data: readonly D[],
  indexOf: ReadonlyMap<D, number>,
  selection: ChartSelection<D>,
): ChartSelectionController<D> {
  const { selected, onSelect } = selection
  return keyedSelection<SelectableRow<D>, number, ChartX, number>({
    selected: controlledSignal<number | null>(
      selected === null ? null : (indexOf.get(selected) ?? null),
      (next) => onSelect(next === null ? null : (data[next] ?? null)),
    ),
    key: (row) => indexOf.get(row.datum),
  })
}
