import type { ReactElement } from 'react'
import { Bars, ChartCard } from '../../../src/charts'
import { BarList } from '../../../src/dashboard/bar-list'
import { VX } from '../../../src/tokens'

const BINS = ['<20', '20–30', '30–40', '40–50', '50–60', '60–70', '70+'].map((bin, i) => ({
  bin,
  n: [1, 3, 6, 4, 5, 2, 1][i] ?? 0,
}))

const ITEMS = [
  { key: 'a', label: 'argo', value: 80, secondary: '40%' },
  { key: 'b', label: 'rollhook', value: 60, secondary: '30%' },
  { key: 'c', label: 'rb', value: 40, secondary: '20%' },
]

const FACTS = { value: '12.4', unit: 'h', period: 'last 30 d' }
const BASIS = 'Median across 14 runs'

const chart = (
  <Bars
    ariaLabel="Distribution"
    data={BINS}
    x={(d) => d.bin}
    bars={[{ key: 'n', label: 'Books', color: VX.accent, getValue: (d) => d.n }]}
  />
)

const BODIES: Record<string, { card: { placeholderHeight?: 'content' } }> = {
  chart: { card: {} },
  list: { card: { placeholderHeight: 'content' } },
}

/** A facts card per body at rest and pending, each `data-testid="w38-load-<body>-<rest|loading>"`. */
export function W38LoadingFixture(): ReactElement {
  return (
    <div style={{ display: 'grid', gap: 16, padding: 16, width: 420 }}>
      {Object.entries(BODIES).flatMap(([body, { card }]) =>
        (['rest', 'loading'] as const).map((mode) => (
          <div key={`${body}-${mode}`} data-testid={`w38-load-${body}-${mode}`}>
            <ChartCard
              title="Stuck items"
              facts={FACTS}
              subtitle={BASIS}
              {...card}
              {...(mode === 'loading' && { state: { pending: true } })}
            >
              {body === 'chart' ? (
                chart
              ) : (
                <BarList
                  label="Top drivers"
                  items={ITEMS}
                  {...(mode === 'loading' && { loading: true, loadingRows: ITEMS.length })}
                />
              )}
            </ChartCard>
          </div>
        )),
      )}
    </div>
  )
}
