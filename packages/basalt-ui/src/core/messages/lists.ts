import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `BarList` and `EventList`. Keys carry the area prefix (`lists.`), which the
 * coverage test holds; the brief's `card.*` prefix would fail it.
 */
export type ListsMessages = Record<
  'lists.noItems' | 'lists.noEvents' | 'lists.today' | 'lists.yesterday',
  string
> &
  Record<'lists.showMore' | 'lists.eventCount', (f: Format, n: number) => string>

export const lists = {
  'lists.noItems': 'No items to compare yet',
  'lists.noEvents': 'Nothing has happened yet',
  'lists.today': 'Today',
  'lists.yesterday': 'Yesterday',
  'lists.showMore': (f, n) => `Show more (${f.number(n)})`,
  'lists.eventCount': (f, n) => `${f.number(n)} ${f.plural(n) === 'one' ? 'event' : 'events'}`,
} satisfies Partial<BasaltMessages>
