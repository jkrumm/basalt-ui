import { createFormat } from 'basalt-ui'
import { CATEGORY_LABELS, STOCK_LABELS } from './ref-inventory'
import type { Part } from './ref-inventory'

const f = createFormat({ locale: 'en' })

/** What the part's record page and its peek both list, so the two never differ. */
export function partFacts(part: Part): { label: string; value: string }[] {
  return [
    { label: 'Category', value: CATEGORY_LABELS[part.category] },
    { label: 'Stock', value: STOCK_LABELS[part.stock] },
    { label: 'On hand', value: `${f.number(part.onHand)} pcs` },
    { label: 'Reorder at', value: `${f.number(part.reorderAt)} pcs` },
    { label: 'Unit cost', value: f.money(part.unitCost, 'EUR') },
    { label: 'Stock value', value: f.money(part.value, 'EUR') },
    { label: 'Next delivery', value: f.date(Date.parse(part.nextDelivery)) },
    { label: 'Bin', value: part.bin },
    { label: 'Plan', value: part.plan },
  ]
}
