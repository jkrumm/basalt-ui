/**
 * The manage-view panel's open state and page, one store per table id. A module store rather than
 * component state because two parts open it: the views strip (Edit view, + View) and the header's
 * `Filter...`, which opens it on that column's filter page while a panel is mounted for the table
 * and keeps its own popover otherwise. Memory only: the panel is a working surface, not an address.
 */
import { useEffect, useSyncExternalStore } from 'react'

/** A page of the panel; `filter:<column id>` edits one column's filter. */
export type PanelPage =
  | 'root'
  | 'name'
  | 'sharing'
  | 'rowHeight'
  | 'columnWidth'
  | 'columns'
  | 'filter'
  | 'sort'
  | 'group'
  | 'remove'
  | `filter:${string}`

export type DoorState = { open: boolean; page: PanelPage }

type Door = {
  state: DoorState
  mounted: number
  listeners: Set<() => void>
}

const CLOSED: DoorState = { open: false, page: 'root' }
const doors = new Map<string, Door>()

function door(tableId: string): Door {
  const known = doors.get(tableId)
  if (known !== undefined) return known
  const made: Door = { state: CLOSED, mounted: 0, listeners: new Set() }
  doors.set(tableId, made)
  return made
}

/** Writes the panel's state and tells every reader. */
export function setDoor(tableId: string, next: DoorState): void {
  const d = door(tableId)
  if (d.state.open === next.open && d.state.page === next.page) return
  d.state = next
  for (const listener of d.listeners) listener()
}

/** The page a page goes back to: a column's filter to the filter list, every other page to the root. */
export const parentPage = (page: PanelPage): PanelPage =>
  page.startsWith('filter:') ? 'filter' : 'root'

/** The panel's state for a table; the server and the hydration pass read it closed. */
export function useDoor(tableId: string): DoorState {
  return useSyncExternalStore(
    (notify) => {
      const d = door(tableId)
      d.listeners.add(notify)
      return () => d.listeners.delete(notify)
    },
    () => door(tableId).state,
    () => CLOSED,
  )
}

/** Marks a panel as mounted for the table while the caller is; the header asks before it opens one. */
export function useMountDoor(tableId: string): void {
  useEffect(() => {
    const d = door(tableId)
    d.mounted += 1
    return () => {
      d.mounted -= 1
      if (d.mounted === 0) setDoor(tableId, CLOSED)
    }
  }, [tableId])
}

/** Opens the table's panel on `page`; `false` when no panel is mounted for it. */
export function openViewPanel(tableId: string, page: PanelPage): boolean {
  const d = doors.get(tableId)
  if (d === undefined || d.mounted === 0) return false
  setDoor(tableId, { open: true, page })
  return true
}
