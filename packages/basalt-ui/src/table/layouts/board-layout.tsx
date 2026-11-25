/**
 * The board layout (docs/v3/concepts/data-table.md section 3, Layouts): `Board` from `./cards` over
 * the table's rows, one column per option of a `c.select` column. A card is a `KanbanCard` built from
 * the row's card face; its menu moves it (the keyboard path), opens the record and ticks it.
 *
 * Law:
 * - A move between columns shows at once and calls the select's `commit(row, option)`; a commit that
 *   rejects or throws puts the card back and says so, so `commit` returns its promise. The card keeps
 *   the dropped place until the data agrees with the move or replaces the row.
 * - A move inside one column changes nothing: the order is the table's sort.
 * - The axis is the view's grouping when it names a select column (`boardAxis`); with two or more
 *   axes a Group by switch writes the grouping, so the table groups by the same column.
 */
import { useRef, useState } from 'react'
import type { MouseEvent, ReactElement } from 'react'
import { Board } from '../../cards/board'
import { KanbanCard } from '../../cards/kanban-card'
import type { CardChip, Move } from '../../cards/contract'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import type { DragLike, VirtualLike } from '../../core/ports'
import { Segmented } from '../../ui/segmented'
import type { ModelRow, TableModel } from '../use-data-table'
import { CardTick, INTERACTIVE_IN_CARD } from './card-tick'
import { boardAxis, boardLanes, cardFace, laneTotal, totalColumn } from './model'
import type { FaceValue, Pending } from './model'

/** The px of one board card in a windowed column: a title, two meta lines and a row of chips. */
export const BOARD_CARD_PX = 112

type Item<T> = { id: string; title: string; row: ModelRow<T> }

/** The card's figure with the column it reads, so a bare amount is never unnamed: `Revenue 28,557.00 USD`. */
const named = <T,>(value: FaceValue<T> | undefined): string | undefined =>
  value === undefined
    ? undefined
    : `${value.spec.unit === undefined ? value.label : value.label.replace(` (${value.spec.unit})`, '')} ${value.text}`

/**
 * A move in flight. `token` names the move, so an older move of the same card settling never
 * overwrites a newer one; `row` is the row object the drop saw, so a refresh that touched the row
 * ends the override; `done` once its commit resolved.
 */
type Flight<T> = Pending & { token: number; row: T; done: boolean }

async function settle(run: () => unknown): Promise<boolean> {
  try {
    await run()
    return true
  } catch {
    return false
  }
}

