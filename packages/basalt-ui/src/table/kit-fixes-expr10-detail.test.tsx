/**
 * The detail-placed columns of a phone card (`v3-expr-10-kit-fixes`): a derived sheet lists them, so
 * they leave the card; a custom `detail` render lists only what it writes, so they stay.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import type { UseDataTable } from './contract'
import { col } from './core/kinds'
import { DataTable } from './parts/data-table'
import { useDataTable } from './use-data-table'

afterEach(cleanup)

type Room = { id: string; room: string; floor: string }
const ROOMS: Room[] = [
  { id: 'a', room: 'Kitchen', floor: 'Floor 2' },
  { id: 'b', room: 'Hall', floor: 'Floor 1' },
]

function Subject({ activation }: { activation: 'custom' | 'row' | 'auto' }): ReactElement {
  const c = col<Room>()
  const t = useDataTable<Room>({
    id: `rooms-${activation}`,
    label: 'Rooms',
    columns: [c.entity('room'), c.text('floor', { card: 'detail' })],
    data: ROOMS,
    getRowId: (r: Room) => r.id,
    mode: { kind: 'client' },
    ...(activation === 'custom' && { detail: (row: Room) => <p>{row.room}</p> }),
    ...(activation === 'row' && { onRowActivate: () => undefined }),
  } as unknown as UseDataTable<Room>)
  return <DataTable table={t} />
}

const marks = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll('tbody [data-kind="text"]')].map((cell) =>
    cell.getAttribute('data-card'),
  )

describe('a column placed in the card detail', () => {
  test('stays on the phone card under a custom detail render', () => {
    const { container } = render(<Subject activation="custom" />)
    expect(marks(container)).toEqual([null, null])
  })

  test('leaves the card when a derived sheet lists it', () => {
    for (const activation of ['row', 'auto'] as const) {
      const { container } = render(<Subject activation={activation} />)
      expect(marks(container)).toEqual(['hidden', 'hidden'])
      cleanup()
    }
  })
})
