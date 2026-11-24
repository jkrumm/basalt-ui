import { createContext, useContext, useState, useSyncExternalStore } from 'react'
import type { CSSProperties } from 'react'
import { SIZE_CLASSES, toEm } from '../tokens/size-classes'

/**
 * How an overlay presents itself: `auto` lets the viewport decide (a sheet from the bottom on a
 * phone, the anchored popup everywhere else), `popup` and `sheet` force one.
 */
export type OverlayPresent = 'auto' | 'popup' | 'sheet'

/** A phone: the compact size class on a coarse primary pointer. The one rule every overlay reads. */
const PHONE = `(width < ${toEm(SIZE_CLASSES.medium)}) and (pointer: coarse)`

const subscribePhone = (notify: () => void): (() => void) => {
  // the one viewport and pointer read the overlays make; nothing else keys on the viewport
  // an environment with no matchMedia (a bare test DOM) never reads as a phone
  if (typeof window.matchMedia !== 'function') return () => {}
  const query = window.matchMedia(PHONE)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
const readPhone = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches
const serverPhone = (): boolean => false

/**
 * Whether an overlay opens as a sheet: `present` wins, otherwise a phone does. The server and the
 * hydration pass read `false`, so the markup matches and the sheet lands one commit later.
 */
export function useSheetPresent(present?: OverlayPresent): boolean {
  const phone = useSyncExternalStore(subscribePhone, readPhone, serverPhone)
  return present === 'sheet' || (present !== 'popup' && phone)
}

/** What an overlay's content part reads from its root: whether it is a sheet, and its open state. */
type OverlayState = {
  sheet: boolean
  open: boolean
  /** Closes or opens it; the sheet passes its own event details, a bare call gets a close-press one. */
  setOpen: (open: boolean, details?: unknown) => void
  /** The sheet's accessible name: the control that opened it, by label or by id. */
  name: OverlayName | undefined
  /** Set by a part that starts as a popup and may turn into a sheet (`Popover` on a phone). */
  escalate?: (() => void) | undefined
}

/** A label or the id of one. */
export type OverlayName = { 'aria-label': string } | { 'aria-labelledby': string }

const OverlayContext = createContext<OverlayState | null>(null)

/** The root's presenter state, or `null` outside one: the content part then draws its popup. */
export function useOverlay(): OverlayState | null {
  return useContext(OverlayContext)
}

/** The event details of a change no Base UI event started (Done under a calendar): shaped like Base UI's. */
function closePress(open: boolean): Record<string, unknown> {
  return {
    reason: open ? 'trigger-press' : 'close-press',
    event: new Event('click'),
    cancel: () => {},
    allowPropagation: () => {},
    isCanceled: false,
    isPropagationAllowed: false,
    trigger: undefined,
  }
}

type OpenProps<D> = {
  open?: boolean | undefined
  defaultOpen?: boolean | undefined
  onOpenChange?: ((open: boolean, details: D) => void) | undefined
}

/**
 * The root's side of the presenter: it owns the open state (controlled or not), so the content part
 * can close a sheet it draws, and decides the presentation. Spread `root` on the Base UI root and
 * wrap it in `<OverlayProvider value={overlay}>`.
 */
export function useOverlayRoot<D>({
  present,
  open,
  defaultOpen,
  onOpenChange,
  name,
}: OpenProps<D> & { present?: OverlayPresent | undefined; name?: OverlayName | undefined }): {
  overlay: OverlayState
  root: { open: boolean; onOpenChange: (open: boolean, details: D) => void }
} {
  const sheet = useSheetPresent(present)
  const [inner, setInner] = useState(defaultOpen ?? false)
  const value = open ?? inner
  const change = (next: boolean, details: D): void => {
    // the consumer sees the change first, and a `details.cancel()` keeps an uncontrolled root as it was
    onOpenChange?.(next, details)
    if (open === undefined && (details as { isCanceled?: boolean }).isCanceled !== true) {
      setInner(next)
    }
  }
  return {
    overlay: {
      sheet,
      name,
      open: value,
      setOpen: (next, details) => change(next, (details ?? closePress(next)) as D),
    },
    root: { open: value, onOpenChange: change },
  }
}

export const OverlayProvider = OverlayContext.Provider

/**
 * The positioner a sheet draws in place of the anchored one: in flow inside the sheet, with none
 * of the floating position Base UI writes.
 */
export const SHEET_POSITIONER: CSSProperties = {
  position: 'static',
  transform: 'none',
  inset: 'auto',
  width: 'auto',
  height: 'auto',
}

/** The classes on the positioner a sheet draws: it fills the sheet and the list scrolls inside. */
export const SHEET_POSITIONER_CLASS = 'flex min-h-0 flex-1 flex-col outline-none'

/**
 * The classes on a list popup inside a sheet: a bare scrolling column on the sheet's surface, with
 * the rows at the 44 px floor (the popup's own rows already carry `pointer-coarse`).
 */
export const SHEET_LIST_CLASS = 'flex min-h-0 flex-1 flex-col overflow-y-auto p-2 outline-none'
