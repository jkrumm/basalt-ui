import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, MouseEvent, TouchEvent } from 'react'

/** Where a context menu opens: viewport coordinates, the pointer or the focused element. */
export type ContextPoint = { x: number; y: number }

/** How long a finger rests on a part before it opens its menu. */
export const LONG_PRESS_MS = 500
/** How far a finger may drift before the press is a scroll or a drag instead. */
const MOVE_SLOP = 10
/** A long press ends with a click the page never meant; swallow it for this long. */
const CLICK_SHADOW_MS = 400

/** What every handler reads, so a React event and a native one fit the same function. */
type Evt = {
  target: EventTarget | null
  currentTarget: EventTarget | null
  preventDefault(): void
  stopPropagation(): void
}
type PointerEvt = Evt & { shiftKey: boolean; clientX: number; clientY: number }
type KeyEvt = Evt & { key: string; shiftKey: boolean }
type TouchEvt = Evt & { touches: ArrayLike<{ clientX: number; clientY: number }> }

/**
 * Fields and editable text keep the browser's own menu (paste, spell check): ours has no use
 * there. Buttons, checkboxes and the rest of a row's controls are the row's.
 */
const EDITABLE =
  'textarea, select, [contenteditable]:not([contenteditable="false"]), input:not([type="checkbox"], [type="radio"], [type="button"], [type="submit"], [type="reset"], [type="range"], [type="color"], [type="file"])'

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(EDITABLE) !== null

/**
 * The event is this trigger's: it came from inside its own DOM (not a portalled popup that bubbles
 * to it), and no more specific trigger sits between the target and it. A card that holds a table
 * with row menus yields to the row; a trigger that opted out marks nothing, so the card still answers.
 */
const inside = (e: Evt): boolean => {
  const { currentTarget: host, target } = e
  if (!(host instanceof Element) || !(target instanceof Element) || !host.contains(target)) {
    return false
  }
  const nearest = target.closest('[data-context-trigger]')
  return nearest === null || nearest === host || !host.contains(nearest)
}

/** Shift+F10 and the context-menu key: what a keyboard has in place of a right click. */
const isMenuKey = (e: KeyEvt): boolean => e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)

/** The browser's own menu for a modifier right click (Shift), the way a native menu yields to it. */
const wantsBrowserMenu = (e: PointerEvt): boolean => e.shiftKey

function anchorOf(target: EventTarget | null): ContextPoint {
  if (!(target instanceof Element)) return { x: 0, y: 0 }
  const rect = target.getBoundingClientRect()
  return { x: rect.left + Math.min(16, rect.width / 2), y: rect.top + Math.min(28, rect.height) }
}

export type ContextOptions = {
  /** Called with the point the menu opens at. */
  onOpen(at: ContextPoint): void
  /** True while the part opts out: every event falls through to the browser. */
  disabled: boolean
}

/** The handlers a trigger needs, as plain functions over event shapes both React and the DOM share. */
export type ContextHandlers = {
  contextmenu(e: PointerEvt): void
  keydown(e: KeyEvt): void
  touchstart(e: TouchEvt): void
  touchmove(e: TouchEvt): void
  touchend(e: Evt): void
  touchcancel(): void
  clickCapture(e: Evt): void
  /** Stops a pending long press; call it when the trigger goes away. */
  dispose(): void
}

/**
 * The one reading of "this part opens its menu": a right click, the context-menu key or Shift+F10
 * on the focused part, and a long press on touch. It yields to the browser for a modifier right
 * click and inside a field. Framework-free so the lazy card menu and the native-popover card menu
 * share it with the React primitive.
 *
 * @example
 * const h = contextHandlers(() => ({ onOpen: (at) => show(at), disabled: false }))
 * card.addEventListener('contextmenu', h.contextmenu)
 */
