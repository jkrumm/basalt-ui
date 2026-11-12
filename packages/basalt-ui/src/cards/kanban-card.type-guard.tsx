/**
 * Compile-time proof of the `KanbanCard` contract (docs/v3/concepts/charts-cards-kanban.md section
 * 4), checked by `tsc --noEmit`. Every `@ts-expect-error` is one "never": remove the line and the
 * file stops compiling. The valid cards come first so each guard fails for the stated reason.
 */
import type { ReactElement } from 'react'
import type { ColumnRef, Move } from './contract'
import { KanbanCard } from './kanban-card'

type Col = 'todo' | 'doing' | 'done'
const todo: ColumnRef<Col> = { id: 'todo', label: 'To do', count: 3 }
const columns: readonly ColumnRef<Col>[] = [todo, { id: 'doing', label: 'Doing', count: 1 }]
const onMove = (_m: Move<Col>): void => undefined

export const movable: ReactElement = (
  <KanbanCard
    id="a"
    title="Fix the cache key"
    meta={['EP-412', 'api']}
    chips={[{ label: 'bug' }, { label: 'api' }, { label: 'p1' }, { label: 'infra' }]}
    move={{ column: todo, index: 0, columns, onMove }}
  />
)

export const readOnly: ReactElement = <KanbanCard id="b" title="Read only" move="static" />

// @ts-expect-error -- `move` is required: no card exists without the non-drag path
export const noMove: ReactElement = <KanbanCard id="c" title="No path" />

export const fiveChips: ReactElement = (
  <KanbanCard
    id="d"
    title="Too many"
    // @ts-expect-error -- at most four chips
    chips={[{ label: '1' }, { label: '2' }, { label: '3' }, { label: '4' }, { label: '5' }]}
    move="static"
  />
)

export const threeMeta: ReactElement = (
  <KanbanCard
    id="e"
    title="Too much meta"
    // @ts-expect-error -- one or two meta strings, never a third
    meta={['a', 'b', 'c']}
    move="static"
  />
)

export const wrongColumn: ReactElement = (
  <KanbanCard
    id="f"
    title="Unknown column"
    // @ts-expect-error -- the move's column id must be one of the board's column ids
    move={{ column: { id: 'nope', label: 'x', count: 0 }, index: 0, columns, onMove }}
  />
)