export function BoardLayout<T>({
  model,
  drag,
  virtual,
}: {
  model: TableModel<T>
  drag: DragLike | undefined
  virtual: VirtualLike | undefined
}): ReactElement | null {
  const t = useMessages(table)
  const [flights, setFlights] = useState<ReadonlyMap<string, Flight<T>>>(new Map())
  const tokens = useRef(0)
  // The newest move per card: only its own settle may speak or move the card.
  const newest = useRef(new Map<string, number>())
  const [said, setSaid] = useState('')
  const axis = boardAxis(model)
  const spec = model.specs.find((s) => s.id === axis)
  const valueOf = (row: ModelRow<T>): string => {
    const raw = spec?.value(row.original)
    return raw === null || raw === undefined ? '' : String(raw)
  }
  const byId = new Map(model.rows.map((row) => [row.id, row]))
  // A move ends once the data agrees with it, or once a committed move meets a row the data replaced
  // (a refresh that refused it, another writer): from then the data, never the drop, places the card.
  const landed = (id: string, f: Flight<T>): boolean => {
    const row = byId.get(id)
    if (row === undefined || valueOf(row) === f.to) return true
    return f.done && row.original !== f.row
  }
  const pending = new Map([...flights].filter(([id, f]) => !landed(id, f)))
  if (axis === undefined || spec?.edit === undefined) return null
  const edit = spec.edit
  const lanes = boardLanes(model, axis, pending)
  const total = totalColumn(model)
  const items = Object.fromEntries(
    lanes.map((lane) => [
      lane.id,
      lane.rows.map((row): Item<T> => ({
        id: row.id,
        title: cardFace(model, row.original, axis).title,
        row,
      })),
    ]),
  ) as Record<string, readonly Item<T>[]>

  const onMove = (move: Move<string>): void => {
    if (move.from === move.to) return
    const row = byId.get(move.id)
    if (row === undefined) return
    const title = cardFace(model, row.original, axis).title
    const token = (tokens.current += 1)
    newest.current.set(move.id, token)
    const flight = { to: move.to, index: move.index, token, row: row.original }
    setFlights(new Map(pending).set(move.id, { ...flight, done: false }))
    const land = async (): Promise<void> => {
      const ok = await settle(() => edit.commit(row.original, move.to))
      setFlights((prev) => {
        // A newer move of this card owns the entry now: this one settles nothing.
        if (prev.get(move.id)?.token !== token) return prev
        const next = new Map(prev)
        if (ok) next.set(move.id, { ...flight, done: true })
        else next.delete(move.id)
        return next
      })
      if (!ok && newest.current.get(move.id) === token) setSaid(t('table.boardFailed', title))
    }
    void land()
  }

  const open = (id: string) => (event: MouseEvent<HTMLElement>) => {
    if ((event.target as Element).closest(INTERACTIVE_IN_CARD) !== null) return
    model.activate(id)
  }
  const selection = model.selection

  return (
    <div data-slot="table-board" className="flex min-w-0 flex-col gap-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        {model.boardAxes.length > 1 && (
          <span className="inline-flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('table.boardGroupBy')}</span>
            <Segmented
              aria-label={t('table.boardGroupBy')}
              size="sm"
              value={axis}
              onValueChange={(next) => model.setGroupBy(next)}
              options={model.boardAxes.map((id) => ({
                value: id,
                label: model.specs.find((s) => s.id === id)?.header ?? id,
              }))}
            />
          </span>
        )}
        {drag !== undefined && (
          <span data-slot="table-board-hint" className="px-2.5 text-xs text-muted-foreground">
            {t('table.boardHint', spec.header)}
          </span>
        )}
      </div>
      <Board
        label={model.label}
        columns={lanes.map((lane) => ({
          id: lane.id,
          label: lane.label,
          tone: spec.tone?.(lane.id),
          total: laneTotal(model, total, lane.rows),
        }))}
        items={items}
        drag={drag}
        onMove={onMove}
        virtual={virtual === undefined ? undefined : { list: virtual, cardHeight: BOARD_CARD_PX }}
        card={(item, move) => {
          const face = cardFace(model, item.row.original, axis)
          const lines = [face.subtitle?.text, named(face.value)].filter(
            (line): line is string => line !== undefined && line !== '',
          )
          const chips = face.badges.map((b): CardChip => ({ label: b.text }))
          const ticked = selection?.isSelected(item.id) === true
          return (
            // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the card's menu holds Open, its keyboard path; a click on the face is the pointer shortcut
            <div
              data-slot="table-board-card"
              data-activatable=""
              data-selected={ticked ? '' : undefined}
              className="relative h-full cursor-pointer rounded-inset data-selected:ring-2 data-selected:ring-brand"
              onClick={open(item.id)}
            >
              <KanbanCard
                id={item.id}
                title={face.title}
                {...(lines.length > 0 && {
                  meta: lines.slice(0, 2) as [string] | [string, string],
                })}
                {...(chips.length > 0 && { chips: chips as [CardChip] })}
                menu={[
                  {
                    id: 'open',
                    label: t('table.cardOpen'),
                    onClick: () => model.activate(item.id),
                  },
                  ...(selection === undefined
                    ? []
                    : [
                        {
                          id: 'select',
                          label: ticked ? t('table.cardDeselect') : t('table.cardSelect'),
                          onClick: () => selection.toggle(item.id),
                        },
                      ]),
                ]}
                move={move}
              />
              {selection !== undefined && (
                <span className="absolute end-3 bottom-2.5 z-10 inline-flex">
                  <CardTick selection={selection} id={item.id} title={face.title} />
                </span>
              )}
            </div>
          )
        }}
      />
      <output className="sr-only" aria-live="polite">
        {said}
      </output>
    </div>
  )
}
