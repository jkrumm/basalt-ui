/**
 * Compile-time proof of the list composites' typing, checked by `tsc --noEmit` (docs/v3/concepts/
 * charts-cards-kanban.md section 8). Every `@ts-expect-error` is one "never"; the valid lists at
 * the top prove the guards fail for the stated reason and not because the props are wrong everywhere.
 */
import type { ReactElement } from 'react'
import type { ListFocus, ListFocusItem } from '../core/ports'
import { BarList } from './bar-list'
import { EventList } from './event-list'

const items = [
  { label: 'argo', value: 1840, href: '/argo' },
  { label: 'rb', value: 920, onClick: () => undefined },
  { label: 'shutterflow', value: 400 },
]

export const validBars: ReactElement = (
  <BarList title="Top projects" items={items} max={3160} bodyRows={6} />
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
  // @ts-expect-error a list takes no color
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
      { label: 'argo', value: 1, href: '/argo', onClick: () => undefined },
    ]}
  />
)

export const barRowsPastTen: ReactElement = <BarList title="Months" items={items} bodyRows={12} />

export const barRowsNotACount: ReactElement = (
  // @ts-expect-error the body holds a count of rows, never a height
  <BarList title="Top projects" items={items} bodyRows="h-56" />
)

declare const focus: ListFocus<unknown>
declare const series: {
  readonly setSeries: (key: string | null) => void
  readonly seriesItem: (key: string) => ListFocusItem
}

export const validSeriesBars: ReactElement = (
  <BarList
    title="Requests"
    items={items}
    focusSeries={{ focus: series, key: (row) => row.label }}
    mono
  />
)

export const validItemBars: ReactElement = (
  <BarList title="Windows" items={items} focusItems={{ focus, holds: (row) => row.value > 0 }} />
)

const byLabel = { focus: series, key: (row: { label: string }): string => row.label }

export const barTwoFocusArms: ReactElement = (
  // @ts-expect-error a list joins a chart's focus by one arm at most
  <BarList title="R" items={items} focus={focus} focusSeries={byLabel} />
)

export const eventNoClassName: ReactElement = (
  // @ts-expect-error a composite takes no styling channel
  <EventList title="Activity" items={[]} className="p-8" />
)

export const eventNoColor: ReactElement = (
  // @ts-expect-error a list takes no color
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
