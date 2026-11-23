/** The parts list's domain: what the list page reads from a part, and the labels and tones it shows. */
export type Category = 'fasteners' | 'bearings' | 'seals' | 'hydraulics' | 'electrical'
export const CATEGORY_LABELS: Record<Category, string> = {
  fasteners: 'Fasteners',
  bearings: 'Bearings',
  seals: 'Seals',
  hydraulics: 'Hydraulics',
  electrical: 'Electrical',
}

/** How much of a part is on the shelf against its reorder point. */
export const STOCK = ['in-stock', 'low', 'out'] as const
export type Stock = (typeof STOCK)[number]
export const STOCK_LABELS: Record<Stock, string> = {
  'in-stock': 'In stock',
  low: 'Low',
  out: 'Out',
}
export const STOCK_TONE = { 'in-stock': 'good', low: 'warn', out: 'bad' } as const

/** Where a part stands in replenishment: the board's columns, stored as the words they show. */
export const PLANS = ['No action', 'Reorder', 'On order', 'On hold'] as const
export type Plan = (typeof PLANS)[number]

export type Tag = 'critical' | 'long-lead' | 'imported' | 'hazmat'
export const TAG_LABELS: Record<Tag, string> = {
  critical: 'Critical',
  'long-lead': 'Long lead',
  imported: 'Imported',
  hazmat: 'Hazmat',
}
export const TAG_TONE = {
  critical: 'bad',
  'long-lead': 'warn',
  imported: 'info',
  hazmat: 'warn',
} as const

export type Part = {
  id: string
  sku: string
  name: string
  category: Category
  supplierId: string
  supplier: string
  buyer: string
  tags: readonly string[]
  stock: Stock
  plan: Plan
  onHand: number
  /** Stock value in EUR: on hand times unit cost. */
  value: number
  /** The day the next delivery of this part is due, `YYYY-MM-DD`. */
  nextDelivery: string
}
