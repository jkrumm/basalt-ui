import { useEffect } from 'react'
import type { RefObject } from 'react'

// Built, not quoted: `scripts/gen-basalt-names.ts` reads every quoted `--basalt-*` name in shipped source into the 2.x allowlist.
const INSET_VAR = `--basalt-${'keyboard-inset'}`

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

/** Px between the bottom of the layout viewport and the bottom of the visual one: what a keyboard covers. */
function keyboardInset(): number {
  // happy-dom and old WebViews have none: the property is `undefined` there, not `null`
  const visual = window.visualViewport as VisualViewport | null | undefined
  if (!visual) return 0
  return Math.max(
    0,
    Math.round(document.documentElement.clientHeight - visual.height - visual.offsetTop),
  )
}

/**
 * While a text field has focus under a coarse pointer, `target` carries `data-keyboard` and the
 * custom property `--basalt-keyboard-inset` holds the height the keyboard covers, read from the
 * `visualViewport` (browsers that resize the layout viewport for the keyboard report 0). The shell
 * hides its bottom bar on the attribute and pads its bottom edge by the inset, so a field outside a
 * Sheet stays visible; a Sheet is handled by Base UI's `Drawer.VirtualKeyboardProvider`. Both
 * are written to the element, not to React state: a keystroke re-renders nothing.
 *
 * @example
 * useKeyboardInset(rootRef)
 */
export function useKeyboardInset(target: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = target.current
    if (el === null) return undefined
    const coarse = window.matchMedia('(pointer: coarse)')
    const visual = window.visualViewport
    let timer: ReturnType<typeof setTimeout> | undefined
    const sync = (): void => {
      const open = coarse.matches && isTextField(document.activeElement)
      if (open) el.setAttribute('data-keyboard', '')
      else el.removeAttribute('data-keyboard')
      el.style.setProperty(INSET_VAR, `${open ? keyboardInset() : 0}px`)
    }
    // `focusout` fires while `activeElement` is still the body; the next field takes it a tick later.
    const later = (): void => {
      clearTimeout(timer)
      timer = setTimeout(sync, 0)
    }
    document.addEventListener('focusin', later)
    document.addEventListener('focusout', later)
    visual?.addEventListener('resize', sync)
    visual?.addEventListener('scroll', sync)
    sync()
    return () => {
      clearTimeout(timer)
      document.removeEventListener('focusin', later)
      document.removeEventListener('focusout', later)
      visual?.removeEventListener('resize', sync)
      visual?.removeEventListener('scroll', sync)
      el.removeAttribute('data-keyboard')
      el.style.removeProperty(INSET_VAR)
    }
  }, [target])
}
