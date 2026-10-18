import type { ReactElement } from 'react'
import { ChartCard } from '../../../src/charts'
import { BarList } from '../../../src/dashboard/bar-list'
import type { BarListProps } from '../../../src/dashboard/bar-list'
import type { ChartCardProps } from '../../../src/charts'

const ITEMS = [
  { key: 'a', label: 'argo', value: 80, secondary: '40%' },
  { key: 'b', label: 'rollhook', value: 60, secondary: '30%' },
  { key: 'c', label: 'rb', value: 40, secondary: '20%' },
  { key: 'd', label: 'linewatch', value: 20, secondary: '10%' },
]

type StateSpec = { list?: Partial<BarListProps>; card?: Partial<ChartCardProps> }

const CONTENT = 'content' as const

const STATES: Record<string, StateSpec> = {
  loaded: {},
  loading: { list: { loading: true, loadingRows: ITEMS.length } },
  empty: { list: { items: [] } },
  // The card owns error/empty/pending; `placeholderHeight="content"` is the opt for a non-chart body.
  error: {
    card: {
      state: { error: new Error('Waiting items failed to load.') },
      onRetry: () => {},
      placeholderHeight: CONTENT,
    },
  },
  cardEmpty: {
    card: { state: { empty: 'Nothing is waiting.' }, placeholderHeight: CONTENT },
  },
  cardLoading: {
    card: { state: { pending: true }, placeholderHeight: CONTENT },
    list: { loading: true, loadingRows: ITEMS.length },
  },
}

/** The compact stacked rows and the wide single-line rows (the list's container flips at 480px). */
export const LIST_WIDTHS = { narrow: 360, wide: 600 } as const

/** One card per state and width around the same list, each `data-testid="list-<state>-<width>"`. */
export function BarListStatesFixture(): ReactElement {
  return (
    <div style={{ display: 'grid', gap: 16, padding: 16 }}>
      {Object.entries(LIST_WIDTHS).flatMap(([width, px]) =>
        Object.entries(STATES).map(([state, spec]) => (
          <div
            key={`${state}-${width}`}
            data-testid={`list-${state}-${width}`}
            style={{ width: px }}
          >
            <ChartCard title="Spend by project" {...spec.card}>
              <BarList label="Spend by project" items={ITEMS} {...spec.list} />
            </ChartCard>
          </div>
        )),
      )}
    </div>
  )
}
