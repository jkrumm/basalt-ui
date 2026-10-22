import type { ReactElement } from 'react'
import { Board } from '../../../src/dashboard/board'

/** Wave 46: a `Board` whose one card carries a linked record (`w46-board-record`). */
export function BoardRecordFixture(): ReactElement {
  return (
    <div data-testid="board-record-host">
      <Board
        label="Board"
        height={360}
        columns={[
          {
            id: 'needs',
            title: 'Needs you',
            cards: [
              {
                id: 'a',
                actor: 'warden',
                type: 'PR review',
                title: 'Fix the cache key',
                record: { label: '#482', href: '#record-482' },
                status: 'Waiting on CI · 2 h',
              },
            ],
          },
        ]}
      />
    </div>
  )
}
