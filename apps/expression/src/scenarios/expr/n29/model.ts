import type { Booking, TaxTag } from './fixture'

export const TAG_LABEL: Record<TaxTag | 'none', string> = {
  business: 'Business cost',
  home: 'Home office',
  donation: 'Donation',
  none: 'Untagged',
}

/** The order the split bar and its rows read in: the tags, then what is still untagged. */
export const TAG_ORDER = ['business', 'home', 'donation', 'none'] as const

export type TagKey = (typeof TAG_ORDER)[number]

export type Split = Record<TaxTag | 'none', number>

export type Merchant = {
  name: string
  bookings: number
  untaggedBookings: number
  total: number
  untagged: number
  split: Split
}

const emptySplit = (): Split => ({ business: 0, home: 0, donation: 0, none: 0 })

export function splitOf(rows: readonly Booking[]): Split {
  const split = emptySplit()
  for (const b of rows) split[b.tag ?? 'none'] += b.amount
  return split
}

export const totalOf = (split: Split): number =>
  split.business + split.home + split.donation + split.none

/** The merchants that still hold untagged bookings, the most untagged spend first. */
export function untaggedMerchants(rows: readonly Booking[]): readonly Merchant[] {
  const byName = new Map<string, Booking[]>()
  for (const b of rows) byName.set(b.merchant, [...(byName.get(b.merchant) ?? []), b])
  const merchants: Merchant[] = []
  for (const [name, own] of byName) {
    const split = splitOf(own)
    if (split.none === 0) continue
    merchants.push({
      name,
      bookings: own.length,
      untaggedBookings: own.filter((b) => b.tag === null).length,
      total: totalOf(split),
      untagged: split.none,
      split,
    })
  }
  return merchants.sort((a, b) => b.untagged - a.untagged)
}