export function contextHandlers(read: () => ContextOptions): ContextHandlers {
  let timer: ReturnType<typeof setTimeout> | undefined
  let start: ContextPoint | null = null
  let shadow = false
  let shadowTimer: ReturnType<typeof setTimeout> | undefined

  const cancel = (): void => {
    clearTimeout(timer)
    timer = undefined
    start = null
  }
  const open = (at: ContextPoint): void => {
    read().onOpen(at)
  }

  return {
    contextmenu(e) {
      if (read().disabled || !inside(e) || wantsBrowserMenu(e) || isEditable(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      open({ x: e.clientX, y: e.clientY })
    },
    keydown(e) {
      if (read().disabled || !isMenuKey(e) || !inside(e) || isEditable(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      open(anchorOf(e.target))
    },
    touchstart(e) {
      cancel()
      const touch = e.touches[0]
      if (read().disabled || e.touches.length !== 1 || touch === undefined || !inside(e)) return
      if (isEditable(e.target)) return
      const at = { x: touch.clientX, y: touch.clientY }
      start = at
      timer = setTimeout(() => {
        timer = undefined
        shadow = true
        clearTimeout(shadowTimer)
        shadowTimer = setTimeout(() => (shadow = false), CLICK_SHADOW_MS + LONG_PRESS_MS)
        open(at)
      }, LONG_PRESS_MS)
    },
    touchmove(e) {
      const touch = e.touches[0]
      if (start === null || touch === undefined) return
      if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > MOVE_SLOP) cancel()
    },
    touchend(e) {
      cancel()
      if (shadow) e.preventDefault()
    },
    touchcancel: cancel,
    clickCapture(e) {
      if (!shadow) return
      shadow = false
      e.preventDefault()
      e.stopPropagation()
    },
    dispose() {
      cancel()
      clearTimeout(shadowTimer)
    },
  }
}

/**
 * Attaches `contextHandlers` to a DOM element for a part that has no React trigger (the native
 * popover of `CardMenu`). Returns the cleanup.
 *
 * @example
 * useEffect(() => bindContextTrigger(card, contextHandlers(options)), [])
 */
export function bindContextTrigger(host: HTMLElement, h: ContextHandlers): () => void {
  const listeners: [string, (e: never) => void, AddEventListenerOptions][] = [
    ['contextmenu', h.contextmenu, {}],
    ['keydown', h.keydown, {}],
    ['touchstart', h.touchstart, { passive: true }],
    ['touchmove', h.touchmove, { passive: true }],
    ['touchend', h.touchend, {}],
    ['touchcancel', h.touchcancel, {}],
    ['click', h.clickCapture, { capture: true }],
  ]
  for (const [type, fn, opts] of listeners) host.addEventListener(type, fn as EventListener, opts)
  return () => {
    for (const [type, fn, opts] of listeners) {
      host.removeEventListener(type, fn as EventListener, opts)
    }
    h.dispose()
  }
}

/** The props a React element takes to be a context-menu trigger. */
export type ContextTriggerProps = {
  onContextMenu: (e: MouseEvent) => void
  onKeyDown: (e: KeyboardEvent) => void
  onTouchStart: (e: TouchEvent) => void
  onTouchMove: (e: TouchEvent) => void
  onTouchEnd: (e: TouchEvent) => void
  onTouchCancel: () => void
  onClickCapture: (e: MouseEvent) => void
  /** Marks an enabled trigger: no iOS callout on a long press, and a trigger above it yields to it. */
  'data-context-trigger'?: ''
}

/**
 * `contextHandlers` as props for a React element. `onOpen` and `disabled` are read at event time, so
 * an inline function is fine.
 *
 * @example
 * const trigger = useContextTrigger({ onOpen: setAt })
 * return <div {...trigger}>...</div>
 */
export function useContextTrigger(options: {
  onOpen(at: ContextPoint): void
  disabled?: boolean | undefined
}): ContextTriggerProps {
  const latest = useRef(options)
  // Events read the options of the last commit, so an inline `onOpen` is fine.
  useEffect(() => {
    latest.current = options
  })
  // oxlint-disable-next-line react/refs -- read when an event fires, never during render
  const [h] = useState(() =>
    contextHandlers(() => ({ ...latest.current, disabled: latest.current.disabled === true })),
  )
  useEffect(() => h.dispose, [h])
  return {
    onContextMenu: h.contextmenu,
    onKeyDown: h.keydown,
    onTouchStart: h.touchstart,
    onTouchMove: h.touchmove,
    onTouchEnd: h.touchend,
    onTouchCancel: h.touchcancel,
    onClickCapture: h.clickCapture,
    ...(options.disabled !== true && { 'data-context-trigger': '' as const }),
  }
}
