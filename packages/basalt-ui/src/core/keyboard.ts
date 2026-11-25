import { useEffect } from 'react'

/** The `<input type>` values that open no software keyboard. */
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

/** Whether focus in `el` raises a software keyboard: a writable text input, a textarea, an editable region. */
export function isTextField(el: Element | null): boolean {
  if (el === null) return false
  if (el instanceof HTMLTextAreaElement) return !el.readOnly && !el.disabled
  if (el instanceof HTMLInputElement)
    return !NO_KEYBOARD.has(el.type) && !el.readOnly && !el.disabled
  return el instanceof HTMLElement && el.isContentEditable
}

/**
 * While a text field has focus under a coarse pointer, `<html>` carries `data-keyboard`; the shell
 * hides its bottom bar on the attribute so the bar steps out of the keyboard's way. Nothing else
 * moves: the browser scrolls the focused field into view, and a Sheet is handled by Base UI's
 * `Drawer.VirtualKeyboardProvider`. (A bottom padding by the keyboard's height was tried and
 * removed: iOS does not resize the layout viewport, so the padding showed as an empty block above
 * the keyboard.) The attribute is written to the element, not to React state: a keystroke re-renders
 * nothing.
 *
 * @example
 * useKeyboardInset()
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const el = document.documentElement
    // a test DOM without `matchMedia` (the jsdom lane) has no pointer to read
    if (typeof window.matchMedia !== 'function') return undefined
    const coarse = window.matchMedia('(pointer: coarse)')
    let timer: ReturnType<typeof setTimeout> | undefined
    const sync = (): void => {
      const open = coarse.matches && isTextField(document.activeElement)
      if (open) el.setAttribute('data-keyboard', '')
      else el.removeAttribute('data-keyboard')
    }
    // `focusout` fires while `activeElement` is still the body; the next field takes it a tick later.
    const later = (): void => {
      clearTimeout(timer)
      timer = setTimeout(sync, 0)
    }
    document.addEventListener('focusin', later)
    document.addEventListener('focusout', later)
    sync()
    return () => {
      clearTimeout(timer)
      document.removeEventListener('focusin', later)
      document.removeEventListener('focusout', later)
      el.removeAttribute('data-keyboard')
    }
  }, [])
}
