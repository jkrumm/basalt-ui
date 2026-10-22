import { Box } from '@mantine/core'
import { Board } from 'basalt-ui'
import { BOARD_COLUMNS } from '../agents-data'
import { ErrorNote } from '../../demo/fixtures/error-note'
import { noop, retryCopy } from '../shot-state'
import type { ShotState } from '../shot-state'

/** The warden board: four status columns, `Done` empty on purpose. `empty` clears every column
 * (the tile); `loading` is column-shaped skeletons; `error` is the one-sentence note and a retry. */
export function AgentsBoard({ shotState }: { shotState?: ShotState | undefined }) {
  if (shotState === 'error') {
    return (
      <Box data-shot="board">
        <ErrorNote
          title="Could not load the board"
          cause={retryCopy('warden board')}
          onRetry={noop}
        />
      </Box>
    )
  }
  const columns = BOARD_COLUMNS.map((c) => ({
    ...c,
    cards: shotState === 'empty' ? [] : c.cards,
  }))
  return (
    <Box data-shot="board">
      <Board
        label="Warden board"
        columns={columns}
        height={420}
        loading={shotState === 'loading'}
        onOpen={noop}
        empty={{
          title: 'The board is clear',
          description: 'Items appear here as warden picks them up.',
        }}
      />
    </Box>
  )
}
