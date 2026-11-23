import { queryOptions } from '@tanstack/react-query'
import type { ScheduleEvent } from 'basalt-ui/cards'
import { BUYERS, ORDERS, SUPPLIERS, TODAY } from './ref-inventory'

/**
 * The reference schedule: the inventory's deliveries and supplier calls over five weeks around the
 * fixed today, so the week, the month and the up-next list read the same in every shot.
 */

export type VisitKind = 'delivery' | 'call' | 'stocktake'

export const VISIT_LABELS: Record<VisitKind, string> = {
  delivery: 'Delivery',
  call: 'Supplier call',
  stocktake: 'Stocktake',
}

/** One entry: a delivery of an order, a call with a supplier's contact, or a whole-day stocktake. */
export type Visit = ScheduleEvent & {
  start: number
  end: number
  kind: VisitKind
  supplierId: string | null
  supplier: string | null
  order: string | null
  dock: string | null
  note: string
}

const DAY = 86_400_000
const MIDNIGHT = TODAY - (TODAY % DAY)

/** Each weekday's possible entries: kind, start minute, length in minutes. Today takes them all. */
const SLOTS: readonly (readonly ['delivery' | 'call', number, number])[] = [
  ['delivery', 7 * 60, 45],
  ['call', 9 * 60 + 30, 30],
  ['delivery', 10 * 60, 60],
  ['call', 10 * 60 + 30, 45],
  ['call', 13 * 60, 15],
  ['delivery', 14 * 60, 90],
  ['call', 15 * 60 + 30, 60],
]

const DOCKS = ['Dock 1', 'Dock 2', 'Dock 3'] as const

let sequence = 100

function visitsOn(offset: number): Visit[] {
  const weekday = (((offset % 7) + 7) % 7) as number
  if (weekday >= 5) return []
  return SLOTS.flatMap(([kind, minute, length], k): Visit[] => {
    if (offset !== 0 && (offset * 3 + k * 5 + 7) % 7 >= 4) return []
    const n = Math.abs(offset * 7 + k)
    const supplier = SUPPLIERS[n % SUPPLIERS.length]!
    const order = ORDERS[n % ORDERS.length]!
    const buyer = BUYERS[n % BUYERS.length]!
    const start = MIDNIGHT + offset * DAY + minute * 60_000
    const base = {
      id: `e-${(sequence += 1)}`,
      start,
      end: start + length * 60_000,
      supplierId: supplier.id,
      supplier: supplier.name,
    }
    return kind === 'delivery'
      ? [
          {
            ...base,
            kind,
            title: `${supplier.name.split(' ')[0]} delivery`,
            tone: 'info' as const,
            attendees: [buyer],
            order: order.number,
            dock: DOCKS[n % DOCKS.length]!,
            note: `${order.lines} lines to receive and check against the order.`,
          },
        ]
      : [
          {
            ...base,
            kind,
            title: `${supplier.contact.split(' ')[0]} call`,
            tone: 'good' as const,
            attendees: [supplier.contact, buyer],
            order: null,
            dock: null,
            note: `Lead time and the next quarter's volumes with ${supplier.name}.`,
          },
        ]
  })
}

const STOCKTAKES: Visit[] = [3, 17].map((offset) => ({
  id: `e-${900 + offset}`,
  title: 'Stocktake, hall B',
  start: MIDNIGHT + offset * DAY,
  end: MIDNIGHT + (offset + 1) * DAY,
  allDay: true,
  kind: 'stocktake',
  supplierId: null,
  supplier: null,
  order: null,
  dock: null,
  note: 'Hall B is counted: no deliveries are received there.',
}))

export const VISITS: readonly Visit[] = [
  ...Array.from({ length: 42 }, (_, i) => visitsOn(i - 21)).flat(),
  ...STOCKTAKES,
]

export const visitOf = (id: string): Visit | undefined => VISITS.find((v) => v.id === id)

/** The schedule as the app reads it: a query, so the page shows its loading and error frames. */
export const visitsQuery = queryOptions({
  queryKey: ['ref', 'visits'],
  queryFn: async (): Promise<readonly Visit[]> => VISITS,
})
