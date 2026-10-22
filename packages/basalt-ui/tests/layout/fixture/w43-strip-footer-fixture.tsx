import type { ReactElement } from 'react'
import { DeltaBadge, StatGroup } from '../../../src/index'

/** Wave 43: argo's body-composition strip — a Weight cell in its empty state with an `under` goal
 *  footer, beside a populated cell, and a full-width footer entry (`w43-strip-footer`). */
export function W43StripFooterFixture(): ReactElement {
  return (
    <div data-testid="w43-strip-footer">
      <StatGroup
        variant="strip"
        label="Body composition"
        cols={2}
        cells={[
          {
            key: 'weight',
            caption: 'Weight',
            value: null,
            state: { kind: 'empty', reason: 'No weigh-ins yet' },
          },
          {
            key: 'fat',
            caption: 'Body fat',
            value: '18.4',
            unit: '%',
            delta: <DeltaBadge value={-1.2} polarity="up-bad" period="vs last month" />,
          },
        ]}
        footer={[
          { key: 'goal', under: 'weight', content: 'Set a goal weight' },
          { key: 'note', content: 'Measured weekly, fasted' },
        ]}
      />
    </div>
  )
}
