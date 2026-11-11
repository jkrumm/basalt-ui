/**
 * Compile-time proof of the list composites' typing, checked by `tsc --noEmit` (docs/v3/concepts/
 * charts-cards-kanban.md section 8). Every `@ts-expect-error` is one "never"; the valid lists at
 * the top prove the guards fail for the stated reason and not because the props are wrong everywhere.
 */
import type { ReactElement } from 'react'
import { BarList } from './bar-list'
import { EventList } from './event-list'

const items = [
  { label: 'argo', value: 1840, href: '/argo' },
  { label: 'rb', value: 920, onSelect: () => undefined },
  { label: 'shutterflow', value: 400 },
]

export const validBars: ReactElement = (
  <BarList title="Top projects" items={items} max={3160} rows={6} />
)

export const validEvents: ReactElement = (
  <EventList
    title="Activity"
    items={[
      {
        id: 'e1',
        at: Date.now(),
        actor: 'Ada',
        title: 'merged PR 482',
        chips: ['main'],
      },
    ]}
    pageSize={10}
  />
)

export const barNoClassName: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <BarList title="Top projects" items={items} className="p-8" />
)

export const barNoColor: ReactElement = (
  // @ts-expect-error a list takes no colour
  <BarList title="Top projects" items={items} color="red" />
)

export const barNoStyle: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <BarList title="Top projects" items={items} style={{ color: 'red' }} />
)

export const barRowLinkAndButton: ReactElement = (
  <BarList
    title="Top projects"
    items={[
      // @ts-expect-error a row is a link or a button, never both
      { label: 'argo', value: 1, href: '/argo', onSelect: () => undefined },
    ]}
  />
)

export const barRowsOutOfRange: ReactElement = (
  // @ts-expect-error the body holds 3 to 10 rows
  <BarList title="Top projects" items={items} rows={2} />
)

export const eventNoClassName: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <EventList title="Activity" items={[]} className="p-8" />
)

export const eventNoColor: ReactElement = (
  // @ts-expect-error a list takes no colour
  <EventList title="Activity" items={[]} color="red" />
)

export const eventNoStyle: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <EventList title="Activity" items={[]} style={{ color: 'red' }} />
)

export const eventBodyNode: ReactElement = (
  // @ts-expect-error an event title is text, never a node
  <EventList title="Activity" items={[{ id: 'e1', at: 0, title: <b>merged</b> }]} />
)
