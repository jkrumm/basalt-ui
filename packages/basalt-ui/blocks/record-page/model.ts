/** The supplier record's domain: the supplier, its related records, and the labels and tones they show. */
export type Rating = 'preferred' | 'approved' | 'probation'
export const RATING_LABELS: Record<Rating, string> = {
  preferred: 'Preferred',
  approved: 'Approved',
  probation: 'On probation',
}
export const RATING_TONE = { preferred: 'good', approved: 'info', probation: 'warn' } as const

export type Supplier = {
  id: string
  name: string
  domain: string
  city: string
  country: string
  rating: Rating
  contact: string
  contactRole: string
  email: string
  phone: string
  /** Days from order to delivery, quoted. */
  leadDays: number
  /** Share of the last 12 months' deliveries that arrived on the due day or before. */
  onTime: number
  terms: string
  /** The day the supplier was first used, `YYYY-MM-DD`. */
  since: string
}

export type Category = 'fasteners' | 'bearings' | 'seals' | 'hydraulics' | 'electrical'
export const CATEGORY_LABELS: Record<Category, string> = {
  fasteners: 'Fasteners',
  bearings: 'Bearings',
  seals: 'Seals',
  hydraulics: 'Hydraulics',
  electrical: 'Electrical',
}

export const STOCK = ['in-stock', 'low', 'out'] as const
export type Stock = (typeof STOCK)[number]
export const STOCK_LABELS: Record<Stock, string> = {
  'in-stock': 'In stock',
  low: 'Low',
  out: 'Out',
}
export const STOCK_TONE = { 'in-stock': 'good', low: 'warn', out: 'bad' } as const

export type Part = {
  id: string
  sku: string
  name: string
  category: Category
  stock: Stock
  onHand: number
  /** Stock value in EUR: on hand times unit cost. */
  value: number
  /** The day the next delivery of this part is due, `YYYY-MM-DD`. */
  nextDelivery: string
}

export const ORDER_STATES = ['draft', 'sent', 'confirmed', 'partial', 'received'] as const
export type OrderState = (typeof ORDER_STATES)[number]
export const ORDER_LABELS: Record<OrderState, string> = {
  draft: 'Draft',
  sent: 'Sent',
  confirmed: 'Confirmed',
  partial: 'Part received',
  received: 'Received',
}
export const ORDER_TONE = {
  draft: 'neutral',
  sent: 'info',
  confirmed: 'info',
  partial: 'warn',
  received: 'good',
} as const

export type Order = {
  id: string
  number: string
  state: OrderState
  buyer: string
  ordered: string
  due: string
  lines: number
  /** Order total in EUR. */
  total: number
}

export const NOTE_TYPE_LABELS = {
  call: 'Call',
  meeting: 'Meeting',
  quality: 'Quality issue',
  email: 'Email',
  memo: 'Memo',
} as const
export type NoteType = keyof typeof NOTE_TYPE_LABELS

export type Note = {
  id: string
  title: string
  type: NoteType
  body: string
  part: string
  author: string
  /** The time the note was last updated, as an ISO string. */
  updated: string
}

/** A supplier's related records: its orders, the parts it delivers and the notes about it. */
export type SupplierRecords = {
  orders: readonly Order[]
  parts: readonly Part[]
  notes: readonly Note[]
}
