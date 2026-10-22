import type { ReactElement } from 'react'
import { Board } from '../../../src/dashboard/board'

/** Wave 46: a loading `Board` with its column titles known (`board-loading-host`). */
export function BoardLoadingFixture(): ReactElement {
  return (
    <div data-testid="board-loading-host">
      <Board
        label="Board"
        loading
        columns={[
          { id: 'needs', title: 'Needs you', cards: [] },
          { id: 'working', title: 'Working', cards: [] },
          { id: 'done', title: 'Done', cards: [] },
        ]}
      />
    </div>
  )
}
