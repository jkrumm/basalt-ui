/**
 * The signal that moves the trial variants' bar out of the way: a text field has focus, so the
 * software keyboard is up.
 *
 * The keyboard is read from FOCUS, not from `visualViewport`: iOS Safari resizes only the visual
 * viewport and Chrome on Android the layout one, so a size read means two code paths, while a
 * focused text field is the one fact both share, and a headless test can produce it.
 */
import { useEffect, useState } from 'react'

/** Input types that raise no keyboard: a focused checkbox leaves the bar where it is. */
const NO_KEYBOARD = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

/** Whether focusing `el` raises the software keyboard (or the OS picker, for a select). */
export function raisesKeyboard(el: Element | null): boolean {
  if (el === null) return false
  if (el instanceof HTMLInputElement) return !NO_KEYBOARD.has(el.type) && !el.readOnly
  if (el instanceof HTMLTextAreaElement) return !el.readOnly
  if (el instanceof HTMLSelectElement) return true
  return el instanceof HTMLElement && el.isContentEditable
}

/** True while a text field anywhere in the document has focus. */
export function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false)
  useEffect(() => {
    const read = (): void => setUp(raisesKeyboard(document.activeElement))
    // `focusout` fires before focus lands on the next element: read once the move settles.
    const later = (): void => void queueMicrotask(read)
    document.addEventListener('focusin', read)
    document.addEventListener('focusout', later)
    read()
    return () => {
      document.removeEventListener('focusin', read)
      document.removeEventListener('focusout', later)
    }
  }, [])
  return up
}
