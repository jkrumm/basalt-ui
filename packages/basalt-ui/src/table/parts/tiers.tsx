/**
 * The tier inputs of a table (docs/v3/concepts/data-table.md section 6). The tiers themselves are
 * CSS container queries in `../table.css`; this file only turns the plan and two props into the
 * attributes that CSS reads, from props alone, so the server HTML already carries the right tier.
 *
 * `data-below` is the inline size under which the table stops being a table: `480` or `800` (the
 * plan's `reducedFrom`, raised by `cardsBelow: 'wide'`) or `always`.
 */
import type { CSSProperties } from 'react'
import type { TableModel } from '../use-data-table'

export type TierAttributes = {
  'data-phone': 'cards' | 'scroll'
  'data-below': '480' | '800' | 'always'
}

export function tierAttributesOf<T>(model: TableModel<T>): TierAttributes {
  const below =
    model.cardsBelow === 'always'
      ? 'always'
      : model.cardsBelow === 'wide'
        ? '800'
        : String(model.plan.reducedFrom)
  return {
    'data-phone': model.phone,
    'data-below': below as TierAttributes['data-below'],
  }
}

/** The scroll tier's table width: priority 1 and 2 columns at their planned size. */
export function scrollMinWidth<T>(model: TableModel<T>): CSSProperties {
  const selectPx = model.selection === undefined ? 0 : 40
  const px = model.plan.columns.reduce(
    (sum, column) => (column.visible && column.priority !== 3 ? sum + column.widthPx : sum),
    selectPx,
  )
  return { ['--table-min-scroll' as string]: `${px}px` }
}
